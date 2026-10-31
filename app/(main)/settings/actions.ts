"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getActor } from "@/lib/supabase/actor";

const roleSchema = z.enum(["admin", "executive", "staff", "agent", "viewer"]);
const inviteSchema = z.object({ email: z.string().email("이메일을 확인해 줘."), name: z.string().trim().min(1, "이름을 입력해 줘.").max(80), role: roleSchema });
const userUpdateSchema = z.object({ id: z.string().uuid(), role: roleSchema, active: z.boolean() });
const assignmentSchema = z.object({ project_id: z.string().uuid(), user_id: z.string().uuid(), assigned: z.boolean() });

export type SettingsActionResult = { ok: boolean; message: string };

async function requireAdmin() {
  const actor = await getActor();
  if (actor.error || !actor.supabase || !actor.userId || actor.role !== "admin") return { error: "관리자 권한이 필요해.", actor: null } as const;
  return { error: null, actor } as const;
}

export async function inviteUser(input: { email: string; name: string; role: string }): Promise<SettingsActionResult> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "초대 정보를 확인해 줘." };
  const access = await requireAdmin();
  if (!access.actor) return { ok: false, message: access.error };
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY를 서버 환경 변수에 설정해야 초대할 수 있어." };
  const value = parsed.data;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(value.email, { data: { name: value.name } });
  if (error || !data.user) return { ok: false, message: error?.message ?? "초대 메일을 보내지 못했어." };
  const { error: profileError } = await access.actor.supabase.from("users").insert({ id: data.user.id, email: value.email.toLowerCase(), name: value.name, role: value.role, active: true, created_by: access.actor.userId });
  if (profileError) { await admin.auth.admin.deleteUser(data.user.id); return { ok: false, message: "사용자 프로필을 만들지 못해 초대를 취소했어." }; }
  revalidatePath("/settings");
  return { ok: true, message: `${value.email}로 초대 메일을 보냈어.` };
}

export async function updateUserAccess(input: { id: string; role: string; active: boolean }): Promise<SettingsActionResult> {
  const parsed = userUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "사용자 권한을 확인해 줘." };
  const access = await requireAdmin();
  if (!access.actor) return { ok: false, message: access.error };
  if (parsed.data.id === access.actor.userId && !parsed.data.active) return { ok: false, message: "현재 로그인한 관리자 계정은 비활성화할 수 없어." };
  const { error } = await access.actor.supabase.from("users").update({ role: parsed.data.role, active: parsed.data.active }).eq("id", parsed.data.id).is("deleted_at", null);
  if (error) return { ok: false, message: "사용자 권한을 저장하지 못했어." };
  revalidatePath("/settings");
  return { ok: true, message: "사용자 역할과 활성 상태를 반영했어." };
}

export async function setProjectAssignment(input: { project_id: string; user_id: string; assigned: boolean }): Promise<SettingsActionResult> {
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "담당자 배정 정보를 확인해 줘." };
  const access = await requireAdmin();
  if (!access.actor) return { ok: false, message: access.error };
  const value = parsed.data;
  const { data: existing } = await access.actor.supabase.from("project_assignees").select("id,deleted_at").eq("project_id", value.project_id).eq("user_id", value.user_id).maybeSingle();
  const { error } = existing
    ? await access.actor.supabase.from("project_assignees").update({ deleted_at: value.assigned ? null : new Date().toISOString() }).eq("id", existing.id)
    : value.assigned
      ? await access.actor.supabase.from("project_assignees").insert({ project_id: value.project_id, user_id: value.user_id, created_by: access.actor.userId })
      : { error: null };
  if (error) return { ok: false, message: "담당자 배정을 저장하지 못했어." };
  revalidatePath("/settings");
  return { ok: true, message: value.assigned ? "용역 담당자로 배정했어." : "용역 담당자 배정을 해제했어." };
}
