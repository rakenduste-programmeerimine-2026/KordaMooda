/**
 * Supabase settings from `.env.local` (see `.env.example` and README).
 *
 * Written out as `process.env.NEXT_PUBLIC_...` on purpose: Next.js only inlines
 * public variables into the browser bundle when they are accessed literally.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function hasSupabaseEnv(): boolean {
  return Boolean(url && anonKey);
}

export function supabaseEnv(): { url: string; anonKey: string } {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase'i seaded puuduvad. Kopeeri .env.example failiks .env.local ja täida " +
        "NEXT_PUBLIC_SUPABASE_URL ja NEXT_PUBLIC_SUPABASE_ANON_KEY (vt README).",
    );
  }
  return { url, anonKey };
}
