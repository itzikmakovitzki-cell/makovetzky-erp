import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "מקובצקי — ניהול פרויקטים",
  description: "מערכת ניהול בירוקרטיה ותהליכי רישוי לקבלנים ויזמים"
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
