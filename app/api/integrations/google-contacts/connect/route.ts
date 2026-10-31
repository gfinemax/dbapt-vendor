import { randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createGoogleAuthorizationUrl, getGoogleContactsConfig } from "@/lib/google/contacts";
import { getActor } from "@/lib/supabase/actor";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const actor = await getActor();
  if (!actor.userId || actor.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (!getGoogleContactsConfig()) {
    return NextResponse.redirect(new URL("/settings?google=missing-config", request.url));
  }

  const state = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(createGoogleAuthorizationUrl(state));
  response.cookies.set("google_contacts_oauth_state", state, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
