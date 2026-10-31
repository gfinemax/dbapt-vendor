"use server";

import { revalidatePath } from "next/cache";

import { getActor } from "@/lib/supabase/actor";
import { eventStatusSchema, manualEventSchema, type EventStatusInput, type ManualEventInput } from "@/lib/validators/event";

export type EventActionResult = { ok: boolean; message: string; id?: string };

export async function createManualEvent(input: ManualEventInput): Promise<EventActionResult> {
  const parsed = manualEventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "일정 내용을 확인해 줘." };
  const actor = await getActor();
  if (actor.error || !actor.supabase || !actor.userId) return { ok: false, message: actor.error ?? "로그인이 필요해." };
  if (!(["admin", "staff", "agent"] as string[]).includes(actor.role ?? "")) return { ok: false, message: "일정을 등록할 권한이 없어." };
  const value = parsed.data;
  const { data, error } = await actor.supabase.from("events").insert({ project_id: value.project_id, type: value.type, title: value.title, date: value.date, end_date: value.end_date || null, status: value.status, memo: value.memo || null, created_by: actor.userId }).select("id").single();
  if (error || !data) return { ok: false, message: "일정을 저장하지 못했어. 입력 내용과 권한을 확인해 줘." };
  revalidatePath("/schedule"); revalidatePath(`/projects/${value.project_id}`); revalidatePath("/dashboard");
  return { ok: true, id: data.id, message: "일정을 등록했어." };
}

export async function setEventComplete(input: EventStatusInput): Promise<EventActionResult> {
  const parsed = eventStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "일정 정보를 확인해 줘." };
  const actor = await getActor();
  if (actor.error || !actor.supabase) return { ok: false, message: actor.error ?? "로그인이 필요해." };
  const value = parsed.data;
  const { error } = await actor.supabase.from("events").update({ status: value.complete ? "완료" : "예정" }).eq("id", value.id).eq("project_id", value.project_id).is("deleted_at", null);
  if (error) return { ok: false, message: "일정 상태를 바꾸지 못했어." };
  revalidatePath("/schedule"); revalidatePath(`/projects/${value.project_id}`); revalidatePath("/dashboard");
  return { ok: true, message: value.complete ? "일정을 완료 처리했어." : "일정을 다시 예정으로 바꿨어." };
}
