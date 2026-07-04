"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import {
  getUser,
  login,
  logout,
  mergeProgress,
  pullRemoteProgress,
  pushRemoteProgress,
  signup,
  type AuthUser,
} from "@/lib/auth";
import { loadProgress, saveProgress } from "@/lib/learn-quran";
import { t } from "@/lib/i18n";

export default function AccountPage() {
  const { lang } = useLang();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ points: 0, lessons: 0 });

  useEffect(() => {
    setUser(getUser());
    const p = loadProgress();
    setStats({ points: p.points, lessons: Object.values(p.lessons).filter((l) => l.completed).length });
  }, []);

  async function syncAfterAuth() {
    // Never lose anything: merge cloud + this device, keep both updated.
    try {
      const remote = await pullRemoteProgress();
      const merged = mergeProgress(loadProgress(), remote);
      saveProgress(merged);
      await pushRemoteProgress(merged);
      setStats({
        points: merged.points,
        lessons: Object.values(merged.lessons).filter((l) => l.completed).length,
      });
    } catch {
      /* sync is best-effort; the account itself is already active */
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const u =
        mode === "login"
          ? await login(email, password)
          : await signup(email, password, name, lang);
      setUser(u);
      await syncAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    return (
      <div className="mx-auto max-w-md space-y-5">
        <h1 className="text-2xl font-bold text-heading">{t(lang, "account")}</h1>
        <div className="card space-y-1 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-xl font-bold text-white">
            {(user.name || user.email)[0]?.toUpperCase()}
          </span>
          {user.name && <p className="pt-2 font-semibold text-heading">{user.name}</p>}
          <p className="text-sm text-muted">{user.email}</p>
        </div>
        <div className="card flex items-center justify-around text-center">
          <div>
            <p className="text-xl font-bold text-heading">⭐ {stats.points}</p>
            <p className="text-xs text-muted">{t(lang, "learnQuranPoints")}</p>
          </div>
          <div>
            <p className="text-xl font-bold text-heading">{stats.lessons}</p>
            <p className="text-xs text-muted">{t(lang, "learnQuranLessonsDone")}</p>
          </div>
        </div>
        <p className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs leading-relaxed text-body dark:border-emerald-900 dark:bg-emerald-950/20">
          ✅ {t(lang, "authSyncNote")}
        </p>
        <div className="flex gap-2">
          <Link href="/learn-quran" className="btn-primary text-sm">
            {t(lang, "learnQuran")} →
          </Link>
          <button
            type="button"
            onClick={() => {
              logout();
              setUser(null);
            }}
            className="rounded-full border border-subtle px-4 py-2 text-sm text-body hover:bg-surface-muted"
          >
            {t(lang, "authLogout")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-heading">
          {mode === "login" ? t(lang, "authLogin") : t(lang, "authSignup")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t(lang, "authSyncNote")}</p>
      </header>

      <form onSubmit={submit} className="card space-y-3">
        {mode === "signup" && (
          <input
            className="input"
            type="text"
            autoComplete="name"
            placeholder={t(lang, "authName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
          />
        )}
        <input
          className="input"
          type="email"
          required
          autoComplete="email"
          placeholder={t(lang, "authEmail")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input"
          type="password"
          required
          minLength={mode === "signup" ? 8 : 1}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          placeholder={t(lang, "authPassword")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
          {busy ? "…" : mode === "login" ? t(lang, "authLogin") : t(lang, "authSignup")}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError("");
        }}
        className="w-full text-center text-sm text-accent hover:underline"
      >
        {mode === "login" ? t(lang, "authNoAccount") : t(lang, "authHaveAccount")}
      </button>
    </div>
  );
}
