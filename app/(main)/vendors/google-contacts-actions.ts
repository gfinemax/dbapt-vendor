"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  decryptGoogleRefreshToken,
  getGoogleContact,
  getGoogleContactsConfig,
  listGoogleContacts,
  refreshGoogleAccessToken,
  type GoogleContactSummary,
} from "@/lib/google/contacts";
import { getActor } from "@/lib/supabase/actor";
import { vendorContactSchema } from "@/lib/validators/vendor";

const databaseUuid = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
);
const googleResourceName = z.string().regex(/^people\/[A-Za-z0-9_-]+$/);
const importSchema = z.object({ vendorId: databaseUuid, resourceName: googleResourceName });

export type GoogleContactListItem = GoogleContactSummary & { imported: boolean };
export type GoogleContactListResult = {
  ok: boolean;
  message: string;
  contacts: GoogleContactListItem[];
};
export type GoogleContactImportResult = { ok: boolean; message: string };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "알 수 없는 오류";
}

async function getGoogleAccess(actor: Awaited<ReturnType<typeof getActor>>) {
  if (actor.error || !actor.supabase || !actor.userId || actor.role !== "admin") {
    throw new Error("관리자 권한이 필요해.");
  }
  if (!getGoogleContactsConfig()) {
    throw new Error("설정에서 Google OAuth 환경 구성을 먼저 완료해 줘.");
  }

  const { data: connection, error } = await actor.supabase
    .from("google_contact_connections")
    .select("id,refresh_token_ciphertext,refresh_token_iv,refresh_token_tag")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error("Google 계정 연결 정보를 확인하지 못했어.");
  if (!connection) throw new Error("설정에서 Google 계정을 먼저 연결해 줘.");

  const refreshToken = decryptGoogleRefreshToken({
    ciphertext: connection.refresh_token_ciphertext,
    iv: connection.refresh_token_iv,
    tag: connection.refresh_token_tag,
  });
  const accessToken = await refreshGoogleAccessToken(refreshToken);
  return { accessToken, connectionId: connection.id };
}

export async function listGoogleContactsForImport(): Promise<GoogleContactListResult> {
  const actor = await getActor();

  try {
    const { accessToken, connectionId } = await getGoogleAccess(actor);
    if (!actor.supabase) throw new Error("로그인이 필요해.");

    const [contacts, mappingsResult] = await Promise.all([
      listGoogleContacts(accessToken),
      actor.supabase
        .from("google_contact_syncs")
        .select("google_resource_name")
        .not("google_resource_name", "is", null)
        .is("deleted_at", null),
    ]);
    if (mappingsResult.error) throw new Error("가져온 연락처의 등록 여부를 확인하지 못했어.");

    const importedResources = new Set(
      (mappingsResult.data ?? []).flatMap((mapping) =>
        mapping.google_resource_name ? [mapping.google_resource_name] : [],
      ),
    );
    const now = new Date().toISOString();
    await actor.supabase
      .from("google_contact_connections")
      .update({ last_verified_at: now })
      .eq("id", connectionId);

    return {
      ok: true,
      message: `Google 연락처 ${contacts.length}건을 불러왔어.`,
      contacts: contacts.map((contact) => ({
        ...contact,
        imported: importedResources.has(contact.resourceName),
      })),
    };
  } catch (error) {
    return {
      ok: false,
      message: `Google 연락처를 불러오지 못했어. ${errorMessage(error)}`,
      contacts: [],
    };
  }
}

export async function importGoogleContact(input: {
  vendorId: string;
  resourceName: string;
}): Promise<GoogleContactImportResult> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "업체 또는 Google 연락처 정보를 확인해 줘." };

  const actor = await getActor();
  try {
    const { accessToken, connectionId } = await getGoogleAccess(actor);
    if (!actor.supabase || !actor.userId) throw new Error("로그인이 필요해.");

    const { vendorId, resourceName } = parsed.data;
    const [vendorResult, mappingResult] = await Promise.all([
      actor.supabase
        .from("vendors")
        .select("id")
        .eq("id", vendorId)
        .is("deleted_at", null)
        .maybeSingle(),
      actor.supabase
        .from("google_contact_syncs")
        .select("id")
        .eq("google_resource_name", resourceName)
        .is("deleted_at", null)
        .maybeSingle(),
    ]);
    if (!vendorResult.data) throw new Error("업체 정보를 찾지 못했어.");
    if (mappingResult.data) return { ok: false, message: "이미 DB-Vendor에 등록된 Google 연락처야." };

    const googleContact = await getGoogleContact(accessToken, resourceName);
    const name =
      googleContact.name ||
      googleContact.organization ||
      googleContact.email ||
      googleContact.phone ||
      "이름 미등록";
    const localContact = vendorContactSchema.safeParse({
      vendor_id: vendorId,
      name: name.slice(0, 50),
      title: (googleContact.title ?? "").slice(0, 50),
      phone: (googleContact.phone ?? "").slice(0, 30),
      email: googleContact.email ?? "",
      duty: (googleContact.department ?? "").slice(0, 100),
      is_primary: false,
      active: true,
    });
    if (!localContact.success) {
      throw new Error(localContact.error.issues[0]?.message ?? "Google 연락처 값이 올바르지 않아.");
    }

    const { data: insertedContact, error: contactError } = await actor.supabase
      .from("vendor_contacts")
      .insert({
        vendor_id: localContact.data.vendor_id,
        name: localContact.data.name,
        title: localContact.data.title || null,
        phone: localContact.data.phone || null,
        email: localContact.data.email || null,
        duty: localContact.data.duty || null,
        is_primary: false,
        active: true,
        created_by: actor.userId,
      })
      .select("id")
      .single();
    if (contactError || !insertedContact) throw new Error("DB-Vendor 담당자를 만들지 못했어.");

    const now = new Date().toISOString();
    const { error: mappingError } = await actor.supabase.from("google_contact_syncs").insert({
      vendor_contact_id: insertedContact.id,
      google_resource_name: googleContact.resourceName,
      google_etag: googleContact.etag,
      sync_status: "synced",
      last_synced_at: now,
      last_error: null,
      created_by: actor.userId,
    });
    if (mappingError) {
      await actor.supabase
        .from("vendor_contacts")
        .update({ active: false, deleted_at: now })
        .eq("id", insertedContact.id);
      if (mappingError.message.includes("google_contact_syncs_active_resource_uidx")) {
        return { ok: false, message: "이미 DB-Vendor에 등록된 Google 연락처야." };
      }
      throw new Error("Google 연락처와 담당자의 연결 정보를 저장하지 못했어.");
    }

    await actor.supabase
      .from("google_contact_connections")
      .update({ last_verified_at: now })
      .eq("id", connectionId);
    revalidatePath(`/vendors/${vendorId}`);
    revalidatePath("/vendors");
    return { ok: true, message: `${localContact.data.name} 연락처를 DB-Vendor로 가져왔어.` };
  } catch (error) {
    return { ok: false, message: `Google 연락처 가져오기에 실패했어. ${errorMessage(error)}` };
  }
}
