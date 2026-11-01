import type { Metadata } from "next";
import "./globals.css";

// Fonts (Inter + Source Serif 4) and design tokens are added in W1-11.
export const metadata: Metadata = {
  title: "Veritas AI",
  description: "Evidence-backed verification of claims in videos, articles and images.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
