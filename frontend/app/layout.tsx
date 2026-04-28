import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "UnbiasedAI — Fairness Auditing",
  description: "Industry-grade AI bias detection and fairness auditing platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-display antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
