"use client";

import type { TimePhase } from "@/lib/salah";

const PHASE_STYLES: Record<
  TimePhase,
  {
    gradient: string;
    orb1: string;
    orb2: string;
    stars: boolean;
    celestial: "sun" | "moon" | "crescent";
    birds: boolean;
  }
> = {
  fajr: {
    gradient: "from-indigo-950 via-noor-900 to-amber-700",
    orb1: "bg-amber-300/30",
    orb2: "bg-teal-300/20",
    stars: true,
    celestial: "crescent",
    birds: true,
  },
  morning: {
    gradient: "from-sky-500 via-teal-500 to-noor-600",
    orb1: "bg-yellow-200/40",
    orb2: "bg-white/25",
    stars: false,
    celestial: "sun",
    birds: true,
  },
  dhuhr: {
    gradient: "from-amber-500 via-gold-400 to-teal-300",
    orb1: "bg-white/35",
    orb2: "bg-amber-500/25",
    stars: false,
    celestial: "sun",
    birds: true,
  },
  asr: {
    gradient: "from-orange-600 via-amber-500 to-noor-700",
    orb1: "bg-orange-200/35",
    orb2: "bg-gold-300/20",
    stars: false,
    celestial: "sun",
    birds: true,
  },
  maghrib: {
    gradient: "from-indigo-950 via-noor-900 to-amber-700",
    orb1: "bg-orange-300/30",
    orb2: "bg-teal-400/20",
    stars: true,
    celestial: "crescent",
    birds: false,
  },
  isha: {
    gradient: "from-noor-950 via-indigo-950 to-noor-900",
    orb1: "bg-indigo-400/15",
    orb2: "bg-gold-400/10",
    stars: true,
    celestial: "crescent",
    birds: false,
  },
  night: {
    gradient: "from-slate-950 via-noor-950 to-indigo-950",
    orb1: "bg-indigo-500/10",
    orb2: "bg-gold-300/8",
    stars: true,
    celestial: "moon",
    birds: false,
  },
};

type Props = {
  phase: TimePhase;
  children: React.ReactNode;
};

export function TimeOfDayHero({ phase, children }: Props) {
  const style = PHASE_STYLES[phase];
  const isSun = style.celestial === "sun";

  return (
    <section className="relative overflow-hidden rounded-3xl shadow-xl ring-1 ring-white/10">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${style.gradient} transition-all duration-[2000ms] ease-in-out`}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.28),transparent_26%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.14),transparent_22%)]" />
      <div className="parallax-starfield" aria-hidden="true" />
      <div className="islamic-pattern" aria-hidden="true" />
      <div className="hero-light-ribbons" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div
        className={`absolute -left-12 -top-12 h-40 w-40 rounded-full blur-3xl ${style.orb1} animate-orb-drift`}
      />
      <div
        className={`absolute -bottom-16 -right-8 h-44 w-44 rounded-full blur-3xl ${style.orb2} animate-orb-drift-reverse`}
      />
      <div className="celestial-track scale-[0.38] opacity-45 sm:scale-50 md:scale-60" aria-hidden="true">
        {isSun ? (
          <div className="real-sun">
            <span className="sun-rays" />
            <span className="sun-core" />
          </div>
        ) : (
          <div className={style.celestial === "crescent" ? "real-moon real-crescent" : "real-moon"}>
            <span className="moon-crater moon-crater-one" />
            <span className="moon-crater moon-crater-two" />
            <span className="moon-crater moon-crater-three" />
          </div>
        )}
      </div>
      <div className="cloud-layer cloud-layer-one" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="cloud-layer cloud-layer-two" aria-hidden="true">
        <span />
        <span />
      </div>
      {style.birds && (
        <div className="bird-flock" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
      {style.stars && (
        <div className="pointer-events-none absolute inset-0 animate-twinkle opacity-90">
          {[...Array(38)].map((_, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.8)]"
              style={{
                top: `${(i * 17) % 100}%`,
                left: `${(i * 23 + 7) % 100}%`,
                width: `${i % 5 === 0 ? 3 : 2}px`,
                height: `${i % 5 === 0 ? 3 : 2}px`,
                animationDelay: `${(i % 5) * 0.4}s`,
              }}
            />
          ))}
          <span className="shooting-star shooting-star-one" />
          <span className="shooting-star shooting-star-two" />
        </div>
      )}
      <div className="mosque-silhouette" aria-hidden="true">
        <span className="minaret minaret-left" />
        <span className="dome dome-small" />
        <span className="dome dome-main" />
        <span className="dome dome-small dome-right" />
        <span className="minaret minaret-right" />
      </div>
      <div className="relative z-10 px-4 py-4 sm:px-5 sm:py-5">{children}</div>
    </section>
  );
}
