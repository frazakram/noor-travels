import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppShellDetect } from "@/components/AppShellDetect";
import { ChatProvider } from "@/components/ChatProvider";
import { ChatWidget } from "@/components/ChatWidget";
import { Footer } from "@/components/Footer";
import { LangProvider } from "@/components/LangProvider";
import { Nav } from "@/components/Nav";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Noor Safar — Remember Allah while travelling",
  description: "Quran, Hadith, travel duas, live khutba, and precise Salah times for your area",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#255a4e" },
    { media: "(prefers-color-scheme: dark)", color: "#0d221f" },
  ],
};

const themeScript = `(function(){try{var t=localStorage.getItem("noor-theme");if(t==="dark")document.documentElement.classList.add("dark");var ua=navigator.userAgent||"";if(/NoorSafarAndroid/i.test(ua)||/; wv\\)/i.test(ua)||window.matchMedia("(display-mode: standalone)").matches)document.documentElement.classList.add("app-shell")}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link
          href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${inter.variable} min-h-screen bg-sand-50 pl-safe pr-safe font-sans text-noor-900 antialiased transition-colors duration-300 dark:bg-noor-950 dark:text-noor-50`}
      >
        <ThemeProvider>
          <LangProvider>
            <ChatProvider>
              <AppShellDetect />
              <Nav />
              <main className="mx-auto max-w-5xl px-4 py-4 pb-safe sm:py-6">{children}</main>
              <Footer />
              <RegisterServiceWorker />
              <ChatWidget />
            </ChatProvider>
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
