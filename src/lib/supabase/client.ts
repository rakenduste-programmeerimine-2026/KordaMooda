import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

/**
 * Supabase client for the browser. Only for things that must run there,
 * such as realtime updates (#13). Reading and changing data goes through
 * the server actions in `src/lib/actions.ts`.
 *
 * `createBrowserClient` returns the same instance on every call in the browser.
 */
export function createClient() {
  const { url, anonKey } = supabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
