"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validators/auth";

export type LoginState = {
  message?: string;
};

function getSafeNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "로그인 설정을 확인할 수 없습니다.",
    };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { message: "이메일 또는 비밀번호를 확인해 주세요." };
  }

  redirect(getSafeNextPath(parsed.data.next));
}
