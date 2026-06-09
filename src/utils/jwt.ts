import { sign, type Secret, type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

const accessTokenOptions: SignOptions = {
  expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as SignOptions["expiresIn"],
};

const refreshTokenOptions: SignOptions = {
  expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as SignOptions["expiresIn"],
};

const accessTokenSecret: Secret = env.JWT_ACCESS_SECRET;
const refreshTokenSecret: Secret = env.JWT_REFRESH_SECRET;

export const signAccessToken = (userId: string) => {
  return sign(
    { sub: userId },
    accessTokenSecret,
    accessTokenOptions
  );
};

export const signRefreshToken = (sessionId: string) => {
  return sign(
    { sid: sessionId },
    refreshTokenSecret,
    refreshTokenOptions
  );
};