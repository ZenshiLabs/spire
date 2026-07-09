import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const title = "Spire: live code sharing without a screen share";
const description =
  "Broadcast the files you're working on to a browser tab. Run one command, share the link, and anyone can follow along as you save. Read-only, syntax-highlighted, no account or install.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s · Spire",
  },
  description,
  applicationName: "Spire",
  keywords: [
    "live code sharing",
    "pair programming",
    "screen share alternative",
    "real-time code",
    "code broadcast",
    "teaching",
    "mentoring",
    "developer tools",
  ],
  authors: [{ name: "ZenshiLabs" }],
  openGraph: {
    type: "website",
    siteName: "Spire",
    title,
    description,
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Suppress Monaco language-service cancelation rejections before the
            Next.js dev overlay installs its unhandledrejection handler. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.addEventListener('unhandledrejection',function(e){var r=e.reason;if(r&&typeof r==='object'&&r.type==='cancelation'){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
