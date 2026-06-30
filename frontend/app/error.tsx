"use client";

import { NoticeCard } from "@/components/NoticeCard";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center px-4">
      <NoticeCard
        tone="error"
        title="Something did not load"
        message="Please try again. If this keeps happening, refresh the page and continue from where you left off."
        actionLabel="Try again"
        onAction={reset}
      />
    </div>
  );
}
