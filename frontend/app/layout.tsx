import type { Metadata, Viewport } from "next";
import { Amiri, Inter } from "next/font/google";
import { JsonLd } from "@/components/JsonLd";
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { AppShellDetect } from "@/components/AppShellDetect";
import { AppTabBar } from "@/components/AppTabBar";
import { ChatProvider } from "@/components/ChatProvider";
import { ChatWidget } from "@/components/ChatWidget";
import { Footer } from "@/components/Footer";
import { LangProvider } from "@/components/LangProvider";
import { Nav } from "@/components/Nav";
import { AuthNudge } from "@/components/AuthNudge";
import { NavigationProgress } from "@/components/NavigationProgress";
import { InstallAppPrompt } from "@/components/home/InstallAppPrompt";
import { PageWrapper } from "@/components/PageWrapper";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const amiri = Amiri({
  weight: ["400", "700"],
  subsets: ["arabic", "latin"],
  variable: "--font-amiri",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Quran, Hadith, Duas & Prayer Times`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: `${SITE_NAME} — Quran, Hadith, Duas & Prayer Times`,
    description: DEFAULT_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Quran, Hadith, Duas & Prayer Times`,
    description: DEFAULT_DESCRIPTION,
  },
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
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": `${SITE_URL}/#organization`,
              name: SITE_NAME,
              url: SITE_URL,
              logo: `${SITE_URL}/logo.png`,
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              name: SITE_NAME,
              url: SITE_URL,
              description: DEFAULT_DESCRIPTION,
              inLanguage: ["en", "ur", "hi"],
              publisher: { "@id": `${SITE_URL}/#organization` },
            },
          ]}
        />
      </head>
      <body
        className={`${inter.variable} ${amiri.variable} min-h-screen bg-sand-50 pl-safe pr-safe font-sans text-noor-900 antialiased transition-colors duration-300 dark:bg-noor-950 dark:text-noor-50`}
      >
        <ThemeProvider>
          <LangProvider>
            <ChatProvider>
              <NavigationProgress />
              <AppShellDetect />
              <Nav />
              {/* Fixed chrome goes BEFORE <main>: HTML streams and paints in
                  document order, so anything after the page content only shows
                  once the whole document has arrived — on slow devices the
                  bottom tab bar visibly popped in seconds late. position:fixed
                  makes DOM order irrelevant visually; z-index already stacks. */}
              <AppTabBar />
              <ChatWidget />
              <main className="mx-auto max-w-5xl px-4 py-4 pb-28 sm:py-6 md:pb-safe">
                <PageWrapper>{children}</PageWrapper>
              </main>
              <InstallAppPrompt />
              <div className="pb-24 md:pb-0">
                <Footer />
              </div>
              <RegisterServiceWorker />
              <AuthNudge />
            </ChatProvider>
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
