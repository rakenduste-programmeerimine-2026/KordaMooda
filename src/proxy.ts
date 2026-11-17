import type { NextRequest } from "next/server";
import { contentSecurityPolicy } from "@/lib/security-headers";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 renamed middleware.ts to proxy.ts. It runs on the Node.js runtime.
export async function proxy(request: NextRequest) {
  // A fresh nonce per request. Next.js reads it from the request's CSP header and puts it
  // on its own scripts; see node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce, process.env.NEXT_PUBLIC_SUPABASE_URL);

  const response = await updateSession(request, {
    "x-nonce": nonce,
    "Content-Security-Policy": csp,
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Everything except static files, images and the icon, which need no session or nonce.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
