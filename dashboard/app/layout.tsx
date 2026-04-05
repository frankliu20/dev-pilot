import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Copilot Dev Dashboard",
  description: "Dev Pilot — AI engineering team dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body>
        {children}
      </body>
    </html>
  );
}
