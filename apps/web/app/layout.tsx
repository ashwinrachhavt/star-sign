import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Star Sign",
  description: "A private sky shared with someone you care about.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
