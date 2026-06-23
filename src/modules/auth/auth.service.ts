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

import axios from "axios";
import { googleClient } from "../../lib/google";

export class AuthService {
  async register(
    email: string,
    username: string,
    password: string,
    fullName: string,
    dateOfBirth: Date
  ) {
    const emailLower =
      email.toLowerCase();

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
      await prisma.$transaction(
        async (tx) => {
          const user =
            await tx.user.create({
              data: {
                email,
                emailLower,

                username,
                usernameLower,

                passwordHash,
              },
            });

          await tx.profile.create({
            data: {
              userId: user.id,

              fullName,

              dateOfBirth,
            },
          });

          await tx.notificationSettings.create(
            {
              data: {
                userId: user.id,
              },
            }
          );

          return user;
        }
      );

    const tokens =
      await this.createSession(
        user.id
      );

    return {
      ...tokens,
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
    const tokens =
      await this.createSession(
        user.id
      );

    return {
      ...tokens,
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
      throw new Error(
        "Invalid session"
      );
    }

    if (session.revokedAt) {
      throw new Error(
        "Session revoked"
      );
    }

    const isValid =
      await verifyPassword(
        refreshToken,
        session.refreshTokenHash
      );

    if (!isValid) {
      throw new Error(
        "Invalid token"
      );
    }

    const newAccessToken =
      signAccessToken(
        session.userId
      );

    const newRefreshToken =
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
            newRefreshToken
          ),
        lastUsedAt:
          new Date(),
      },
    });

    return {
      accessToken:
        newAccessToken,
      refreshToken:
        newRefreshToken,
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
      user =
        await prisma.user.findUnique({
          where: {
            id: userId,
          },
        });
    } else if (email) {
      user =
        await prisma.user.findUnique({
          where: {
            emailLower:
              email.toLowerCase(),
          },
        });
    }

    if (!user) {
      return true;
    }

    await prisma.verificationToken.deleteMany(
      {
        where: {
          userId: user.id,
        },
      }
    );

    const otp =
      generateOtp();

    await prisma.verificationToken.create(
      {
        data: {
          userId: user.id,

          token:
            await hashPassword(
              otp
            ),

          expiresAt:
            new Date(
              Date.now() +
              1000 *
              60 *
              10
            ),
        },
      }
    );

    await emailService.sendVerificationEmail(
      user.email,
      otp
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

    const isValid =
      await verifyPassword(
        otp,
        verificationToken.token
      );

    if (!isValid) {
      throw new Error(
        "Invalid OTP"
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

    await prisma.verificationToken.deleteMany(
      {
        where: {
          userId,
        },
      }
    );

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

    const otp =
      generateOtp();

    await prisma.passwordResetToken.deleteMany(
      {
        where: {
          userId: user.id,
        },
      }
    );

    await prisma.passwordResetToken.create(
      {
        data: {
          userId: user.id,

          token:
            await hashPassword(
              otp
            ),

          expiresAt:
            new Date(
              Date.now() +
              1000 *
              60 *
              10
            ),
        },
      }
    );

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
        "Invalid OTP"
      );
    }

    const resetToken =
      await prisma.passwordResetToken.findFirst(
        {
          where: {
            userId: user.id,
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

    const isValid =
      await verifyPassword(
        otp,
        resetToken.token
      );

    if (!isValid) {
      throw new Error(
        "Invalid OTP"
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

    await prisma.passwordResetToken.deleteMany(
      {
        where: {
          userId: user.id,
        },
      }
    );

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
    token: string
  ) {
    try {
      const ticket =
        await googleClient.verifyIdToken({
          idToken: token,
          audience:
            env.GOOGLE_CLIENT_ID,
        });

      const payload =
        ticket.getPayload();

      if (!payload?.email) {
        throw new Error(
          "Invalid Google ID Token"
        );
      }

      return this.handleGoogleUser({
        email:
          payload.email,

        picture:
          payload.picture,

        name:
          payload.name,
      });
    } catch {
      try {
        const { data } =
          await axios.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        if (!data.email) {
          throw new Error(
            "Google email not found"
          );
        }

        return this.handleGoogleUser({
          email:
            data.email,

          picture:
            data.picture,

          name:
            data.name,
        });
      } catch {
        throw new Error(
          "Invalid Google token"
        );
      }
    }
  }

  private async handleGoogleUser({
    email,
    picture,
    name,
  }: {
    email: string;
    picture?: string;
    name?: string;
  }) {
    const emailLower =
      email.toLowerCase();

    let user =
      await prisma.user.findUnique({
        where: {
          emailLower,
        },
      });

    if (!user) {
      const baseUsername =
        email.split("@")[0];

      let username =
        baseUsername;

      let usernameLower =
        username.toLowerCase();

      let counter = 1;

      while (
        await prisma.user.findUnique({
          where: {
            usernameLower,
          },
        })
      ) {
        username =
          `${baseUsername}${counter}`;

        usernameLower =
          username.toLowerCase();

        counter++;
      }

      user =
        await prisma.$transaction(
          async (tx) => {
            const user =
              await tx.user.create({
                data: {
                  email,
                  emailLower,

                  username,
                  usernameLower,

                  authProvider:
                    "GOOGLE",

                  avatarUrl:
                    picture,

                  emailVerifiedAt:
                    new Date(),
                },
              });

            await tx.profile.create({
              data: {
                userId:
                  user.id,

                fullName:
                  name ??
                  username,
              },
            });

            await tx.notificationSettings.create(
              {
                data: {
                  userId:
                    user.id,
                },
              }
            );

            return user;
          }
        );
    } else {
      user =
        await prisma.user.update({
          where: {
            id: user.id,
          },

          data: {
            avatarUrl:
              user.avatarUrl ??
              picture,

            emailVerifiedAt:
              user.emailVerifiedAt ??
              new Date(),
          },
        });
    }

    const tokens =
      await this.createSession(
        user.id
      );

    return {
      ...tokens,
      user,
    };
  }
  private async createSession(
    userId: string
  ) {
    const session =
      await prisma.session.create({
        data: {
          userId,
          refreshTokenHash: "",
          expiresAt: new Date(
            Date.now() +
            1000 * 60 * 60 * 24 * 30
          ),
        },
      });

    const accessToken =
      signAccessToken(userId);

    const refreshToken =
      signRefreshToken(session.id);

    await prisma.session.update({
      where: { id: session.id },
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
    };
  }
}

export const authService =
  new AuthService();