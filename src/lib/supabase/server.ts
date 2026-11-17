import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

/**
 * Supabase client for server actions, route handlers and server components.
 *
 * Create a new one for every request; never keep it in a module variable,
 * or one person's session could leak into another person's request.
 *
 * It uses the anon key and the caller's session, so RLS always applies.
 * There is deliberately no service_role client in this app.
 */
export async function createClient() {
  const { url, anonKey } = supabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server components can't set cookies. That's fine: proxy.ts
          // refreshes the session on every request before rendering.
        }
      },
    },
  });
}
