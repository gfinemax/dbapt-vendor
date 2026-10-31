"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActor } from "@/lib/supabase/actor";

const tableSchema = z.enum([
  "business_projects",
  "vendors",
  "vendor_contacts",
  "contact_logs",
  "projects",
  "quotes",
  "contracts",
  "payment_schedules",
  "guarantees",
  "meetings",
  "action_items",
  "events",
  "documents",
]);
const inputSchema = z.object({ table: tableSchema, id: z.string().uuid() });
type TableName = z.infer<typeof tableSchema>;
type Client = NonNullable<Awaited<ReturnType<typeof getActor>>["supabase"]>;

async function updateDeletedAt(
  client: Client,
  table: TableName,
  id: string,
  deletedAt: string | null,
) {
  switch (table) {
    case "business_projects":
      return client
        .from("business_projects")
        .update({ deleted_at: deletedAt })
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "vendors":
      return client
        .from("vendors")
        .update({ deleted_at: deletedAt })
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "vendor_contacts":
      return client
        .from("vendor_contacts")
        .update({ deleted_at: deletedAt })
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "contact_logs":
      return client
        .from("contact_logs")
        .update({ deleted_at: deletedAt })
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "projects":
      return client
        .from("projects")
        .update({ deleted_at: deletedAt })
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "quotes":
      return client
        .from("quotes")
        .update({ deleted_at: deletedAt })
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "contracts":
      return client
        .from("contracts")
        .update({ deleted_at: deletedAt })
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "payment_schedules":
      return client
        .from("payment_schedules")
        .update({ deleted_at: deletedAt })
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "guarantees":
      return client
        .from("guarantees")
        .update({ deleted_at: deletedAt })
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "meetings":
      return client
        .from("meetings")
        .update({ deleted_at: deletedAt })
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "action_items":
      return client
        .from("action_items")
        .update({ deleted_at: deletedAt })
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "events":
      return client
        .from("events")
        .update({ deleted_at: deletedAt })
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "documents":
      return client
        .from("documents")
        .update({ deleted_at: deletedAt })
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
  }
}

async function hardDelete(client: Client, table: TableName, id: string) {
  switch (table) {
    case "business_projects":
      return client
        .from("business_projects")
        .delete()
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "vendors":
      return client
        .from("vendors")
        .delete()
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "vendor_contacts":
      return client
        .from("vendor_contacts")
        .delete()
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "contact_logs":
      return client
        .from("contact_logs")
        .delete()
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "projects":
      return client
        .from("projects")
        .delete()
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "quotes":
      return client
        .from("quotes")
        .delete()
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "contracts":
      return client
        .from("contracts")
        .delete()
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "payment_schedules":
      return client
        .from("payment_schedules")
        .delete()
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "guarantees":
      return client
        .from("guarantees")
        .delete()
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "meetings":
      return client
        .from("meetings")
        .delete()
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "action_items":
      return client
        .from("action_items")
        .delete()
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "events":
      return client
        .from("events")
        .delete()
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
    case "documents":
      return client
        .from("documents")
        .delete()
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
        .maybeSingle();
  }
}

async function adminActor() {
  const actor = await getActor();
  return actor.role === "admin" && actor.supabase ? actor : null;
}

export async function restoreTrashItem(input: { table: string; id: string }) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "복원 대상을 확인해 줘." };
  const actor = await adminActor();
  if (!actor?.supabase) return { ok: false, message: "관리자 권한이 필요해." };
  const { data, error } = await updateDeletedAt(
    actor.supabase,
    parsed.data.table,
    parsed.data.id,
    null,
  );
  if (error) return { ok: false, message: `복원하지 못했어: ${error.message}` };
  if (!data)
    return { ok: false, message: "휴지통에서 복원할 항목을 찾지 못했어." };
  revalidatePath("/settings/trash");
  return { ok: true, message: "항목을 복원했어." };
}

export async function permanentlyDeleteTrashItem(input: {
  table: string;
  id: string;
}) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "삭제 대상을 확인해 줘." };
  const actor = await adminActor();
  if (!actor?.supabase) return { ok: false, message: "관리자 권한이 필요해." };
  let storagePath: string | null = null;
  if (parsed.data.table === "documents") {
    const { data } = await actor.supabase
      .from("documents")
      .select("file_path")
      .eq("id", parsed.data.id)
      .not("deleted_at", "is", null)
      .maybeSingle();
    storagePath = data?.file_path ?? null;
  }
  const { data, error } = await hardDelete(
    actor.supabase,
    parsed.data.table,
    parsed.data.id,
  );
  if (error)
    return {
      ok: false,
      message: `연결된 데이터가 있어 영구 삭제하지 못했어: ${error.message}`,
    };
  if (!data)
    return { ok: false, message: "휴지통에서 영구 삭제할 항목을 찾지 못했어." };
  if (storagePath)
    await actor.supabase.storage.from("vendor-files").remove([storagePath]);
  revalidatePath("/settings/trash");
  return {
    ok: true,
    message: "항목을 영구 삭제했어. 이 작업은 되돌릴 수 없어.",
  };
}
