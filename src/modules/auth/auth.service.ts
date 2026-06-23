import { prisma } from "../../config/prisma";
import { hashPassword, verifyPassword } from "../../utils/password";
import { signAccessToken, signRefreshToken } from "../../utils/jwt";
import jwt, { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { env } from "../../config/env";
import { generateOtp } from "../../utils/token";
import { emailService } from "../email/email.service";
import axios from "axios";
import { googleClient } from "../../lib/google";

// ─── Error Types ─────────────────────────────────────────────────────────────

export type AuthErrorCode =
  | "EMAIL_ALREADY_EXISTS"
  | "USERNAME_ALREADY_EXISTS"
  | "EMAIL_AND_USERNAME_TAKEN"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_NO_PASSWORD"
  | "SESSION_NOT_FOUND"
  | "SESSION_REVOKED"
  | "SESSION_EXPIRED"
  | "REFRESH_TOKEN_INVALID"
  | "REFRESH_TOKEN_MALFORMED"
  | "OTP_NOT_FOUND"
  | "OTP_EXPIRED"
  | "OTP_INVALID"
  | "GOOGLE_TOKEN_INVALID"
  | "GOOGLE_EMAIL_MISSING"
  | "GOOGLE_AUTH_FAILED";

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
    public readonly statusHint: 400 | 401 | 403 | 404 | 409 | 500 = 400
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class AuthService {
  // ── Register ──────────────────────────────────────────────────────────────

  async register(
    email: string,
    username: string,
    password: string,
    fullName: string,
    dateOfBirth: Date
  ) {
    const emailLower = email.toLowerCase();
    const usernameLower = username.toLowerCase();

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ emailLower }, { usernameLower }] },
      select: { emailLower: true, usernameLower: true },
    });

    if (existingUser) {
      const emailTaken = existingUser.emailLower === emailLower;
      const usernameTaken = existingUser.usernameLower === usernameLower;

      if (emailTaken && usernameTaken) {
        throw new AuthError(
          "EMAIL_AND_USERNAME_TAKEN",
          `Both email "${email}" and username "${username}" are already registered.`,
          409
        );
      }
      if (emailTaken) {
        throw new AuthError(
          "EMAIL_ALREADY_EXISTS",
          `An account with email "${email}" already exists. Try logging in instead.`,
          409
        );
      }
      throw new AuthError(
        "USERNAME_ALREADY_EXISTS",
        `Username "${username}" is already taken. Please choose a different one.`,
        409
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, emailLower, username, usernameLower, passwordHash },
      });

      await tx.profile.create({
        data: { userId: user.id, fullName, dateOfBirth },
      });

      await tx.notificationSettings.create({
        data: { userId: user.id },
      });

      return user;
    });

    const tokens = await this.createSession(user.id);
    return { ...tokens, user };
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async login(email: string, password: string) {
    const emailLower = email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { emailLower },
    });

    // Deliberately vague to prevent user enumeration
    if (!user) {
      throw new AuthError(
        "INVALID_CREDENTIALS",
        "No account found with that email address.",
        401
      );
    }

    if (!user.passwordHash) {
      throw new AuthError(
        "ACCOUNT_NO_PASSWORD",
        `This account was created with ${user.authProvider ?? "a social provider"}. Use that provider to sign in, or reset your password to set one.`,
        401
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new AuthError(
        "INVALID_CREDENTIALS",
        "Incorrect password. Please try again or reset your password.",
        401
      );
    }

    const tokens = await this.createSession(user.id);
    return { ...tokens, user };
  }

  // ── Refresh Token ─────────────────────────────────────────────────────────

  async refreshToken(refreshToken: string) {
    let payload: { sid: string };

    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { sid: string };
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        throw new AuthError(
          "SESSION_EXPIRED",
          "Your session has expired. Please log in again.",
          401
        );
      }
      if (err instanceof JsonWebTokenError) {
        throw new AuthError(
          "REFRESH_TOKEN_MALFORMED",
          "The refresh token is malformed or has been tampered with.",
          401
        );
      }
      throw err;
    }

    const session = await prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });

    if (!session) {
      throw new AuthError(
        "SESSION_NOT_FOUND",
        `Session "${payload.sid}" does not exist. It may have been deleted.`,
        401
      );
    }

    if (session.revokedAt) {
      throw new AuthError(
        "SESSION_REVOKED",
        `Session "${payload.sid}" was revoked at ${session.revokedAt.toISOString()}. Please log in again.`,
        401
      );
    }

    const isValid = await verifyPassword(refreshToken, session.refreshTokenHash);
    if (!isValid) {
      // Token reuse detected — revoke the session defensively
      await prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new AuthError(
        "REFRESH_TOKEN_INVALID",
        "Refresh token does not match the stored session. The session has been revoked for security.",
        401
      );
    }

    const newAccessToken = signAccessToken(session.userId);
    const newRefreshToken = signRefreshToken(session.id);

    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: await hashPassword(newRefreshToken),
        lastUsedAt: new Date(),
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: session.user,
    };
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  async logout(refreshToken: string) {
    let payload: { sid: string };

    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { sid: string };
    } catch (err) {
      if (err instanceof TokenExpiredError || err instanceof JsonWebTokenError) {
        // Token is already invalid — treat logout as a no-op success
        return true;
      }
      throw err;
    }

    await prisma.session.update({
      where: { id: payload.sid },
      data: { revokedAt: new Date() },
    });

    return true;
  }

  // ── Logout All Devices ────────────────────────────────────────────────────

  async logoutAllDevices(userId: string) {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return true;
  }

  // ── Send Verification Email ───────────────────────────────────────────────

  async sendVerificationEmail(userId: string | null, email?: string | null) {
    let user = null;

    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId } });
    } else if (email) {
      user = await prisma.user.findUnique({ where: { emailLower: email.toLowerCase() } });
    }

    // Always return true — don't reveal whether the email exists
    if (!user) return true;

    await prisma.verificationToken.deleteMany({ where: { userId: user.id } });

    const otp = generateOtp();

    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        token: await hashPassword(otp),
        expiresAt: new Date(Date.now() + 1000 * 60 * 10),
      },
    });

    await emailService.sendVerificationEmail(user.email, otp);
    return true;
  }

  // ── Verify Email ──────────────────────────────────────────────────────────

  async verifyEmail(userId: string, otp: string) {
    const verificationToken = await prisma.verificationToken.findFirst({
      where: { userId },
    });

    if (!verificationToken) {
      throw new AuthError(
        "OTP_NOT_FOUND",
        "No verification code was found for this account. Request a new one.",
        400
      );
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new AuthError(
        "OTP_EXPIRED",
        `The verification code expired at ${verificationToken.expiresAt.toISOString()}. Request a new one.`,
        400
      );
    }

    const isValid = await verifyPassword(otp, verificationToken.token);
    if (!isValid) {
      throw new AuthError(
        "OTP_INVALID",
        "The verification code is incorrect. Double-check it and try again.",
        400
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });

    await prisma.verificationToken.deleteMany({ where: { userId } });
    return true;
  }

  // ── Forgot Password ───────────────────────────────────────────────────────

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({
      where: { emailLower: email.toLowerCase() },
    });

    // Always return true — don't reveal whether the email exists
    if (!user) return true;

    const otp = generateOtp();

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: await hashPassword(otp),
        expiresAt: new Date(Date.now() + 1000 * 60 * 10),
      },
    });

    await emailService.sendPasswordResetEmail(user.email, otp);
    return true;
  }

  // ── Reset Password ────────────────────────────────────────────────────────

  async resetPassword(email: string, otp: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { emailLower: email.toLowerCase() },
    });

    if (!user) {
      throw new AuthError(
        "OTP_NOT_FOUND",
        "No account found with that email address.",
        400
      );
    }

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id },
    });

    if (!resetToken) {
      throw new AuthError(
        "OTP_NOT_FOUND",
        "No password reset was requested for this account, or it has already been used. Request a new one.",
        400
      );
    }

    if (resetToken.expiresAt < new Date()) {
      throw new AuthError(
        "OTP_EXPIRED",
        `The password reset code expired at ${resetToken.expiresAt.toISOString()}. Request a new reset link.`,
        400
      );
    }

    const isValid = await verifyPassword(otp, resetToken.token);
    if (!isValid) {
      throw new AuthError(
        "OTP_INVALID",
        "The reset code is incorrect. Check the email and try again.",
        400
      );
    }

    const passwordHash = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    await prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return true;
  }

  // ── Google Login ──────────────────────────────────────────────────────────

  async googleLogin(token: string) {
    // Path 1: ID token (native mobile / server-side flow)
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload?.email) {
        throw new AuthError(
          "GOOGLE_EMAIL_MISSING",
          "Google ID token was valid but contained no email address. Ensure the account has a verified email.",
          400
        );
      }

      return this.handleGoogleUser({
        email: payload.email,
        picture: payload.picture,
        name: payload.name,
      });
    } catch (err) {
      // Re-throw our own typed errors immediately
      if (err instanceof AuthError) throw err;

      // ID token failed — fall through to access token
    }

    // Path 2: Access token (web OAuth flow)
    try {
      const { data } = await axios.get<{ email?: string; picture?: string; name?: string }>(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!data.email) {
        throw new AuthError(
          "GOOGLE_EMAIL_MISSING",
          "Google returned a userinfo response but it contained no email address.",
          400
        );
      }

      return this.handleGoogleUser({
        email: data.email,
        picture: data.picture,
        name: data.name,
      });
    } catch (err) {
      if (err instanceof AuthError) throw err;

      const status = axios.isAxiosError(err) ? err.response?.status : undefined;

      throw new AuthError(
        "GOOGLE_AUTH_FAILED",
        status === 401
          ? "The Google token has expired or been revoked. Please sign in with Google again."
          : `Google authentication failed${status ? ` (status ${status})` : ""}. Please try again.`,
        401
      );
    }
  }

  // ── Handle Google User (upsert) ───────────────────────────────────────────

  private async handleGoogleUser({
    email,
    picture,
    name,
  }: {
    email: string;
    picture?: string;
    name?: string;
  }) {
    const emailLower = email.toLowerCase();

    let user = await prisma.user.findUnique({ where: { emailLower } });

    if (!user) {
      const baseUsername = email.split("@")[0];
      let username = baseUsername;
      let usernameLower = username.toLowerCase();
      let counter = 1;

      while (await prisma.user.findUnique({ where: { usernameLower } })) {
        username = `${baseUsername}${counter}`;
        usernameLower = username.toLowerCase();
        counter++;
      }

      user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email,
            emailLower,
            username,
            usernameLower,
            authProvider: "GOOGLE",
            avatarUrl: picture,
            emailVerifiedAt: new Date(),
          },
        });

        await tx.profile.create({
          data: { userId: created.id, fullName: name ?? username },
        });

        await tx.notificationSettings.create({
          data: { userId: created.id },
        });

        return created;
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          avatarUrl: user.avatarUrl ?? picture,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
      });
    }

    const tokens = await this.createSession(user.id);
    return { ...tokens, user };
  }

  // ── Create Session ────────────────────────────────────────────────────────

  private async createSession(userId: string) {
    const session = await prisma.session.create({
      data: {
        userId,
        refreshTokenHash: "",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      },
    });

    const accessToken = signAccessToken(userId);
    const refreshToken = signRefreshToken(session.id);

    await prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash: await hashPassword(refreshToken) },
    });

    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();