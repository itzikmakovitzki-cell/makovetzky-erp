import type { Metadata, Viewport } from "next";
import { Noto_Sans_Hebrew } from "next/font/google";
import "./globals.css";

// UAUX "Hebrew Modern" pairing — Google's universal Hebrew sans, clean and
// highly legible at the small sizes our dense tables use, with reliable
// Latin coverage for emails, numbers, and currency.
const notoSansHebrew = Noto_Sans_Hebrew({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-hebrew",
  display: "swap"
});

export const metadata: Metadata = {
  title: "מקובצקי — ניהול פרויקטים",
  description: "מערכת ניהול בירוקרטיה ותהליכי רישוי לקבלנים ויזמים",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "מקובצקי",
    statusBarStyle: "black-translucent"
  },
  formatDetection: { telephone: false }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={notoSansHebrew.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
