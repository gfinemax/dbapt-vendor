"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  decryptGoogleRefreshToken,
  getGoogleContactsConfig,
  refreshGoogleAccessToken,
  syncGoogleContact,
} from "@/lib/google/contacts";
import { getActor } from "@/lib/supabase/actor";

const databaseUuid = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
);
const syncSchema = z.object({ contactId: databaseUuid, vendorId: databaseUuid });

export type GoogleContactSyncResult = { ok: boolean; message: string };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "알 수 없는 오류";
}

export async function syncVendorContactToGoogle(input: {
  contactId: string;
  vendorId: string;
}): Promise<GoogleContactSyncResult> {
  const parsed = syncSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "담당자 정보를 확인해 줘." };

  const actor = await getActor();
  if (actor.error || !actor.supabase || !actor.userId || actor.role !== "admin") {
    return { ok: false, message: "관리자 권한이 필요해." };
  }
  if (!getGoogleContactsConfig()) {
    return { ok: false, message: "설정에서 Google OAuth 환경 구성을 먼저 완료해 줘." };
  }

  const { contactId, vendorId } = parsed.data;
  const [connectionResult, contactResult, vendorResult, currentSyncResult] = await Promise.all([
    actor.supabase
      .from("google_contact_connections")
      .select("id,refresh_token_ciphertext,refresh_token_iv,refresh_token_tag")
      .is("deleted_at", null)
      .maybeSingle(),
    actor.supabase
      .from("vendor_contacts")
      .select("id,vendor_id,name,phone,email,title,duty,active")
      .eq("id", contactId)
      .eq("vendor_id", vendorId)
      .is("deleted_at", null)
      .maybeSingle(),
    actor.supabase
      .from("vendors")
      .select("id,name,category")
      .eq("id", vendorId)
      .is("deleted_at", null)
      .maybeSingle(),
    actor.supabase
      .from("google_contact_syncs")
      .select("id,google_resource_name")
      .eq("vendor_contact_id", contactId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  if (!connectionResult.data) return { ok: false, message: "설정에서 Google 계정을 먼저 연결해 줘." };
  if (!contactResult.data || !vendorResult.data) return { ok: false, message: "담당자 또는 업체 정보를 찾지 못했어." };
  if (!contactResult.data.active) return { ok: false, message: "비활성 담당자는 동기화할 수 없어." };

  let syncId = currentSyncResult.data?.id;
  if (syncId) {
    const { error } = await actor.supabase
      .from("google_contact_syncs")
      .update({ sync_status: "pending", last_error: null })
      .eq("id", syncId);
    if (error) return { ok: false, message: "동기화 상태를 준비하지 못했어." };
  } else {
    const { data, error } = await actor.supabase
      .from("google_contact_syncs")
      .insert({ vendor_contact_id: contactId, sync_status: "pending", created_by: actor.userId })
      .select("id")
      .single();
    if (error || !data) return { ok: false, message: "동기화 상태를 준비하지 못했어." };
    syncId = data.id;
  }

  try {
    const refreshToken = decryptGoogleRefreshToken({
      ciphertext: connectionResult.data.refresh_token_ciphertext,
      iv: connectionResult.data.refresh_token_iv,
      tag: connectionResult.data.refresh_token_tag,
    });
    const accessToken = await refreshGoogleAccessToken(refreshToken);
    const googleContact = await syncGoogleContact({
      accessToken,
      resourceName: currentSyncResult.data?.google_resource_name,
      contact: {
        name: contactResult.data.name,
        phone: contactResult.data.phone,
        email: contactResult.data.email,
        title: contactResult.data.title,
        duty: contactResult.data.duty,
        vendorName: vendorResult.data.name,
        vendorCategory: vendorResult.data.category,
      },
    });
    const now = new Date().toISOString();
    const { error } = await actor.supabase
      .from("google_contact_syncs")
      .update({
        google_resource_name: googleContact.resourceName,
        google_etag: googleContact.etag,
        sync_status: "synced",
        last_synced_at: now,
        last_error: null,
      })
      .eq("id", syncId);
    if (error) throw new Error("Google 동기화 결과를 저장하지 못했어.");
    await actor.supabase
      .from("google_contact_connections")
      .update({ last_verified_at: now })
      .eq("id", connectionResult.data.id);
    revalidatePath(`/vendors/${vendorId}`);
    return { ok: true, message: `${contactResult.data.name} 담당자를 Google 연락처에 반영했어.` };
  } catch (error) {
    const detail = errorMessage(error);
    await actor.supabase
      .from("google_contact_syncs")
      .update({ sync_status: "failed", last_error: detail })
      .eq("id", syncId);
    revalidatePath(`/vendors/${vendorId}`);
    return { ok: false, message: `Google 연락처 동기화에 실패했어. ${detail}` };
  }
}

export async function syncVendorContactFromForm(
  contactId: string,
  vendorId: string,
): Promise<void> {
  const parsed = syncSchema.safeParse({ contactId, vendorId });
  if (!parsed.success) redirect("/vendors?googleSync=failed");

  const result = await syncVendorContactToGoogle(parsed.data);
  redirect(`/vendors/${parsed.data.vendorId}?googleSync=${result.ok ? "synced" : "failed"}`);
}
