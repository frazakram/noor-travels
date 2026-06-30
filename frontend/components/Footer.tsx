import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-subtle bg-white/70 px-4 py-6 text-xs text-muted backdrop-blur dark:bg-noor-950/70">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>For learning and remembrance. Not a source of fatwa. Verify with qualified scholars.</p>
        <div className="flex items-center gap-4">
          <Link href="/" className="hover:text-heading">About</Link>
          <Link href="/" className="hover:text-heading">Privacy</Link>
          <span className="rounded-full bg-noor-50 px-2 py-1 text-[10px] font-medium dark:bg-noor-900">
            v1.0.0
          </span>
        </div>
      </div>
    </footer>
  );
}
