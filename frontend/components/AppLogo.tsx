type Props = {
  className?: string;
  size?: number;
};

/** Nav/header logo — small file for fast WebView load. */
export function AppLogo({ className = "h-9 w-9", size = 36 }: Props) {
  return (
    <img
      src="/logo-sm.png"
      alt="Noor Safar"
      width={size}
      height={size}
      className={`shrink-0 rounded-lg object-contain ${className}`}
      decoding="async"
    />
  );
}
