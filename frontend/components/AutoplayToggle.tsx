"use client";

import { Tooltip } from "@/components/Tooltip";

type Props = {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
};

const knobPlay = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-2 w-2" aria-hidden>
    <path d="M8.5 5.6v12.8c0 1.2 1.3 1.9 2.3 1.3l10-6.4a1.5 1.5 0 0 0 0-2.6l-10-6.4c-1-.6-2.3.1-2.3 1.3Z" />
  </svg>
);

const knobPause = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-2 w-2" aria-hidden>
    <rect x="6" y="4.5" width="4.4" height="15" rx="1.8" />
    <rect x="13.6" y="4.5" width="4.4" height="15" rx="1.8" />
  </svg>
);

/** YouTube-style autoplay switch: pill track with a sliding knob whose icon
 *  shows what happens when the current surah ends (play next vs stop). */
export function AutoplayToggle({ on, onChange, label }: Props) {
  return (
    <Tooltip label={label} side="bottom">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className="inline-flex h-11 min-h-11 items-center rounded-lg px-1.5 transition-transform duration-150 hover:scale-105 active:scale-95 sm:h-9 sm:min-h-0"
      >
        <span
          className={`relative inline-flex h-[18px] w-[38px] shrink-0 items-center rounded-full transition-colors duration-200 ${
            on ? "bg-noor-700 dark:bg-noor-500" : "bg-noor-200 dark:bg-noor-700"
          }`}
        >
          <span
            className={`absolute flex h-[14px] w-[14px] items-center justify-center rounded-full bg-white text-noor-800 shadow transition-all duration-200 ${
              on ? "left-[21px]" : "left-[3px]"
            }`}
          >
            {on ? knobPlay : knobPause}
          </span>
        </span>
      </button>
    </Tooltip>
  );
}
