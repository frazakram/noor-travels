"use client";

import type { TimePhase } from "@/lib/salah";

type PhaseTheme = {
  /** Sky gradient, always dark at the top so hero text stays readable. */
  sky: string;
  /** Horizon glow color painted behind the skyline. */
  horizon: string;
  celestial: "sun" | "crescent" | "moon";
  celestialPos: React.CSSProperties;
  stars: number;
  shooting: boolean;
  clouds: boolean;
  birds: boolean;
  /** Mosque window lights, lit from maghrib through fajr. */
  lights: boolean;
};

const PHASES: Record<TimePhase, PhaseTheme> = {
  fajr: {
    sky: "from-[#0c1631] via-[#10353c] to-[#7c4a23]",
    horizon: "rgba(240,169,110,0.45)",
    celestial: "crescent",
    celestialPos: { right: "14%", top: "16%" },
    stars: 14,
    shooting: false,
    clouds: false,
    birds: true,
    lights: true,
  },
  morning: {
    sky: "from-[#083b36] via-[#0d5a4e] to-[#1c7a5e]",
    horizon: "rgba(255,214,130,0.30)",
    celestial: "sun",
    celestialPos: { right: "30%", top: "16%" },
    stars: 0,
    shooting: false,
    clouds: true,
    birds: true,
    lights: false,
  },
  dhuhr: {
    sky: "from-[#0a4a41] via-[#12695a] to-[#1f8468]",
    horizon: "rgba(255,230,150,0.32)",
    celestial: "sun",
    celestialPos: { right: "18%", top: "6%" },
    stars: 0,
    shooting: false,
    clouds: true,
    birds: false,
    lights: false,
  },
  asr: {
    sky: "from-[#0d413a] via-[#2c5c4a] to-[#8f652c]",
    horizon: "rgba(255,190,105,0.40)",
    celestial: "sun",
    celestialPos: { right: "15%", top: "26%" },
    stars: 0,
    shooting: false,
    clouds: true,
    birds: true,
    lights: false,
  },
  maghrib: {
    sky: "from-[#141537] via-[#3f2947] to-[#9c5220]",
    horizon: "rgba(255,150,80,0.48)",
    celestial: "crescent",
    celestialPos: { right: "16%", top: "16%" },
    stars: 18,
    shooting: false,
    clouds: false,
    birds: false,
    lights: true,
  },
  isha: {
    sky: "from-[#050b16] via-[#0a1c28] to-[#123a34]",
    horizon: "rgba(212,168,83,0.20)",
    celestial: "crescent",
    celestialPos: { right: "13%", top: "13%" },
    stars: 26,
    shooting: true,
    clouds: false,
    birds: false,
    lights: true,
  },
  night: {
    sky: "from-[#03060c] via-[#071320] to-[#0b2724]",
    horizon: "rgba(150,190,255,0.12)",
    celestial: "moon",
    celestialPos: { right: "12%", top: "12%" },
    stars: 32,
    shooting: true,
    clouds: false,
    birds: false,
    lights: true,
  },
};

const WINDOW_LIGHTS = ["20%", "28%", "42%", "58%", "72%", "80%"];

// One continuous silhouette: wall, two minarets, two side domes, central dome + finial.
const SKYLINE_PATH =
  "M597,40 L597,18 L603,18 L603,40 Z " +
  "M0,160 L0,126 L148,126 L148,52 Q161,24 174,52 L174,126 L338,126 " +
  "Q338,96 374,84 Q410,96 410,126 L492,126 " +
  "Q492,116 502,111 Q514,58 600,40 Q686,58 698,111 Q708,116 708,126 " +
  "L790,126 Q790,96 826,84 Q862,96 862,126 " +
  "L1026,126 L1026,52 Q1039,24 1052,52 L1052,126 L1200,126 L1200,160 Z";

type Props = {
  phase: TimePhase;
  children: React.ReactNode;
};

export function TimeOfDayHero({ phase, children }: Props) {
  const p = PHASES[phase];

  return (
    <section className="relative overflow-hidden rounded-3xl shadow-xl ring-1 ring-white/10">
      <div
        className={`absolute inset-0 bg-gradient-to-b ${p.sky} transition-all duration-[2000ms] ease-in-out`}
      />
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(120% 60% at 50% 104%, ${p.horizon}, transparent 62%)` }}
      />
      <div className="hero-geo" aria-hidden="true" />

      {p.stars > 0 && (
        <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden="true">
          {Array.from({ length: p.stars }, (_, i) => (
            <span
              key={i}
              className="hero-star"
              style={{
                top: `${(i * 37 + 5) % 52}%`,
                left: `${(i * 53 + 11) % 96}%`,
                width: i % 6 === 0 ? 3 : 2,
                height: i % 6 === 0 ? 3 : 2,
                animationDelay: `${(i % 7) * 0.5}s`,
              }}
            />
          ))}
          {p.shooting && (
            <>
              <span className="shooting-star shooting-star-one" />
              <span className="shooting-star shooting-star-two" />
            </>
          )}
        </div>
      )}

      <div aria-hidden="true">
        {p.celestial === "sun" && <div className="hero-sun" style={p.celestialPos} />}
        {p.celestial === "crescent" && (
          <div className="hero-crescent-wrap" style={p.celestialPos}>
            <div className="hero-crescent" />
          </div>
        )}
        {p.celestial === "moon" && <div className="hero-moon" style={p.celestialPos} />}
      </div>

      {p.clouds && (
        <>
          <div className="cloud-layer cloud-layer-one" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="cloud-layer cloud-layer-two" aria-hidden="true">
            <span />
            <span />
          </div>
        </>
      )}

      {p.birds && (
        <div className="bird-flock" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-20 sm:h-24" aria-hidden="true">
        <svg viewBox="0 0 1200 160" preserveAspectRatio="none" className="h-full w-full">
          <path d={SKYLINE_PATH} fill="#03201c" fillOpacity={0.85} />
          <circle cx="600" cy="13" r="4" fill="#d4a853" fillOpacity={0.8} />
        </svg>
        {p.lights &&
          WINDOW_LIGHTS.map((left, i) => (
            <span key={left} className="hero-window" style={{ left, animationDelay: `${i * 0.7}s` }} />
          ))}
      </div>

      <div className="relative z-10 px-4 py-4 sm:px-5 sm:py-5">{children}</div>
    </section>
  );
}
