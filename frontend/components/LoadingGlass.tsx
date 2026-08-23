"use client";

const SIZE_CLASSES = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-9 w-9",
} as const;

/** Reusable "liquid glass" loading indicator — a small glass disc with a
 * rotating green→gold arc, matching the app's nav-progress-bar gradient.
 * Drop in anywhere a spinner/skeleton currently just says "…" or plain text. */
export function LoadingGlass({
  size = "md",
  label,
  className = "",
}: {
  size?: keyof typeof SIZE_CLASSES;
  label?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span role="status" aria-label={label ?? "Loading"} className={`liquid-glass-spinner ${SIZE_CLASSES[size]}`} />
      {label && <span className="text-xs text-faint">{label}</span>}
    </span>
  );
}
