import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ChatProvider } from "@/components/ChatProvider";
import { ChatWidget } from "@/components/ChatWidget";
import { LangProvider } from "@/components/LangProvider";
import { Nav } from "@/components/Nav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Noor Safar — Remember Allah while travelling",
  description: "Quran, Hadith, travel duas, and live khutba translation for Indian Muslims",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.variable} min-h-screen bg-sand-50 font-sans text-noor-900 antialiased`}>
        <LangProvider>
          <ChatProvider>
            <Nav />
            <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
            <footer className="border-t border-noor-100 bg-sand-100 px-4 py-4 text-center text-xs text-noor-600">
              For learning and remembrance. Not a source of fatwa.
            </footer>
            <ChatWidget />
          </ChatProvider>
        </LangProvider>
      </body>
    </html>
  );
}
