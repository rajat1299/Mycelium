import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mycelium",
  description: "Outcome-first operator console for Mycelium"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-shell text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
