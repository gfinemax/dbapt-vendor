import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/database.types";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/login", "/auth"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

const SESSION_CACHE_HEADERS = ["cache-control", "expires", "pragma"] as const;

function copySessionState(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  SESSION_CACHE_HEADERS.forEach((header) => {
    const value = source.headers.get(header);
    if (value) target.headers.set(header, value);
  });
  return target;
}

function clearInvalidSessionCookies(
  request: NextRequest,
  response: NextResponse,
  supabaseUrl: string,
) {
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const authCookieName = `sb-${projectRef}-auth-token`;

  request.cookies
    .getAll()
    .filter(
      ({ name }) =>
        name === authCookieName || name.startsWith(`${authCookieName}.`),
    )
    .forEach(({ name }) => {
      response.cookies.set(name, "", {
        expires: new Date(0),
        path: "/",
        sameSite: "lax",
      });
    });

  return response;
}

export async function updateSession(request: NextRequest) {
  const config = getSupabasePublicConfig();
  const { pathname, search } = request.nextUrl;

  if (!config) {
    if (isPublicPath(pathname)) {
      return NextResponse.next({ request });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("setup", "required");
    return NextResponse.redirect(loginUrl);
  }

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        supabaseResponse = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });

        Object.entries(headersToSet).forEach(([name, value]) => {
          supabaseResponse.headers.set(name, value);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return clearInvalidSessionCookies(
      request,
      copySessionState(supabaseResponse, NextResponse.redirect(loginUrl)),
      config.url,
    );
  }

  if (claims && pathname === "/login") {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return copySessionState(
      supabaseResponse,
      NextResponse.redirect(dashboardUrl),
    );
  }

  return supabaseResponse;
}
