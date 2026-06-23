import {z} from "zod";

export const registerSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.email(),
  password: z.string().min(6),
  fullName: z.string()
    .min(2)
    .max(100),
  dateOfBirth: z.coerce.date(),
});