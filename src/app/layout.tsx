import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const font = Onest({
  variable: "--font-text",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "KordaMööda",
  description: "Näitab koos elavatele inimestele kohe, kelle kord iga kodutöö on.",
  // iPhone: open from the home screen without Safari's bars (#20).
  appleWebApp: { capable: true, title: "KordaMööda", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F5FA" },
    { media: "(prefers-color-scheme: dark)", color: "#10111F" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page is rendered per request, so each gets the CSP nonce from proxy.ts (#19).
  // A page built ahead of time would have no nonce and its scripts would be blocked.
  await connection();
  return (
    <html lang="et" className={font.variable}>
      <body>{children}</body>
    </html>
  );
}
