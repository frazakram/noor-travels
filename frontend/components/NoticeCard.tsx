type NoticeTone = "info" | "warning" | "error" | "success";

type Props = {
  title: string;
  message: string;
  tone?: NoticeTone;
  actionLabel?: string;
  onAction?: () => void;
};

const toneClass: Record<NoticeTone, string> = {
  info: "border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-50",
  warning: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50",
  error: "border-red-200 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-50",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50",
};

const icon: Record<NoticeTone, string> = {
  info: "i",
  warning: "!",
  error: "!",
  success: "✓",
};

export function NoticeCard({ title, message, tone = "info", actionLabel, onAction }: Props) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass[tone]}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/70 text-sm font-bold text-current dark:bg-white/10">
          {icon[tone]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm opacity-80">{message}</p>
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="mt-3 rounded-xl bg-current px-3 py-1.5 text-xs font-semibold text-white opacity-90 transition hover:opacity-100 dark:text-noor-950"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
