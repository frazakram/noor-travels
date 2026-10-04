"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { sourceKindOf, useOpenSource } from "@/components/SourceTransition";

/**
 * A link to a cited verse / hadith / dua. A plain click plays the opening transition while the
 * page loads; modified clicks (new tab, etc.) and long-press keep normal link behaviour.
 */
export function CitationLink({
  href,
  label,
  className,
  onOpen,
  children,
}: {
  href: string;
  label: string;
  className?: string;
  onOpen?: () => void;
  children: ReactNode;
}) {
  const openSource = useOpenSource();
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onOpen?.();
    openSource(href, sourceKindOf(href), label);
  }
  return (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}
