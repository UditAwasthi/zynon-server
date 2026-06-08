import { prisma } from "./config/prisma";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "./config/env";

export interface Context {
  prisma: typeof prisma;
  userId: string | null;
}

export async function createContext(
  req: Request
): Promise<Context> {
  const authHeader =
    req.headers.get("authorization");

  let userId: string | null = null;

  if (
    authHeader &&
    authHeader.startsWith("Bearer ")
  ) {
    const token = authHeader.split(" ")[1];

    try {
      const payload = jwt.verify(
        token,
        env.JWT_ACCESS_SECRET
      ) as JwtPayload;

      userId = payload.sub as string;
    } catch {
      userId = null;
    }
  }

  return {
    prisma,
    userId,
  };
}