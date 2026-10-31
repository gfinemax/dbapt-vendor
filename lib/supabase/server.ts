import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/database.types";
import { requireSupabasePublicConfig } from "@/lib/supabase/env";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = requireSupabasePublicConfig();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component에서는 쿠키를 쓸 수 없다. middleware가 갱신을 담당한다.
        }
      },
    },
  });
}
