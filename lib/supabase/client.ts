"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";
import { requireSupabasePublicConfig } from "@/lib/supabase/env";

export function createClient() {
  const { url, key } = requireSupabasePublicConfig();

  return createBrowserClient<Database>(url, key);
}
