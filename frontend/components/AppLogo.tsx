import { LOGO_SM_DATA_URL } from "@/lib/logo-data";

type Props = {
  className?: string;
  size?: number;
};

/** Embedded logo — works offline and in Android WebView (no network fetch). */
export function AppLogo({ className = "h-9 w-9", size = 36 }: Props) {
  return (
    <img
      src={LOGO_SM_DATA_URL}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-lg object-contain ${className}`}
      decoding="async"
    />
  );
}
