import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppShellDetect } from "@/components/AppShellDetect";
import { AppTabBar } from "@/components/AppTabBar";
import { ChatProvider } from "@/components/ChatProvider";
import { InstallAppBanner } from "@/components/InstallAppBanner";
import { ChatWidget } from "@/components/ChatWidget";
import { Footer } from "@/components/Footer";
import { LangProvider } from "@/components/LangProvider";
import { Nav } from "@/components/Nav";
import { AuthNudge } from "@/components/AuthNudge";
import { NavigationProgress } from "@/components/NavigationProgress";
import { PageWrapper } from "@/components/PageWrapper";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Noor Safar — Remember Allah while travelling",
  description: "Quran, Hadith, travel duas, live khutba, and precise Salah times for your area",
  icons: {
    icon: "/logo-sm.png",
    apple: "/logo-192.png",
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

const themeScript = `(function(){try{var t=localStorage.getItem("noor-theme");if(t==="dark")document.documentElement.classList.add("dark");var a=localStorage.getItem("noor-a11y");if(a){var p=JSON.parse(a);var scales={sm:"0.92",md:"1",lg:"1.12",xl:"1.25"};if(p.fontScale&&scales[p.fontScale])document.documentElement.style.setProperty("--text-scale",scales[p.fontScale]);if(p.highContrast)document.documentElement.classList.add("high-contrast")}var ua=navigator.userAgent||"";if(/NoorSafarAndroid/i.test(ua)||/; wv\\)/i.test(ua)||window.matchMedia("(display-mode: standalone)").matches)document.documentElement.classList.add("app-shell")}catch(e){}})();`;

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
              <NavigationProgress />
              <AppShellDetect />
              <Nav />
              <main className="mx-auto max-w-5xl px-4 py-4 pb-28 sm:py-6 md:pb-safe">
                <PageWrapper>{children}</PageWrapper>
              </main>
              <div className="pb-24 md:pb-0">
                <Footer />
              </div>
              <AppTabBar />
              <RegisterServiceWorker />
              <ChatWidget />
              <InstallAppBanner />
              <AuthNudge />
            </ChatProvider>
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
