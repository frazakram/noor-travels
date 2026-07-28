import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

const links = [
  { href: "/", label: "Home" },
  { href: "/quran", label: "Read the Quran" },
  { href: "/duas", label: "Duas" },
  { href: "/hadith", label: "Hadith" },
  { href: "/learn-quran", label: "Learn Quran" },
];

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-6 py-16 text-center">
      <p className="text-6xl font-bold text-noor-300 dark:text-noor-700">404</p>
      <div>
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-muted">
          The page you are looking for doesn&apos;t exist or has moved.
        </p>
      </div>
      <nav aria-label="Helpful links" className="flex flex-wrap justify-center gap-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="touch-target rounded-full border border-noor-200 px-4 py-2 text-sm font-medium text-noor-800 transition hover:bg-noor-50 dark:border-noor-700 dark:text-noor-100 dark:hover:bg-noor-900"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
