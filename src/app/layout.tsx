import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import "./globals.css";

const font = Onest({
  variable: "--font-text",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "KordaMööda",
  description: "Näitab koos elavatele inimestele kohe, kelle kord iga kodutöö on.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F5FA" },
    { media: "(prefers-color-scheme: dark)", color: "#10111F" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="et" className={font.variable}>
      <body>{children}</body>
    </html>
  );
}
