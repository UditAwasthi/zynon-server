import bcrypt from "bcrypt";

export const hashPassword = async (
  password: string
) => {
  return bcrypt.hash(password, 12);
};

export const verifyPassword = async (
  password: string,
  hash: string
) => {
  return bcrypt.compare(password, hash);
};