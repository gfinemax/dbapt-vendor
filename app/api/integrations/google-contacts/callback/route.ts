import { NextRequest, NextResponse } from "next/server";

import {
  encryptGoogleRefreshToken,
  exchangeGoogleAuthorizationCode,
  getGoogleAccountEmail,
  getGoogleContactsConfig,
} from "@/lib/google/contacts";
import { getActor } from "@/lib/supabase/actor";

export const dynamic = "force-dynamic";

function settingsRedirect(request: NextRequest, status: string) {
  return NextResponse.redirect(new URL(`/settings?google=${status}`, request.url));
}

function clearOAuthState(response: NextResponse) {
  response.cookies.set("google_contacts_oauth_state", "", {
    expires: new Date(0),
    path: "/",
    sameSite: "lax",
  });
  return response;
}

export async function GET(request: NextRequest) {
  const actor = await getActor();
  if (!actor.userId || !actor.supabase || actor.role !== "admin") {
    return settingsRedirect(request, "forbidden");
  }
  if (!getGoogleContactsConfig()) {
    return settingsRedirect(request, "missing-config");
  }

  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("google_contacts_oauth_state")?.value;
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError) return clearOAuthState(settingsRedirect(request, "denied"));
  if (!state || !expectedState || state !== expectedState || !code) {
    return clearOAuthState(settingsRedirect(request, "invalid-state"));
  }

  try {
    const token = await exchangeGoogleAuthorizationCode(code);
    if (!token.refresh_token) {
      return clearOAuthState(settingsRedirect(request, "missing-refresh-token"));
    }

    const [accountEmail, encrypted] = await Promise.all([
      getGoogleAccountEmail(token.access_token),
      Promise.resolve(encryptGoogleRefreshToken(token.refresh_token)),
    ]);
    const scopes = token.scope?.split(" ").filter(Boolean) ?? [];
    const now = new Date().toISOString();
    const { data: current } = await actor.supabase
      .from("google_contact_connections")
      .select("id")
      .is("deleted_at", null)
      .maybeSingle();

    const payload = {
      account_email: accountEmail,
      refresh_token_ciphertext: encrypted.ciphertext,
      refresh_token_iv: encrypted.iv,
      refresh_token_tag: encrypted.tag,
      scopes,
      connected_at: now,
      last_verified_at: now,
      deleted_at: null,
    };
    const { error } = current
      ? await actor.supabase
          .from("google_contact_connections")
          .update(payload)
          .eq("id", current.id)
      : await actor.supabase
          .from("google_contact_connections")
          .insert({ ...payload, created_by: actor.userId });

    if (error) throw error;
    return clearOAuthState(settingsRedirect(request, "connected"));
  } catch (error) {
    console.error("Google Contacts OAuth callback failed", error instanceof Error ? error.message : error);
    return clearOAuthState(settingsRedirect(request, "connection-failed"));
  }
}
