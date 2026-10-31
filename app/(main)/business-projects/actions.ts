"use server";

import { revalidatePath } from "next/cache";

import { getActor } from "@/lib/supabase/actor";
import {
  businessProjectSchema,
  serviceCaseSchema,
  type BusinessProjectInput,
  type ServiceCaseInput,
} from "@/lib/validators/business-project";

export type BusinessProjectActionResult = {
  ok: boolean;
  message: string;
  id?: string;
};

function canManage(role: string | null) {
  return role === "admin" || role === "staff";
}

export async function createBusinessProject(
  input: BusinessProjectInput,
): Promise<BusinessProjectActionResult> {
  const parsed = businessProjectSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "프로젝트 정보를 확인해 줘.",
    };

  const actor = await getActor();
  if (actor.error || !actor.supabase || !actor.userId)
    return { ok: false, message: actor.error ?? "로그인이 필요해." };
  if (!canManage(actor.role))
    return { ok: false, message: "프로젝트를 등록할 권한이 없어." };

  const { data, error } = await actor.supabase
    .from("business_projects")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: parsed.data.status,
      created_by: actor.userId,
    })
    .select("id")
    .single();
  if (error || !data)
    return {
      ok: false,
      message: "프로젝트를 저장하지 못했어. 입력 내용과 권한을 확인해 줘.",
    };

  revalidatePath("/business-projects");
  return { ok: true, message: "프로젝트를 등록했어.", id: data.id };
}

export async function createServiceCase(
  input: ServiceCaseInput,
): Promise<BusinessProjectActionResult> {
  const parsed = serviceCaseSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "용역 정보를 확인해 줘.",
    };

  const actor = await getActor();
  if (actor.error || !actor.supabase || !actor.userId)
    return { ok: false, message: actor.error ?? "로그인이 필요해." };
  if (!canManage(actor.role))
    return { ok: false, message: "용역건을 등록할 권한이 없어." };

  const values = parsed.data;
  const { data, error } = await actor.supabase
    .from("projects")
    .insert({
      business_project_id: values.business_project_id,
      title: values.title,
      category: values.category,
      description: values.description || null,
      budget: values.budget,
      stage: values.stage,
      owner_user_id: values.owner_user_id || null,
      created_by: actor.userId,
    })
    .select("id")
    .single();
  if (error || !data)
    return {
      ok: false,
      message: "용역건을 저장하지 못했어. 프로젝트와 입력 내용을 확인해 줘.",
    };

  revalidatePath("/business-projects");
  revalidatePath(`/business-projects/${values.business_project_id}`);
  revalidatePath("/projects");
  return { ok: true, message: "프로젝트에 용역건을 추가했어.", id: data.id };
}
