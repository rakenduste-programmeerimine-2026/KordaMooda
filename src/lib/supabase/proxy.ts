import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "./database.types";
import { hasSupabaseEnv, supabaseEnv } from "./env";

/**
 * Refreshes the Supabase session cookie before the page renders.
 *
 * Server components can read cookies but not write them, so an expired
 * access token has to be renewed here. Without this people get logged out
 * at random, which for anonymous users means losing their household.
 */
export async function updateSession(
  request: NextRequest,
  extraRequestHeaders: Record<string, string> = {},
): Promise<NextResponse> {
  /**
   * Passes the request on to the page, with `extraRequestHeaders` (the CSP nonce) added.
   * Built from request.headers each time, so cookies refreshed below are included.
   */
  const next = () => {
    const headers = new Headers(request.headers);
    for (const [key, value] of Object.entries(extraRequestHeaders)) headers.set(key, value);
    return NextResponse.next({ request: { headers } });
  };
  let response = next();

  // The app still runs on the mock (#7) without Supabase settings.
  if (!hasSupabaseEnv()) return response;

  const { url, anonKey } = supabaseEnv();
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // The new token goes to both the request (so this render sees it)
        // and the response (so the browser keeps it).
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = next();
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Stops CDNs from caching a response that carries someone's session.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Validates the token and refreshes it when needed. Keep this call directly
  // after creating the client; code in between can make sessions drop.
  await supabase.auth.getClaims();

  return response;
}
