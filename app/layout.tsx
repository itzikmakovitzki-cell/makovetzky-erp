import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

// Heebo — the official brand typeface (מסמך מותג §4). Carries the full
// weight ladder (300-900) so display sizes, body, and captions all come from
// the same family. Hebrew + Latin subsets cover emails, numbers, and currency.
const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-heebo",
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
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#1F2937" }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
