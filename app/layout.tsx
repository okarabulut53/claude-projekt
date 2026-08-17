import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finara — KI-gestützte Investment-Analyse",
  description:
    "Finara analysiert Aktien, ETFs und Kryptowährungen mit KI und liefert dir transparente Investmentideen. Die Entscheidung triffst immer du.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="bg-background text-foreground antialiased">
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
