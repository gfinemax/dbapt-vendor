"use server";

import { revalidatePath } from "next/cache";

import { getActor } from "@/lib/supabase/actor";
import {
  contractDocumentSchema,
  contractSchema,
  guaranteeSchema,
  paymentUpdateSchema,
  type ContractDocumentInput,
  type ContractInput,
  type GuaranteeInput,
  type PaymentUpdateInput,
} from "@/lib/validators/contract";

export type ContractActionResult = { ok: boolean; message: string; id?: string };

function databaseMessage(message: string) {
  if (message.includes("권한")) return "계약 정보를 변경할 권한이 없어.";
  if (message.includes("참여 업체")) return "이 용역 건에 연결된 업체만 선택할 수 있어.";
  if (message.includes("원계약")) return "원계약 연결 정보를 확인해 줘.";
  return "저장 중 오류가 발생했어. 입력 내용과 권한을 확인해 줘.";
}

export async function createContract(input: ContractInput): Promise<ContractActionResult> {
  const parsed = contractSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "계약 내용을 확인해 줘." };
  const actor = await getActor();
  if (actor.error || !actor.supabase)
    return { ok: false, message: actor.error ?? "로그인이 필요해." };
  if (!(["admin", "staff", "agent"] as string[]).includes(actor.role ?? ""))
    return { ok: false, message: "계약을 등록할 권한이 없어." };

  const value = parsed.data;
  const { data, error } = await actor.supabase.rpc("create_contract_with_payments", {
    project_id_value: value.project_id,
    vendor_id_value: value.vendor_id,
    title_value: value.title,
    signed_at_value: value.signed_at,
    start_at_value: value.start_at,
    end_at_value: value.end_at,
    amount_value: value.amount,
    vat_value: value.vat,
    contract_party_value: value.contract_party,
    original_location_value: value.original_location,
    is_sealed_value: value.is_sealed,
    parent_contract_id_value: value.parent_contract_id ?? undefined,
    change_reason_value: value.change_reason || undefined,
    payment_rows: value.payments,
  });
  if (error || !data) return { ok: false, message: databaseMessage(error?.message ?? "") };
  revalidatePath("/contracts");
  revalidatePath(`/projects/${value.project_id}`);
  const draft = actor.role === "agent";
  return {
    ok: true,
    id: data,
    message: draft
      ? value.parent_contract_id
        ? "변경계약 초안을 저장했어. 사무국 검토 후 승인요청할 수 있어."
        : "계약 초안을 저장했어. 사무국 검토 후 승인요청할 수 있어."
      : value.parent_contract_id
        ? "변경계약 승인요청을 등록했어."
        : "계약과 지급 회차 승인요청을 등록했어.",
  };
}

export async function submitContractApproval(
  targetType: "contract" | "contract_amendment",
  targetId: string,
): Promise<ContractActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
    return { ok: false, message: "계약 정보를 확인해 줘." };
  }
  const actor = await getActor();
  if (actor.error || !actor.supabase) {
    return { ok: false, message: actor.error ?? "로그인이 필요해." };
  }
  if (actor.role !== "admin" && actor.role !== "staff") {
    return { ok: false, message: "계약 승인요청 권한이 없어." };
  }
  const { data, error } = await actor.supabase.rpc("submit_contract_approval", {
    target_type_value: targetType,
    target_id_value: targetId,
  });
  if (error || !data) {
    return { ok: false, message: databaseMessage(error?.message ?? "") };
  }
  revalidatePath("/approvals");
  revalidatePath("/contracts", "layout");
  return { ok: true, id: data, message: "승인요청을 등록했어." };
}

export async function createContractDocument(
  input: ContractDocumentInput,
): Promise<ContractActionResult> {
  const parsed = contractDocumentSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "파일 정보를 확인해 줘." };
  const actor = await getActor();
  if (actor.error || !actor.supabase || !actor.userId)
    return { ok: false, message: actor.error ?? "로그인이 필요해." };
  const value = parsed.data;
  const { data: latest } = await actor.supabase
    .from("documents")
    .select("version")
    .eq("owner_type", "contract")
    .eq("owner_id", value.contract_id)
    .eq("kind", value.kind)
    .is("deleted_at", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await actor.supabase
    .from("documents")
    .insert({
      owner_type: "contract",
      owner_id: value.contract_id,
      kind: value.kind,
      file_path: value.file_path,
      file_name: value.file_name,
      mime_type: value.mime_type || null,
      file_size: value.file_size,
      version: (latest?.version ?? 0) + 1,
      created_by: actor.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: databaseMessage(error?.message ?? "") };
  revalidatePath(`/contracts/${value.contract_id}`);
  revalidatePath(`/projects/${value.project_id}`);
  return { ok: true, id: data.id, message: `${value.kind}을 첨부했어.` };
}

export async function updatePayment(input: PaymentUpdateInput): Promise<ContractActionResult> {
  const parsed = paymentUpdateSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "지급 정보를 확인해 줘." };
  const actor = await getActor();
  if (actor.error || !actor.supabase)
    return { ok: false, message: actor.error ?? "로그인이 필요해." };
  const value = parsed.data;
  const { error } = await actor.supabase
    .from("payment_schedules")
    .update({ paid_at: value.paid_at || null, settlement_status: value.settlement_status })
    .eq("id", value.id)
    .eq("contract_id", value.contract_id)
    .is("deleted_at", null);
  if (error) return { ok: false, message: databaseMessage(error.message) };
  revalidatePath(`/contracts/${value.contract_id}`);
  revalidatePath(`/projects/${value.project_id}`);
  revalidatePath("/contracts");
  return { ok: true, message: "지급·정산 상태를 반영했어." };
}

export async function createGuarantee(input: GuaranteeInput): Promise<ContractActionResult> {
  const parsed = guaranteeSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "보증 내용을 확인해 줘." };
  const actor = await getActor();
  if (actor.error || !actor.supabase || !actor.userId)
    return { ok: false, message: actor.error ?? "로그인이 필요해." };
  const value = parsed.data;
  const { data, error } = await actor.supabase
    .from("guarantees")
    .insert({
      contract_id: value.contract_id,
      type: value.type,
      issuer: value.issuer || null,
      amount: value.amount,
      starts_at: value.starts_at,
      expires_at: value.expires_at,
      created_by: actor.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: databaseMessage(error?.message ?? "") };
  revalidatePath(`/contracts/${value.contract_id}`);
  revalidatePath(`/projects/${value.project_id}`);
  return { ok: true, id: data.id, message: "보증증권을 등록했어." };
}
