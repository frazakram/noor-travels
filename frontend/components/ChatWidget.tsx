"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useChat } from "@/components/ChatProvider";
import { ChatFeedback } from "@/components/ChatFeedback";
import { ChatHistoryPanel, StarIcon } from "@/components/ChatHistoryPanel";
import { CitationLink } from "@/components/CitationLink";
import { ChatSearchProgress, SearchTrail, type SearchTrailData } from "@/components/ChatSearchProgress";
import { useLang } from "@/components/LangProvider";
import { NoticeCard } from "@/components/NoticeCard";
import { api } from "@/lib/api";
import { AUTH_CHANGED_EVENT, getToken } from "@/lib/auth";
import { getChat, updateChat } from "@/lib/chat-history";
import { newConversationId, restoreAnswer } from "@/lib/chat-history-model";
import { StreamUnavailable, streamChat, type ChatStage } from "@/lib/chat-stream";
import { citationHref, citationLabel, linkifyCitations } from "@/lib/citation-links";
import { t, type Lang } from "@/lib/i18n";

type SourceDetail = {
  ref: string;
  type: string;
  snippet: string;
  score?: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  transliteration?: string;
  citations?: string[];
  sources?: SourceDetail[];
  notice?: string;
  confidence?: string;
  responseLang?: Lang;
  /** Freshly arrived answer: reveal it word by word once. */
  reveal?: boolean;
  /** How the answer was found (streamed stages), shown as a summary above it. */
  trail?: SearchTrailData;
  /** For feedback: the question this answer replied to, and what produced it. */
  question?: string;
  mode?: string;
  llmModel?: string | null;
};

type ChatResponse = {
  answer: string;
  transliteration?: string;
  citations: string[];
  sources?: SourceDetail[];
  confidence: string;
  from_cache?: boolean;
  notice?: string;
  mode?: string;
  llm_model?: string | null;
  /** Present when a conversation_id was sent: whether this turn went into the user's history. */
  history_saved?: boolean;
};

const SUGGESTIONS: Record<Lang, string[]> = {
  en: [
    "What dua for starting travel?",
    "What does Quran say about patience?",
    "Hadith about prayer while travelling",
  ],
  ur: ["سفر کی دعا کیا ہے؟", "قرآن میں صبر کے بارے میں", "سفر میں نماز کی حدیث"],
  hi: ["सफ़र की दुआ क्या है?", "कुरान में सब्र", "सफ़र में नमाज़ की हदीस"],
};

function ConfidenceBadge({ confidence, sources, lang }: { confidence: string; sources?: SourceDetail[]; lang: Lang }) {
  const topScore = sources?.[0]?.score;
  const pct = topScore != null ? Math.min(100, Math.round(topScore * 100)) : null;

  const colorClass =
    confidence === "high"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : confidence === "medium"
      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
      : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300";

  const dot =
    confidence === "high"
      ? "bg-emerald-500"
      : confidence === "medium"
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colorClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {pct != null ? `${pct}% ${t(lang, "matchLabel")}` : confidence.charAt(0).toUpperCase() + confidence.slice(1)}
    </span>
  );
}

function subscribeAuth(onChange: () => void) {
  window.addEventListener(AUTH_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Wall-clock read for timing a request; outside the component so lint knows it isn't render. */
const nowMs = () => Date.now();

/** Reveals text word by word (a fresh answer "arriving"); instant with reduced motion. */
const CITATION_LINK =
  "font-medium text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid";

/** Answer text with its [citations] as links to the full verse / hadith / dua in the app. */
function CitedText({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  return (
    <>
      {linkifyCitations(text).map((seg, i) =>
        seg.href ? (
          <CitationLink key={i} href={seg.href} label={citationLabel(seg.href)} onOpen={onNavigate} className={CITATION_LINK}>
            {seg.text}
          </CitationLink>
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        ),
      )}
    </>
  );
}

function RevealText({ text, animate, onNavigate }: { text: string; animate: boolean; onNavigate: () => void }) {
  const [shown, setShown] = useState(animate ? 0 : text.length);

  useEffect(() => {
    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text.length);
      return;
    }
    // Long answers speed up so the reveal never takes more than ~1.4s.
    const duration = Math.min(1400, Math.max(500, text.length * 4));
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const target = Math.floor(text.length * progress);
      // Cut at the next space so words appear whole.
      const cut = progress >= 1 ? text.length : text.indexOf(" ", target);
      setShown(cut === -1 ? text.length : cut);
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [text, animate]);

  return (
    <p className="whitespace-pre-wrap">
      {/* Links appear once the reveal is done, so a citation is never shown half-built. */}
      {shown < text.length ? text.slice(0, shown) : <CitedText text={text} onNavigate={onNavigate} />}
      {shown < text.length && <span className="ms-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-noor-500/70" aria-hidden />}
    </p>
  );
}

export function ChatWidget() {
  const { lang } = useLang();
  const { isOpen, closeChat } = useChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [outputLang, setOutputLang] = useState<Lang>(lang);
  const [showTransliteration, setShowTransliteration] = useState(true);
  const [retranslatePending, setRetranslatePending] = useState(false);
  const [stages, setStages] = useState<ChatStage[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  // Saved history (signed-in users): the open conversation, its star, and the drawer.
  const signedIn = useSyncExternalStore(subscribeAuth, () => getToken() !== null, () => false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [starred, setStarred] = useState(false);
  const [notSaved, setNotSaved] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Signing out: this account's conversation must not stay on screen or keep its id.
    const onAuthChange = () => {
      if (getToken() === null) {
        setMessages([]);
        setConversationId(null);
        setStarred(false);
      }
      setNotSaved(false);
    };
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChange);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChange);
  }, []);

  useEffect(() => {
    const tr = localStorage.getItem("noor-show-transliteration");
    if (tr !== null) setShowTransliteration(tr === "1");
  }, []);

  useEffect(() => {
    setOutputLang(lang);
    localStorage.setItem("noor-output-lang", lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem("noor-output-lang", outputLang);
  }, [outputLang]);

  useEffect(() => {
    localStorage.setItem("noor-show-transliteration", showTransliteration ? "1" : "0");
  }, [showTransliteration]);

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, isOpen, stages]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeChat();
    }
    if (isOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, closeChat]);

  /**
   * base: the conversation before this question (defaults to what is on screen). Regenerating
   * an answer in another language passes the turns before the replaced one, with replaceLast so
   * the saved history swaps that turn instead of repeating it.
   */
  async function sendMessage(text: string, langOverride?: Lang, base: ChatMessage[] = messages, replaceLast = false) {
    if (!text.trim() || loading) return;
    const answerLang = langOverride ?? outputLang;
    setError("");
    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const nextHistory = [...base, userMsg];
    // Signed in: every turn belongs to a saved conversation, created with its first question.
    const token = getToken();
    const cid = token ? (conversationId ?? newConversationId()) : null;
    if (cid && cid !== conversationId) setConversationId(cid);
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    setStages([]);
    const started = nowMs();
    setStartedAt(started);
    // Collected alongside state so the finished message can keep them.
    const received: ChatStage[] = [];

    try {
      const history = base.map((m) => ({ role: m.role, content: m.content }));
      const body = {
        message: text.trim(),
        lang: answerLang,
        response_lang: answerLang,
        include_transliteration: showTransliteration,
        history,
        ...(cid ? { conversation_id: cid, replace_last: replaceLast } : {}),
      };
      let data: ChatResponse;
      try {
        data = await streamChat<ChatResponse>(
          body,
          (stage) => {
            received.push(stage);
            setStages((prev) => [...prev.filter((s) => s.stage !== stage.stage), stage]);
          },
          authHeaders,
        );
      } catch (err) {
        // Older backend or a proxy that refuses the stream: same answer, just without live stages.
        if (!(err instanceof StreamUnavailable)) throw err;
        data = await api<ChatResponse>("/api/rag/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify(body),
        });
      }
      if (cid) {
        // An expired session still gets its answer; say plainly that it isn't being kept.
        setNotSaved(data.history_saved === false);
        if (data.history_saved) setHistoryVersion((v) => v + 1);
      }
      setMessages([
        ...nextHistory,
        {
          role: "assistant",
          content: data.answer,
          transliteration: data.transliteration,
          citations: data.citations,
          sources: data.sources,
          notice: data.notice,
          confidence: data.confidence,
          responseLang: answerLang,
          reveal: true,
          question: text.trim(),
          mode: data.mode,
          llmModel: data.llm_model,
          // Cached answers skip the pipeline, so there is nothing to show.
          trail: received.some((s) => s.stage === "found")
            ? { stages: received, ms: nowMs() - started }
            : undefined,
        },
      ]);
    } catch {
      setError(t(lang, "chatError"));
      setMessages(base);
    } finally {
      setLoading(false);
      setRetranslatePending(false);
    }
  }

  function handleNewChat() {
    if (loading) return;
    setMessages([]);
    setInput("");
    setError("");
    setRetranslatePending(false);
    setConversationId(null);
    setStarred(false);
    setNotSaved(false);
    setView("chat");
  }

  async function openConversation(id: string) {
    if (loading || openingId) return;
    setOpeningId(id);
    try {
      const convo = await getChat(id);
      let question = "";
      setMessages(
        convo.messages.map((m): ChatMessage => {
          if (m.role === "user") {
            question = m.content;
            return { role: "user", content: m.content };
          }
          return { role: "assistant", content: m.content, question, ...restoreAnswer(m.meta) };
        }),
      );
      setConversationId(convo.id);
      setStarred(convo.starred);
      setNotSaved(false);
      setError("");
      setRetranslatePending(false);
      setView("chat");
    } catch {
      /* the row stays in the list; tapping again retries */
    } finally {
      setOpeningId(null);
    }
  }

  async function toggleStar() {
    if (!conversationId) return;
    const next = !starred;
    setStarred(next);
    try {
      await updateChat(conversationId, { starred: next });
      setHistoryVersion((v) => v + 1);
    } catch {
      setStarred(!next);
    }
  }

  async function handleOutputLangChange(next: Lang) {
    if (next === outputLang || loading) return;
    setOutputLang(next);
    localStorage.setItem("noor-output-lang", next);

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const hasAssistant = messages.some((m) => m.role === "assistant");
    if (lastUser && hasAssistant) {
      setRetranslatePending(true);
      // The turns before the last question; the question is asked again in the new language.
      const lastUserIndex = messages.lastIndexOf(lastUser);
      const before = messages.slice(0, lastUserIndex);
      setMessages(messages.slice(0, lastUserIndex + 1));
      await sendMessage(lastUser.content, next, before, true);
    }
  }

  const suggestions = SUGGESTIONS[outputLang] ?? SUGGESTIONS.en;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px] dark:bg-black/50 md:bg-transparent md:backdrop-blur-none md:dark:bg-transparent"
          onClick={closeChat}
        />
      )}

      <div
        ref={panelRef}
        dir="ltr"
        // Closed panel is only faded out; inert keeps keyboard and screen readers out of it.
        inert={!isOpen}
        aria-hidden={!isOpen}
        className={`fixed z-50 flex flex-col bg-white shadow-2xl transition-all duration-300 ease-out dark:bg-noor-900 dark:shadow-black/40
          bottom-0 end-0 w-full rounded-t-2xl pb-safe
          h-[calc(85dvh-env(safe-area-inset-bottom,0px))]
          md:bottom-5 md:end-5 md:h-[560px] md:w-[400px] md:rounded-2xl md:border md:border-subtle md:pb-0
          ${isOpen ? "translate-y-0 opacity-100 pointer-events-auto" : "translate-y-8 opacity-0 pointer-events-none"}`}
      >
        <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-heading">{t(lang, view === "history" ? "chatHistory" : "chat")}</h2>
            <p className="truncate text-[10px] text-faint">{t(lang, "chatSubtitle")}</p>
          </div>
          <div className="flex items-center gap-1">
            {signedIn && conversationId && !notSaved && messages.length > 0 && view === "chat" && (
              <button
                type="button"
                onClick={() => void toggleStar()}
                aria-pressed={starred}
                title={t(lang, starred ? "chatUnstar" : "chatStar")}
                aria-label={t(lang, starred ? "chatUnstar" : "chatStar")}
                className={`rounded-lg p-1.5 hover:bg-noor-50 dark:hover:bg-noor-800 ${starred ? "text-gold-500" : "text-faint"}`}
              >
                <StarIcon filled={starred} className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setView((v) => (v === "history" ? "chat" : "history"))}
              aria-pressed={view === "history"}
              title={t(lang, view === "history" ? "chatHistoryBack" : "chatHistoryOpen")}
              aria-label={t(lang, view === "history" ? "chatHistoryBack" : "chatHistoryOpen")}
              className={`rounded-lg p-1.5 hover:bg-noor-50 dark:hover:bg-noor-800 ${view === "history" ? "bg-noor-50 text-accent dark:bg-noor-800" : "text-faint"}`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 4v4h4M12 8v4.5l3 1.8" />
              </svg>
            </button>
            {messages.length > 0 && view === "chat" && (
              <button
                type="button"
                onClick={handleNewChat}
                disabled={loading}
                title={t(lang, "clearChat")}
                aria-label={t(lang, "clearChat")}
                className="rounded-lg p-1.5 text-faint hover:bg-noor-50 disabled:opacity-40 dark:hover:bg-noor-800"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
            <button
              onClick={closeChat}
              className="rounded-lg p-1.5 text-faint hover:bg-noor-50 dark:hover:bg-noor-800"
              aria-label={t(lang, "close")}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {view === "history" ? (
          <ChatHistoryPanel
            lang={lang}
            signedIn={signedIn}
            activeId={conversationId}
            version={historyVersion}
            openingId={openingId}
            onOpen={(id) => void openConversation(id)}
            onNew={handleNewChat}
            onStarChange={(id, value) => id === conversationId && setStarred(value)}
            onDeleted={(id) => {
              if (id === conversationId) {
                setMessages([]);
                setConversationId(null);
                setStarred(false);
              }
            }}
            onLeave={closeChat}
          />
        ) : (
        <>
        <div className="flex flex-wrap items-center gap-2 border-b border-subtle bg-surface-muted px-3 py-2">
          <span className="shrink-0 text-[10px] font-medium uppercase text-faint">{t(lang, "answerIn")}:</span>
          <div className="flex flex-row gap-1">
          {(["en", "ur", "hi"] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => void handleOutputLangChange(l)}
              className={`rounded-md px-2 py-0.5 text-xs font-medium uppercase ${
                outputLang === l
                  ? "bg-noor-700 text-white dark:bg-noor-600"
                  : "border border-noor-200 bg-white text-muted dark:border-noor-600 dark:bg-noor-800"
              }`}
            >
              {l}
            </button>
          ))}
          </div>
          <label className="ms-auto flex items-center gap-1.5 text-[10px] text-muted">
            <input
              type="checkbox"
              checked={showTransliteration}
              onChange={(e) => setShowTransliteration(e.target.checked)}
              className="rounded"
            />
            {t(lang, "transliteration")}
          </label>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {messages.length === 0 && (
            <div className="space-y-2 py-6 text-center">
              <p className="text-xs text-muted">{t(lang, "chatWelcome")}</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="rounded-full border border-noor-200 bg-surface-muted px-2.5 py-1 text-[11px] text-body hover:border-noor-400 dark:border-noor-600 dark:hover:border-noor-400"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {notSaved && signedIn && <p className="rounded-lg bg-surface-muted px-3 py-1.5 text-[10px] text-muted">{t(lang, "chatNotSaved")}</p>}

          {retranslatePending && (
            <p className="px-3 py-1 text-[10px] text-faint">{t(lang, "retranslateHint")}</p>
          )}

          {messages.map((m, i) => {
            const msgDir = m.role === "assistant" ? (m.responseLang === "ur" ? "rtl" : "ltr") : "auto";
            return (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-noor-700 text-white dark:bg-noor-600"
                    : "border border-subtle bg-surface-muted text-noor-900 dark:text-noor-50"
                } ${m.reveal ? "animate-answer-in" : ""}`}
                dir={msgDir}
              >
                {m.role === "assistant" && m.trail && <SearchTrail trail={m.trail} lang={lang} />}

                {m.role === "assistant" && m.notice && (
                  <p className="mb-2 text-[10px] italic text-faint">{m.notice}</p>
                )}

                {m.role === "assistant" ? (
                  <RevealText text={m.content} animate={!!m.reveal} onNavigate={closeChat} />
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}

                {m.role === "assistant" && (m.citations?.length ?? 0) > 0 && (
                  // Always-visible links to what the answer cites: the model doesn't reliably put
                  // [brackets] in its text, but every validated citation is listed here.
                  <div className="mt-2 flex flex-wrap items-center gap-1.5" dir="ltr">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-faint">{t(lang, "chatCitedSources")}</span>
                    {m.citations!.map((ref) => {
                      const label = ref.replace(/^\[|\]$/g, "").replace(/\s*\([a-z_]+\)$/, "");
                      const href = citationHref(ref);
                      return href ? (
                        <CitationLink
                          key={ref}
                          href={href}
                          label={citationLabel(href)}
                          onOpen={closeChat}
                          className="rounded-full border border-noor-200 bg-white px-2 py-0.5 text-[11px] font-medium text-accent hover:border-noor-400 dark:border-noor-600 dark:bg-noor-800"
                        >
                          {label}
                        </CitationLink>
                      ) : (
                        <span key={ref} className="rounded-full border border-subtle px-2 py-0.5 text-[11px] text-muted">
                          {label}
                        </span>
                      );
                    })}
                  </div>
                )}

                {m.role === "assistant" && m.confidence && (
                  <ConfidenceBadge confidence={m.confidence} sources={m.sources} lang={lang} />
                )}

                {m.role === "assistant" && m.transliteration && (
                  <p className="mt-2 border-t border-subtle pt-2 text-xs italic text-faint" dir="ltr">
                    <span className="font-medium not-italic text-accent">{t(lang, "transliteration")}: </span>
                    {m.transliteration}
                  </p>
                )}

                {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                  <details className="mt-2 border-t border-subtle pt-1.5 group">
                    <summary className="cursor-pointer list-none text-xs font-medium text-accent marker:content-none">
                      <span className="inline-flex items-center gap-1">
                        <svg
                          className="h-3 w-3 transition group-open:rotate-90"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        {t(lang, "showSources")} ({m.sources.length})
                      </span>
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {m.sources.map((s, j) => (
                        <li key={j} className="rounded-lg border border-subtle bg-white p-2 text-[11px] dark:bg-noor-800">
                          {citationHref(s.ref) ? (
                            <CitationLink href={citationHref(s.ref)!} label={citationLabel(citationHref(s.ref)!)} onOpen={closeChat} className={CITATION_LINK}>
                              {s.ref}
                            </CitationLink>
                          ) : (
                            <p className="font-medium text-body">{s.ref}</p>
                          )}
                          <p className="mt-1 whitespace-pre-wrap text-muted leading-snug">{s.snippet}</p>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {m.role === "assistant" && m.question && (
                  <ChatFeedback
                    lang={lang}
                    target={{
                      question: m.question,
                      answer: m.content,
                      citations: m.citations ?? [],
                      source_refs: (m.sources ?? []).map((src) => src.ref),
                      lang: m.responseLang,
                      mode: m.mode,
                      llm_model: m.llmModel,
                    }}
                  />
                )}
              </div>
            </div>
          );
          })}

          {loading && (
            <div className="flex justify-start animate-fade-in-up">
              <ChatSearchProgress stages={stages} lang={lang} startedAt={startedAt} />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <div className="px-3 pb-2">
            <NoticeCard
              tone="warning"
              title={t(lang, "answerUnavailable")}
              message={error}
              actionLabel={t(lang, "tryAgain")}
              onAction={() => {
                const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content;
                if (lastUser) void sendMessage(lastUser);
              }}
            />
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex flex-col gap-2 border-t border-subtle p-3 pb-safe sm:flex-row sm:items-end sm:pb-3"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            className="input flex-1 resize-none overflow-hidden text-sm leading-relaxed"
            placeholder={t(lang, "chatPlaceholder")}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
                if (textareaRef.current) textareaRef.current.style.height = "auto";
              }
            }}
            disabled={loading}
            dir="auto"
          />
          <button type="submit" className="btn-primary min-h-11 shrink-0 px-4 text-sm sm:min-h-0 sm:px-3" disabled={loading || !input.trim()}>
            {t(lang, "send")}
          </button>
        </form>
        </>
        )}
      </div>
    </>
  );
}
