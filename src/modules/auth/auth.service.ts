import { prisma } from "../../config/prisma";
import { hashPassword, verifyPassword } from "../../utils/password";
import {
  signAccessToken,
  signRefreshToken,
} from "../../utils/jwt";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { generateOtp } from "../../utils/token";
import { emailService } from "../email/email.service";
import crypto from "crypto";
import { googleClient } from "../../lib/google";

export class AuthService {
  async register(
    email: string,
    username: string,
    password: string
  ) {
    const emailLower = email.toLowerCase();
    const usernameLower =
      username.toLowerCase();

    const existingUser =
      await prisma.user.findFirst({
        where: {
          OR: [
            { emailLower },
            { usernameLower },
          ],
        },
      });

    if (existingUser) {
      throw new Error(
        "User already exists"
      );
    }

    const passwordHash =
      await hashPassword(password);

    const user =
      await prisma.user.create({
        data: {
          email,
          emailLower,

          username,
          usernameLower,

          passwordHash,
        },
      });

    const session =
      await prisma.session.create({
        data: {
          userId: user.id,
          refreshTokenHash: "",
          expiresAt: new Date(
            Date.now() +
            1000 *
            60 *
            60 *
            24 *
            30
          ),
        },
      });

    const accessToken =
      signAccessToken(user.id);

    const refreshToken =
      signRefreshToken(session.id);

    await prisma.session.update({
      where: {
        id: session.id,
      },
      data: {
        refreshTokenHash:
          refreshToken,
      },
    });

    return {
      accessToken,
      refreshToken,
      user,
    };
  }
  async login(
    email: string,
    password: string
  ) {
    const emailLower = email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: {
        emailLower,
      },
    });

    if (!user || !user.passwordHash) {
      throw new Error("Invalid credentials");
    }

    const isValid = await verifyPassword(
      password,
      user.passwordHash
    );

    if (!isValid) {
      throw new Error("Invalid credentials");
    }

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: "",
        expiresAt: new Date(
          Date.now() +
          1000 * 60 * 60 * 24 * 30
        ),
      },
    });

    const accessToken =
      signAccessToken(user.id);

    const refreshToken =
      signRefreshToken(session.id);

    await prisma.session.update({
      where: {
        id: session.id,
      },
      data: {
        refreshTokenHash:
          refreshToken,
      },
    });

    return {
      accessToken,
      refreshToken,
      user,
    };
  }
  async refreshToken(
    refreshToken: string
  ) {
    const payload = jwt.verify(
      refreshToken,
      env.JWT_REFRESH_SECRET
    ) as {
      sid: string;
    };

    const session =
      await prisma.session.findUnique({
        where: {
          id: payload.sid,
        },
        include: {
          user: true,
        },
      });

    if (!session) {
      throw new Error("Invalid session");
    }

    if (session.revokedAt) {
      throw new Error("Session revoked");
    }

    if (
      session.refreshTokenHash !==
      refreshToken
    ) {
      throw new Error("Invalid token");
    }

    const newAccessToken =
      signAccessToken(session.userId);

    const newRefreshToken =
      signRefreshToken(session.id);

    await prisma.session.update({
      where: {
        id: session.id,
      },
      data: {
        refreshTokenHash:
          newRefreshToken,
        lastUsedAt: new Date(),
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: session.user,
    };
  }
  async logout(
    refreshToken: string
  ) {
    const payload = jwt.verify(
      refreshToken,
      env.JWT_REFRESH_SECRET
    ) as {
      sid: string;
    };

    await prisma.session.update({
      where: {
        id: payload.sid,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return true;
  }
  async logoutAllDevices(
    userId: string
  ) {
    await prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return true;
  }
  async sendVerificationEmail(
    userId: string | null,
    email?: string | null
  ) {
    let user = null;

    if (userId) {
      user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
      });
    } else if (email) {
      user = await prisma.user.findUnique({
        where: {
          emailLower: email.toLowerCase(),
        },
      });
    }

    if (!user) {
      return true;
    }

    const token = Math.floor(
      100000 +
      Math.random() * 900000
    ).toString();

    await prisma.verificationToken.deleteMany({
      where: {
        userId: user.id,
      },
    });


    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(
          Date.now() +
          1000 * 60 * 60 * 24
        ),
      },
    });

    await emailService.sendVerificationEmail(
      user.email,
      token
    );

    return true;
  }
  async verifyEmail(
    userId: string,
    otp: string
  ) {
    const verificationToken =
      await prisma.verificationToken.findFirst(
        {
          where: {
            userId,
            token: otp,
          },
        }
      );

    if (!verificationToken) {
      throw new Error(
        "Invalid OTP"
      );
    }

    if (
      verificationToken.expiresAt <
      new Date()
    ) {
      throw new Error(
        "OTP expired"
      );
    }

    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        emailVerifiedAt:
          new Date(),
      },
    });

    await prisma.verificationToken.delete({
      where: {
        id: verificationToken.id,
      },
    });

    return true;
  }
  async forgotPassword(
    email: string
  ) {
    const user =
      await prisma.user.findUnique({
        where: {
          emailLower:
            email.toLowerCase(),
        },
      });

    if (!user) {
      return true;
    }

    const otp = Math.floor(
      100000 +
      Math.random() * 900000
    ).toString();

    await prisma.passwordResetToken.deleteMany(
      {
        where: {
          userId: user.id,
        },
      }
    );

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: otp,
        expiresAt: new Date(
          Date.now() +
          1000 * 60 * 10
        ),
      },
    });

    await emailService.sendPasswordResetEmail(
      user.email,
      otp
    );

    return true;
  }
  async resetPassword(
    email: string,
    otp: string,
    password: string
  ) {
    const user =
      await prisma.user.findUnique({
        where: {
          emailLower:
            email.toLowerCase(),
        },
      });

    if (!user) {
      throw new Error(
        "User not found"
      );
    }

    const resetToken =
      await prisma.passwordResetToken.findFirst(
        {
          where: {
            userId: user.id,
            token: otp,
          },
        }
      );

    if (!resetToken) {
      throw new Error(
        "Invalid OTP"
      );
    }

    if (
      resetToken.expiresAt <
      new Date()
    ) {
      throw new Error(
        "OTP expired"
      );
    }

    const passwordHash =
      await hashPassword(
        password
      );

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash,
      },
    });

    await prisma.passwordResetToken.delete({
      where: {
        id: resetToken.id,
      },
    });

    await prisma.session.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt:
          new Date(),
      },
    });

    return true;
  }
  async googleLogin(
  idToken: string
) {
  const ticket =
    await googleClient.verifyIdToken({
      idToken,
      audience:
        env.GOOGLE_CLIENT_ID,
    });

  const payload =
    ticket.getPayload();

  if (
    !payload ||
    !payload.email
  ) {
    throw new Error(
      "Invalid Google token"
    );
  }

  const email =
    payload.email;

  const emailLower =
    email.toLowerCase();

  let user =
    await prisma.user.findUnique({
      where: {
        emailLower,
      },
    });

  if (!user) {
    user =
      await prisma.user.create({
        data: {
          email,
          emailLower,

          username:
            email.split("@")[0],

          usernameLower:
            email
              .split("@")[0]
              .toLowerCase(),

          authProvider:
            "GOOGLE",

          avatarUrl:
            payload.picture,

          emailVerifiedAt:
            new Date(),
        },
      });
  }

  const session =
    await prisma.session.create({
      data: {
        userId: user.id,

        refreshTokenHash:
          "",

        expiresAt:
          new Date(
            Date.now() +
            1000 *
            60 *
            60 *
            24 *
            30
          ),
      },
    });

  const accessToken =
    signAccessToken(
      user.id
    );

  const refreshToken =
    signRefreshToken(
      session.id
    );

  await prisma.session.update({
    where: {
      id: session.id,
    },

    data: {
      refreshTokenHash:
        await hashPassword(
          refreshToken
        ),
    },
  });

  return {
    accessToken,
    refreshToken,
    user,
  };
}
}

export const authService =
  new AuthService();