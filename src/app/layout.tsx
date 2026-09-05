import type { Metadata, Viewport } from "next";
import { connection } from "next/server";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://pl-predictions-2026.vercel.app"),
  title: {
    default: "Dranx Prediction League 2026/27",
    template: "%s · Dranx Prediction League",
  },
  description:
    "A private prediction competition for the 2026/27 Premier League table.",
  applicationName: "Dranx Prediction League",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { color: "#f5f3ee", media: "(prefers-color-scheme: light)" },
    { color: "#17131a", media: "(prefers-color-scheme: dark)" },
  ],
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // A request-specific CSP nonce is applied to every framework script.
  await connection();
  return (
    <html
      lang="en"
      className="h-full antialiased"
      data-scroll-behavior="smooth"
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
