export type IconName =
  | "pin"
  | "bell"
  | "check"
  | "sunrise"
  | "sun"
  | "sunCloud"
  | "sunset"
  | "moon"
  | "mosque"
  | "flame"
  | "compass";

const PATHS: Record<IconName, React.ReactNode> = {
  pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></>,
  bell: <><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15L6 16.5Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  sunrise: <><path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 4v4M5.2 9.2l1.6 1.6M18.8 9.2l-1.6 1.6M9.5 6.5 12 4l2.5 2.5" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  sunCloud: <><path d="M9 7.5a4 4 0 0 1 7.3 1.6M9 3v1.2M3.8 8H5M5.3 4.3l.9.9" /><path d="M7.5 20h9a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1.2A3 3 0 0 0 7.5 20Z" /></>,
  sunset: <><path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 9V4M5.2 9.2l1.6 1.6M18.8 9.2l-1.6 1.6M9.5 6.5 12 9l2.5-2.5" /></>,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />,
  mosque: <><path d="M4 21V12h16v9M4 21h16M8.5 12a3.5 3.5 0 0 1 7 0M12 5v3.5M10 21v-4a2 2 0 0 1 4 0v4" /><path d="M2.5 21V9M21.5 21V9" /></>,
  flame: <path d="M12 21c-3.6 0-6-2.4-6-5.7 0-2.7 1.6-4.3 3-6 .4 1.5 1 2.3 1.8 2.8C11 9 12.3 5.8 15 3c-.3 2.6.5 4.6 1.8 6.2C18 10.7 18 12.6 18 15.3 18 18.6 15.6 21 12 21Z" />,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
};

export function Icon({ name, className = "h-4 w-4", strokeWidth = 1.8 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[name]}
    </svg>
  );
}
