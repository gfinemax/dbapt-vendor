"use server";

import { revalidatePath } from "next/cache";

import { getActor } from "@/lib/supabase/actor";
import { approvalDecisionSchema, type ApprovalDecisionInput } from "@/lib/validators/approval";

export type ApprovalActionResult = { ok: boolean; message: string };

export async function decideApproval(input: ApprovalDecisionInput): Promise<ApprovalActionResult> {
  const parsed = approvalDecisionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "승인 정보를 확인해 줘.",
    };
  }

  const actor = await getActor();
  if (actor.error || !actor.supabase) {
    return { ok: false, message: actor.error ?? "로그인이 필요해." };
  }
  if (actor.role !== "admin" && actor.role !== "executive") {
    return { ok: false, message: "승인·반려 권한이 없어." };
  }

  const { error } = await actor.supabase.rpc("decide_approval", {
    approval_id_value: parsed.data.approval_id,
    decision_value: parsed.data.decision,
    decision_reason_value: parsed.data.reason || undefined,
  });
  if (error) {
    if (error.message.includes("본인이 요청")) {
      return { ok: false, message: "본인이 요청한 건은 직접 승인할 수 없어." };
    }
    return { ok: false, message: "승인 처리 중 오류가 발생했어." };
  }

  revalidatePath("/approvals");
  revalidatePath("/projects");
  revalidatePath("/vendors");
  revalidatePath("/contracts");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: parsed.data.decision === "approved" ? "승인했어." : "반려했어.",
  };
}
