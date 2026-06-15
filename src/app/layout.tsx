import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { FlowProviders } from "@/components/providers/flow-providers";
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
  title: "Flow — Workforce Productivity",
  description:
    "Project tracking, QA, accountability, and performance management for analyst teams",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <FlowProviders>{children}</FlowProviders>
      </body>
    </html>
  );
}
