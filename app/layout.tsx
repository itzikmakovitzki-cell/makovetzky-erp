import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
