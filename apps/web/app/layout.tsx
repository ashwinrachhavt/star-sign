import type { Metadata } from "next";
import { fontMono, fontSans, fontSerif } from "./fonts";
import "../styles/tokens.css";
import "../styles/type.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Star Sign",
  description: "A private sky shared with someone you care about.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fontSerif.variable} ${fontSans.variable} ${fontMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
