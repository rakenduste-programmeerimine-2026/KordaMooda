/**
 * Content Security Policy for every page (#19). Built per request in proxy.ts with a fresh
 * nonce, as in node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
 *
 * - script-src: only Next.js's own scripts, which carry the nonce. An injected <script>
 *   can't run, so it can't read the session cookie (it can't be httpOnly: the browser
 *   client needs it for realtime).
 * - style-src 'unsafe-inline': React and motion render `style="…"` attributes (initial
 *   animation state). A nonce can't cover attributes. Styles can't run code.
 * - connect-src: Supabase over HTTPS and WebSocket (realtime, #13).
 */
export function contentSecurityPolicy(nonce: string, supabaseUrl: string | undefined): string {
  const isDev = process.env.NODE_ENV === "development";
  const supabase = supabaseUrl ? new URL(supabaseUrl) : null;
  const connect = supabase
    ? `${supabase.origin} ${supabase.protocol === "https:" ? "wss:" : "ws:"}//${supabase.host}`
    : "";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self' ${connect}`.trim(),
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/** Headers that are the same for every response, set in next.config.ts. */
export const staticSecurityHeaders = [
  // No one can show the app in a frame (clickjacking). CSP frame-ancestors says the same.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Invite links (/liitu/<kood>) must not leak to other sites through the Referer header.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];
