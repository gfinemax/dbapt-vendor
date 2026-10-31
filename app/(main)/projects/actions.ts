"use server";

import { revalidatePath } from "next/cache";

import { getActor } from "@/lib/supabase/actor";
import {
  quoteDocumentSchema,
  quoteSchema,
  selectionSchema,
  type QuoteDocumentInput,
  type QuoteInput,
  type SelectionInput,
} from "@/lib/validators/quote";

export type ProjectActionResult = {
  ok: boolean;
  message: string;
  id?: string;
  version?: number;
};

function databaseMessage(message: string) {
  if (message.includes("quotes_active_version_uidx"))
    return "같은 버전의 견적이 먼저 등록됐어. 다시 시도해 줘.";
  if (message.includes("업체 선정 승인 권한")) return "업체 선정 승인 권한이 없어.";
  return "저장 중 오류가 발생했어. 입력 내용과 권한을 확인해 줘.";
}

export async function createQuote(input: QuoteInput): Promise<ProjectActionResult> {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "견적 내용을 확인해 줘." };

  const actor = await getActor();
  if (actor.error || !actor.supabase || !actor.userId)
    return { ok: false, message: actor.error ?? "로그인이 필요해." };
  if (!(["admin", "staff", "agent"] as const).includes(actor.role as "admin" | "staff" | "agent")) {
    return { ok: false, message: "견적을 등록할 권한이 없어." };
  }

  const values = parsed.data;
  const insert = async () => {
    const { data: latest } = await actor.supabase
      .from("quotes")
      .select("version")
      .eq("project_id", values.project_id)
      .eq("vendor_id", values.vendor_id)
      .is("deleted_at", null)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const version = (latest?.version ?? 0) + 1;
    const { data, error } = await actor.supabase
      .from("quotes")
      .insert({
        project_id: values.project_id,
        vendor_id: values.vendor_id,
        version,
        received_at: values.received_at,
        amount: values.amount,
        vat_included: values.vat_included,
        duration_days: values.duration_days,
        warranty_months: values.warranty_months,
        payment_terms: values.payment_terms,
        items: values.items,
        note: values.note || null,
        created_by: actor.userId,
      })
      .select("id,version")
      .single();
    return { data, error };
  };

  let result = await insert();
  if (result.error?.code === "23505") result = await insert();
  if (result.error || !result.data)
    return { ok: false, message: databaseMessage(result.error?.message ?? "") };

  revalidatePath(`/projects/${values.project_id}`);
  revalidatePath("/projects");
  revalidatePath("/quotes");
  return {
    ok: true,
    message: `견적 v${result.data.version}을 등록했어.`,
    id: result.data.id,
    version: result.data.version,
  };
}

export async function createQuoteDocument(input: QuoteDocumentInput): Promise<ProjectActionResult> {
  const parsed = quoteDocumentSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "파일 정보를 확인해 줘." };

  const actor = await getActor();
  if (actor.error || !actor.supabase || !actor.userId)
    return { ok: false, message: actor.error ?? "로그인이 필요해." };
  const values = parsed.data;
  const { data: latest } = await actor.supabase
    .from("documents")
    .select("version")
    .eq("owner_type", "quote")
    .eq("owner_id", values.quote_id)
    .eq("kind", "견적서")
    .is("deleted_at", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await actor.supabase.from("documents").insert({
    owner_type: "quote",
    owner_id: values.quote_id,
    kind: "견적서",
    file_path: values.file_path,
    file_name: values.file_name,
    mime_type: values.mime_type || null,
    file_size: values.file_size,
    version: (latest?.version ?? 0) + 1,
    created_by: actor.userId,
  }).select("id").single();
  if (error || !data) return { ok: false, message: databaseMessage(error?.message ?? "") };
  revalidatePath(`/projects/${values.project_id}`);
  return { ok: true, id: data.id, message: "견적서를 첨부했어." };
}

export async function selectProjectVendor(input: SelectionInput): Promise<ProjectActionResult> {
  const parsed = selectionSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "선정 내용을 확인해 줘." };

  const actor = await getActor();
  if (actor.error || !actor.supabase)
    return { ok: false, message: actor.error ?? "로그인이 필요해." };
  if (actor.role !== "admin" && actor.role !== "staff")
    return { ok: false, message: "선정 승인안을 요청할 권한이 없어." };

  const values = parsed.data;
  const { data, error } = await actor.supabase.rpc("request_vendor_selection", {
    target_project_id: values.project_id,
    target_vendor_id: values.vendor_id,
    selection_reason_value: values.selection_reason,
    board_resolution_value: values.board_resolution,
  });
  if (error) return { ok: false, message: databaseMessage(error.message) };

  revalidatePath(`/projects/${values.project_id}`);
  revalidatePath("/projects");
  revalidatePath("/quotes");
  revalidatePath("/vendors");
  return { ok: true, id: data ?? undefined, message: "업체 선정 승인요청을 등록했어." };
}
