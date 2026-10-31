"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  contactLogSchema,
  documentMetadataSchema,
  vendorContactSchema,
  vendorSchema,
  type ContactLogInput,
  type DocumentMetadataInput,
  type VendorContactInput,
  type VendorInput,
} from "@/lib/validators/vendor";

export type VendorActionResult = {
  ok: boolean;
  message: string;
  id?: string;
};

function nullable(value: string | undefined) {
  return value?.trim() ? value.trim() : null;
}

async function getActor() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string") {
    return { error: "로그인이 필요해.", supabase: null, userId: null, role: null } as const;
  }

  const { data: role, error: roleError } = await supabase.rpc("current_role");
  if (roleError || !role) {
    return {
      error: "사용자 권한을 확인할 수 없어.",
      supabase: null,
      userId: null,
      role: null,
    } as const;
  }

  return { error: null, supabase, userId, role } as const;
}

function databaseMessage(message: string) {
  if (message.includes("vendors_active_biz_no_uidx")) {
    return "이미 등록된 사업자번호야.";
  }
  if (message.includes("vendor_contacts_one_primary_uidx")) {
    return "주 담당자는 한 명만 지정할 수 있어.";
  }
  return "저장 중 오류가 발생했어. 입력 내용과 권한을 확인해 줘.";
}

export async function saveVendor(input: VendorInput): Promise<VendorActionResult> {
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "입력값을 확인해 줘." };
  }

  const actor = await getActor();
  if (actor.error || !actor.supabase || !actor.userId) {
    return { ok: false, message: actor.error ?? "로그인이 필요해." };
  }
  if (actor.role !== "admin" && actor.role !== "staff") {
    return { ok: false, message: "업체 정보를 저장할 권한이 없어." };
  }

  const values = parsed.data;
  const { data, error } = await actor.supabase.rpc("save_vendor_with_sensitive", {
    vendor_id_value: values.id ?? undefined,
    name_value: values.name,
    biz_no_value: values.biz_no,
    ceo_value: values.ceo,
    address_value: values.address,
    category_value: values.category,
    homepage_value: values.homepage,
    status_value: values.status,
    memo_value: values.memo,
    bank_name_value: values.bank_name,
    bank_account_value: values.bank_account,
    internal_note_value: values.internal_note,
  });
  if (error || !data) return { ok: false, message: databaseMessage(error?.message ?? "") };
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${data}`);
  return { ok: true, message: values.id ? "업체 정보를 수정했어." : "업체를 등록했어.", id: data };
}

export async function saveVendorContact(input: VendorContactInput): Promise<VendorActionResult> {
  const parsed = vendorContactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "입력값을 확인해 줘." };
  }

  const actor = await getActor();
  if (actor.error || !actor.supabase || !actor.userId) {
    return { ok: false, message: actor.error ?? "로그인이 필요해." };
  }

  const values = parsed.data;
  if (values.is_primary) {
    const { error } = await actor.supabase
      .from("vendor_contacts")
      .update({ is_primary: false })
      .eq("vendor_id", values.vendor_id)
      .is("deleted_at", null);
    if (error) return { ok: false, message: databaseMessage(error.message) };
  }

  const payload = {
    vendor_id: values.vendor_id,
    name: values.name,
    title: nullable(values.title),
    phone: nullable(values.phone),
    email: nullable(values.email),
    duty: nullable(values.duty),
    is_primary: values.is_primary,
    active: values.active,
  };

  if (values.id) {
    const { error } = await actor.supabase
      .from("vendor_contacts")
      .update(payload)
      .eq("id", values.id)
      .eq("vendor_id", values.vendor_id)
      .is("deleted_at", null);
    if (error) return { ok: false, message: databaseMessage(error.message) };
  } else {
    const { error } = await actor.supabase
      .from("vendor_contacts")
      .insert({ ...payload, created_by: actor.userId });
    if (error) return { ok: false, message: databaseMessage(error.message) };
  }

  revalidatePath(`/vendors/${values.vendor_id}`);
  revalidatePath("/vendors");
  return { ok: true, message: values.id ? "담당자 정보를 수정했어." : "담당자를 추가했어." };
}

export async function deactivateVendorContact(
  contactId: string,
  vendorId: string,
): Promise<VendorActionResult> {
  const parsed = vendorContactSchema.pick({ id: true, vendor_id: true }).safeParse({
    id: contactId,
    vendor_id: vendorId,
  });
  if (!parsed.success || !parsed.data.id)
    return { ok: false, message: "담당자 정보가 올바르지 않아." };

  const actor = await getActor();
  if (actor.error || !actor.supabase)
    return { ok: false, message: actor.error ?? "로그인이 필요해." };

  const { error } = await actor.supabase
    .from("vendor_contacts")
    .update({ active: false, is_primary: false })
    .eq("id", parsed.data.id)
    .eq("vendor_id", parsed.data.vendor_id)
    .is("deleted_at", null);
  if (error) return { ok: false, message: databaseMessage(error.message) };

  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/vendors");
  return { ok: true, message: "담당자를 비활성 처리했어. 기존 이력은 유지돼." };
}

export async function createContactLog(input: ContactLogInput): Promise<VendorActionResult> {
  const parsed = contactLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "입력값을 확인해 줘." };
  }

  const actor = await getActor();
  if (actor.error || !actor.supabase || !actor.userId) {
    return { ok: false, message: actor.error ?? "로그인이 필요해." };
  }

  const values = parsed.data;
  const { error } = await actor.supabase.from("contact_logs").insert({
    vendor_id: values.vendor_id,
    contact_id: values.contact_id || null,
    method: values.method,
    at: `${values.at}:00+09:00`,
    summary: values.summary,
    created_by: actor.userId,
  });
  if (error) return { ok: false, message: databaseMessage(error.message) };

  revalidatePath(`/vendors/${values.vendor_id}`);
  return { ok: true, message: "연락 이력을 등록했어." };
}

export async function createVendorDocument(
  input: DocumentMetadataInput,
): Promise<VendorActionResult> {
  const parsed = documentMetadataSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "문서 정보를 확인해 줘." };
  }

  const actor = await getActor();
  if (actor.error || !actor.supabase || !actor.userId) {
    return { ok: false, message: actor.error ?? "로그인이 필요해." };
  }

  const values = parsed.data;
  const { data: latest } = await actor.supabase
    .from("documents")
    .select("version")
    .eq("owner_type", "vendor")
    .eq("owner_id", values.owner_id)
    .eq("kind", values.kind)
    .is("deleted_at", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await actor.supabase
    .from("documents")
    .insert({
      owner_type: "vendor",
      owner_id: values.owner_id,
      kind: values.kind,
      file_path: values.file_path,
      file_name: values.file_name,
      version: (latest?.version ?? 0) + 1,
      valid_until: values.valid_until || null,
      created_by: actor.userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: databaseMessage(error.message) };

  revalidatePath(`/vendors/${values.owner_id}`);
  return { ok: true, message: "서류를 등록했어.", id: data.id };
}

export async function getDocumentDownloadUrl(
  documentId: string,
): Promise<VendorActionResult & { url?: string }> {
  if (!/^[-0-9a-f]{36}$/i.test(documentId))
    return { ok: false, message: "문서 정보가 올바르지 않아." };

  const actor = await getActor();
  if (actor.error || !actor.supabase)
    return { ok: false, message: actor.error ?? "로그인이 필요해." };

  const { data: document, error } = await actor.supabase
    .from("documents")
    .select("file_path")
    .eq("id", documentId)
    .is("deleted_at", null)
    .single();
  if (error || !document) return { ok: false, message: "문서를 찾을 수 없거나 권한이 없어." };

  const { data, error: signedError } = await actor.supabase.storage
    .from("vendor-files")
    .createSignedUrl(document.file_path, 60);
  if (signedError) return { ok: false, message: "다운로드 주소를 만들 수 없어." };

  return { ok: true, message: "다운로드 주소를 만들었어.", url: data.signedUrl };
}
