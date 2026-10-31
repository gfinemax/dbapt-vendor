import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("올바른 이메일 주소를 입력해 주세요."),
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
  next: z.string().optional(),
});
