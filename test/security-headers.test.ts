import assert from "node:assert/strict";
import { test } from "node:test";
import { contentSecurityPolicy, staticSecurityHeaders } from "../src/lib/security-headers.ts";

const SUPABASE = "https://abc.supabase.co";

function directives(csp: string): Map<string, string> {
  return new Map(
    csp.split("; ").map((part) => {
      const [name, ...values] = part.split(" ");
      return [name, values.join(" ")];
    }),
  );
}

test("scripts run only with this request's nonce", () => {
  const csp = directives(contentSecurityPolicy("abc123", SUPABASE));

  assert.equal(csp.get("script-src"), "'self' 'nonce-abc123' 'strict-dynamic'");
  assert.ok(!csp.get("script-src")?.includes("unsafe-inline"));
  assert.equal(csp.get("object-src"), "'none'");
  assert.equal(csp.get("frame-ancestors"), "'none'");
});

test("the browser may talk to Supabase over HTTPS and WebSocket (realtime)", () => {
  const csp = directives(contentSecurityPolicy("n", SUPABASE));
  assert.equal(csp.get("connect-src"), "'self' https://abc.supabase.co wss://abc.supabase.co");

  const local = directives(contentSecurityPolicy("n", "http://127.0.0.1:54321"));
  assert.equal(local.get("connect-src"), "'self' http://127.0.0.1:54321 ws://127.0.0.1:54321");

  assert.equal(directives(contentSecurityPolicy("n", undefined)).get("connect-src"), "'self'");
});

test("invite links don't leak to other sites and the app can't be framed", () => {
  const headers = new Map(staticSecurityHeaders.map(({ key, value }) => [key, value]));

  assert.equal(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
});
