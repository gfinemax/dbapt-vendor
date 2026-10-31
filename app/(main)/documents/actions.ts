"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { Json } from "@/lib/database.types";
import { getActor } from "@/lib/supabase/actor";
import {
  documentIntakeApplySchema,
  documentRegistrationSchema,
  type DocumentIntakeApplyInput,
  type DocumentRegistrationInput,
} from "@/lib/validators/document";

export type DocumentActionResult = {
  ok: boolean;
  message: string;
  id?: string;
  url?: string;
  fileName?: string;
  mimeType?: string | null;
  fileSize?: number | null;
};

const documentDeleteSchema = z.object({ id: z.string().uuid() });
const documentApplyVendorSchema = z.object({ document_id: z.string().uuid() });

function revalidateOwner(ownerType: string, ownerId: string) {
  if (ownerType === "business_project") revalidatePath(`/business-projects/${ownerId}`);
  if (ownerType === "project") revalidatePath(`/projects/${ownerId}`);
  if (ownerType === "vendor") revalidatePath(`/vendors/${ownerId}`);
  if (ownerType === "quote") revalidatePath("/quotes");
  if (ownerType === "contract") revalidatePath(`/contracts/${ownerId}`);
  if (ownerType === "meeting") revalidatePath(`/meetings/${ownerId}`);
}

export async function registerDocument(
  input: DocumentRegistrationInput,
): Promise<DocumentActionResult> {
  const parsed = documentRegistrationSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "문서 정보를 확인해 줘.",
    };

  const actor = await getActor();
  if (actor.error || !actor.supabase || !actor.userId)
    return { ok: false, message: actor.error ?? "로그인이 필요해." };
  if (!(["admin", "staff", "agent"] as string[]).includes(actor.role ?? ""))
    return { ok: false, message: "문서를 등록할 권한이 없어." };

  const value = parsed.data;
  const { data: latest } = await actor.supabase
    .from("documents")
    .select("version")
    .eq("owner_type", value.owner_type)
    .eq("owner_id", value.owner_id)
    .eq("kind", value.kind)
    .is("deleted_at", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await actor.supabase
    .from("documents")
    .insert({
      owner_type: value.owner_type,
      owner_id: value.owner_id,
      kind: value.kind,
      file_path: value.file_path,
      file_name: value.file_name,
      mime_type: value.mime_type || null,
      file_size: value.file_size,
      valid_until: value.valid_until || null,
      version: (latest?.version ?? 0) + 1,
      created_by: actor.userId,
    })
    .select("id")
    .single();
  if (error || !data)
    return { ok: false, message: "문서 정보를 저장하지 못했어. 권한과 파일 정보를 확인해 줘." };

  revalidateOwner(value.owner_type, value.owner_id);
  return { ok: true, message: "원본 문서를 안전하게 등록했어.", id: data.id };
}

export async function getDocumentAccessUrl(documentId: string): Promise<DocumentActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(documentId))
    return { ok: false, message: "문서 정보가 올바르지 않아." };

  const actor = await getActor();
  if (actor.error || !actor.supabase)
    return { ok: false, message: actor.error ?? "로그인이 필요해." };

  const { data: document, error } = await actor.supabase
    .from("documents")
    .select("file_path,file_name,mime_type,file_size")
    .eq("id", documentId)
    .is("deleted_at", null)
    .single();
  if (error || !document)
    return { ok: false, message: "문서를 찾을 수 없거나 열람 권한이 없어." };

  const { data, error: signedError } = await actor.supabase.storage
    .from("vendor-files")
    .createSignedUrl(document.file_path, 60);
  if (signedError)
    return { ok: false, message: "문서 열람 주소를 만들 수 없어." };

  return {
    ok: true,
    message: "60초 동안 사용할 수 있는 문서 열람 주소를 만들었어.",
    url: data.signedUrl,
    fileName: document.file_name,
    mimeType: document.mime_type,
    fileSize: document.file_size,
  };
}

export async function deleteDocument(input: { id: string }): Promise<DocumentActionResult> {
  const parsed = documentDeleteSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "삭제할 문서 정보가 올바르지 않아." };

  const actor = await getActor();
  if (actor.error || !actor.supabase || !actor.userId)
    return { ok: false, message: actor.error ?? "로그인이 필요해." };
  if (!(["admin", "staff", "agent"] as string[]).includes(actor.role ?? ""))
    return { ok: false, message: "문서를 삭제할 권한이 없어." };

  const { data: document, error: documentError } = await actor.supabase
    .from("documents")
    .select("id,owner_type,owner_id")
    .eq("id", parsed.data.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (documentError || !document)
    return { ok: false, message: "삭제할 문서를 찾을 수 없거나 권한이 없어." };

  const { data: deleted, error } = await actor.supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", document.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error || !deleted)
    return { ok: false, message: "문서를 휴지통으로 옮기지 못했어. 권한을 확인해 줘." };

  revalidateOwner(document.owner_type, document.owner_id);
  revalidatePath("/settings/trash");
  return {
    ok: true,
    message: "문서를 휴지통으로 옮겼어. 원본은 영구 삭제 전까지 보관돼.",
  };
}

export async function applyVendorProfileFromDocument(input: {
  document_id: string;
}): Promise<DocumentActionResult> {
  const parsed = documentApplyVendorSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "반영할 문서 정보가 올바르지 않아." };

  const actor = await getActor();
  if (actor.error || !actor.supabase || !actor.userId)
    return { ok: false, message: actor.error ?? "로그인이 필요해." };
  if (actor.role !== "admin" && actor.role !== "staff")
    return { ok: false, message: "업체 기본정보를 반영할 권한이 없어." };

  const { data, error } = await actor.supabase.rpc(
    "apply_vendor_profile_from_document",
    { document_id_value: parsed.data.document_id },
  );
  if (error || !data) {
    if (error?.message.includes("vendors_active_biz_no_uidx"))
      return { ok: false, message: "추출된 사업자번호가 다른 업체에 이미 등록돼 있어." };
    return {
      ok: false,
      message: error?.message.includes("추출된") || error?.message.includes("반영할")
        ? error.message.replace("습니다.", "어.").replace("주세요.", "줘.")
        : "분석 결과를 업체 기본정보에 반영하지 못했어. 권한과 추출값을 확인해 줘.",
    };
  }

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${data}`);
  return {
    ok: true,
    id: data,
    message: "검토한 분석 결과를 업체 기본정보에 반영했어.",
  };
}

export async function applyDocumentIntake(
  input: DocumentIntakeApplyInput,
): Promise<DocumentActionResult> {
  const parsed = documentIntakeApplySchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "문서 반영 내용을 확인해 줘.",
    };

  const actor = await getActor();
  if (actor.error || !actor.supabase)
    return { ok: false, message: actor.error ?? "로그인이 필요해." };
  if (actor.role !== "admin" && actor.role !== "staff")
    return { ok: false, message: "문서에서 용역건을 등록할 권한이 없어." };

  const value = parsed.data;
  const { data, error } = await actor.supabase.rpc("create_service_case_from_documents", {
    business_project_id_value: value.business_project_id,
    title_value: value.title,
    category_value: value.category,
    description_value: value.description,
    budget_value: value.budget,
    stage_value: value.stage,
    owner_user_id_value: value.owner_user_id || null,
    document_ids_value: value.document_ids,
    quote_rows: value.quotes as unknown as Json,
    contract_rows: value.contracts as unknown as Json,
  });
  if (error || !data)
    return {
      ok: false,
      message: error?.message
        ? `문서 반영에 실패했어: ${error.message}`
        : "문서 반영에 실패했어. 입력값을 확인해 줘.",
    };

  revalidatePath(`/business-projects/${value.business_project_id}`);
  revalidatePath("/projects");
  revalidatePath("/quotes");
  revalidatePath("/contracts");
  revalidatePath("/approvals");
  return {
    ok: true,
    id: data,
    message: "검토한 문서로 용역건과 선택한 견적·계약 초안을 등록했어.",
  };
}
