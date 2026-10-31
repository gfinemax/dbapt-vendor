"use server";

import { revalidatePath } from "next/cache";

import { getActor } from "@/lib/supabase/actor";
import { actionStatusSchema, meetingDocumentSchema, meetingSchema, type ActionStatusInput, type MeetingDocumentInput, type MeetingInput } from "@/lib/validators/meeting";

export type MeetingActionResult = { ok: boolean; message: string; id?: string };

function databaseMessage(message: string) {
  if (message.includes("권한")) return "협의록을 변경할 권한이 없어.";
  if (message.includes("참여 업체")) return "이 용역 건에 연결된 업체만 선택할 수 있어.";
  if (message.includes("담당자")) return "후속조치 담당자를 확인해 줘.";
  return "저장 중 오류가 발생했어. 입력 내용과 권한을 확인해 줘.";
}

export async function createMeeting(input: MeetingInput): Promise<MeetingActionResult> {
  const parsed = meetingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "협의록 내용을 확인해 줘." };
  const actor = await getActor();
  if (actor.error || !actor.supabase) return { ok: false, message: actor.error ?? "로그인이 필요해." };
  if (!(["admin", "staff", "agent"] as string[]).includes(actor.role ?? "")) return { ok: false, message: "협의록을 등록할 권한이 없어." };
  const value = parsed.data;
  const heldAt = new Date(`${value.held_at}:00+09:00`).toISOString();
  const { data, error } = await actor.supabase.rpc("create_meeting_with_actions", {
    project_id_value: value.project_id,
    vendor_id_value: value.vendor_id || null,
    held_at_value: heldAt,
    method_value: value.method,
    attendees_union_value: value.attendees_union,
    attendees_vendor_value: value.attendees_vendor,
    agenda_value: value.agenda,
    notes_value: value.notes,
    decisions_value: value.decisions,
    action_rows: value.actions,
  });
  if (error || !data) return { ok: false, message: databaseMessage(error?.message ?? "") };
  revalidatePath("/meetings"); revalidatePath(`/projects/${value.project_id}`);
  return { ok: true, id: data, message: "협의록과 후속조치를 등록했어." };
}

export async function createMeetingDocument(input: MeetingDocumentInput): Promise<MeetingActionResult> {
  const parsed = meetingDocumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "파일 정보를 확인해 줘." };
  const actor = await getActor();
  if (actor.error || !actor.supabase || !actor.userId) return { ok: false, message: actor.error ?? "로그인이 필요해." };
  const value = parsed.data;
  const { data: latest } = await actor.supabase.from("documents").select("version").eq("owner_type", "meeting").eq("owner_id", value.meeting_id).eq("kind", "회의자료").is("deleted_at", null).order("version", { ascending: false }).limit(1).maybeSingle();
  const { error } = await actor.supabase.from("documents").insert({ owner_type: "meeting", owner_id: value.meeting_id, kind: "회의자료", file_path: value.file_path, file_name: value.file_name, version: (latest?.version ?? 0) + 1, created_by: actor.userId });
  if (error) return { ok: false, message: databaseMessage(error.message) };
  revalidatePath(`/meetings/${value.meeting_id}`); revalidatePath(`/projects/${value.project_id}`);
  return { ok: true, message: "회의 자료를 첨부했어." };
}

export async function setActionComplete(input: ActionStatusInput): Promise<MeetingActionResult> {
  const parsed = actionStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "후속조치 정보를 확인해 줘." };
  const actor = await getActor();
  if (actor.error || !actor.supabase) return { ok: false, message: actor.error ?? "로그인이 필요해." };
  const value = parsed.data;
  const { error } = await actor.supabase.from("action_items").update({ status: value.complete ? "완료" : "예정" }).eq("id", value.id).eq("meeting_id", value.meeting_id).is("deleted_at", null);
  if (error) return { ok: false, message: databaseMessage(error.message) };
  revalidatePath(`/meetings/${value.meeting_id}`); revalidatePath(`/projects/${value.project_id}`); revalidatePath("/schedule");
  return { ok: true, message: value.complete ? "후속조치를 완료 처리했어." : "후속조치를 다시 예정으로 바꿨어." };
}
