import jwt from "jsonwebtoken";
import { env } from "../config/env";
export const signAccessToken = (
  userId: string
) => {
  return jwt.sign(
    { sub: userId },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
    }
  );
};

export const signRefreshToken = (
  sessionId: string
) => {
  return jwt.sign(
    { sid: sessionId },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
    }
  );
};