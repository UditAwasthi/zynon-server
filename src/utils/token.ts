import crypto from "crypto";

export const generateToken = () => {
  return crypto.randomBytes(32)
    .toString("hex");
};

export const generateOtp = (
  length = 6
) => {
  const max = 10 ** length;
  return crypto
    .randomInt(0, max)
    .toString()
    .padStart(length, "0");
};