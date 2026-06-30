type Props = {
  className?: string;
  size?: number;
};

/** Inline SVG — always renders in WebView/APK (no network fetch). */
export function AppLogo({ className = "h-9 w-9", size = 36 }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 rounded-lg ${className}`}
      aria-hidden
    >
      <rect width="64" height="64" rx="12" fill="#1a4a42" />
      <path
        d="M32 10 L52 48 H12 Z"
        fill="#255a4e"
        stroke="#d4a853"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="38" r="4" fill="#d4a853" />
      <path
        d="M22 18 Q32 8 42 18"
        fill="none"
        stroke="#d4a853"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
