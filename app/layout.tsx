import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "Virtual Office", description: "A visual office for AI agents on Multica" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Pasang mode terang/gelap pilihan sebelum halaman tampil, supaya tidak berkedip. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var d=document.documentElement,t=localStorage.getItem("kantor-theme"),p=localStorage.getItem("kantor-palette");if(t==="light"||t==="dark")d.dataset.theme=t;if(p&&/^(laut|hutan|pastel|klasik)$/.test(p))d.dataset.palette=p}catch(e){}` }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&family=Nunito:wght@400;600;700;800&display=swap" />
      </head>
      {/* Ekstensi browser (mis. Grammarly) menambah atribut di <body>; abaikan peringatannya. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
