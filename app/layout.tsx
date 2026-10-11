import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
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
  metadataBase: new URL("https://fees.darulbayan.local"),
  title: "Dārul Bayān Madrasah Fees",
  description: "Internal fee management system for the Madrasah.",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Dārul Bayān Madrasah Fees",
    description: "Student, family, payment, and outstanding fee management for the Madrasah.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
