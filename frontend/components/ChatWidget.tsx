"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@/components/ChatProvider";
import { useLang } from "@/components/LangProvider";
import { NoticeCard } from "@/components/NoticeCard";
import { Tooltip } from "@/components/Tooltip";
import { api } from "@/lib/api";
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

export function ChatWidget() {
  const { lang } = useLang();
  const { isOpen, closeChat, toggleChat } = useChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [outputLang, setOutputLang] = useState<Lang>("en");
  const [showTransliteration, setShowTransliteration] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("noor-output-lang") as Lang | null;
    if (saved && ["en", "ur", "hi"].includes(saved)) setOutputLang(saved);
    const tr = localStorage.getItem("noor-show-transliteration");
    if (tr !== null) setShowTransliteration(tr === "1");
  }, []);

  useEffect(() => {
    localStorage.setItem("noor-output-lang", outputLang);
  }, [outputLang]);

  useEffect(() => {
    localStorage.setItem("noor-show-transliteration", showTransliteration ? "1" : "0");
  }, [showTransliteration]);

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, isOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeChat();
    }
    if (isOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, closeChat]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    setError("");
    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const data = await api<ChatResponse>("/api/rag/chat", {
        method: "POST",
        body: JSON.stringify({
          message: text.trim(),
          lang: outputLang,
          response_lang: outputLang,
          include_transliteration: showTransliteration,
          history,
        }),
      });
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
        },
      ]);
    } catch (err) {
      setError(t(lang, "chatError"));
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  }

  const suggestions = SUGGESTIONS[lang] ?? SUGGESTIONS.en;
  const answerDir = outputLang === "ur" ? "rtl" : "ltr";

  return (
    <>
      <div className={`bottom-safe-5 fixed right-5 z-50 transition-opacity duration-300 ${isOpen ? "pointer-events-none opacity-0" : "opacity-100"}`}>
        <Tooltip label={t(lang, "chat")} side="top">
          <button
            type="button"
            onClick={toggleChat}
            aria-label={t(lang, "chat")}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-noor-700 text-white shadow-lg transition-transform duration-150 hover:scale-105 hover:bg-noor-800 hover:shadow-xl active:scale-95 dark:bg-noor-600 dark:hover:bg-noor-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
              <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z" clipRule="evenodd" />
            </svg>
          </button>
        </Tooltip>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px] dark:bg-black/50 md:bg-transparent md:backdrop-blur-none md:dark:bg-transparent"
          onClick={closeChat}
        />
      )}

      <div
        ref={panelRef}
        className={`fixed z-50 flex flex-col bg-white shadow-2xl transition-all duration-300 ease-out dark:bg-noor-900 dark:shadow-black/40
          bottom-0 right-0 w-full rounded-t-2xl pb-safe
          h-[calc(85dvh-env(safe-area-inset-bottom,0px))]
          md:bottom-5 md:right-5 md:h-[560px] md:w-[400px] md:rounded-2xl md:border md:border-subtle md:pb-0
          ${isOpen ? "translate-y-0 opacity-100 pointer-events-auto" : "translate-y-8 opacity-0 pointer-events-none"}`}
      >
        <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
          <div>
            <h2 className="font-semibold text-heading">{t(lang, "chat")}</h2>
            <p className="text-[10px] text-faint">{t(lang, "chatSubtitle")}</p>
          </div>
          <button
            onClick={closeChat}
            className="rounded-lg p-1.5 text-faint hover:bg-noor-50 dark:hover:bg-noor-800"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-subtle bg-surface-muted px-3 py-2">
          <span className="text-[10px] font-medium uppercase text-faint">{t(lang, "answerIn")}:</span>
          {(["en", "ur", "hi"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setOutputLang(l)}
              className={`rounded-md px-2 py-0.5 text-xs font-medium uppercase ${
                outputLang === l
                  ? "bg-noor-700 text-white dark:bg-noor-600"
                  : "border border-noor-200 bg-white text-muted dark:border-noor-600 dark:bg-noor-800"
              }`}
            >
              {l}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1.5 text-[10px] text-muted">
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

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-noor-700 text-white dark:bg-noor-600"
                    : "border border-subtle bg-surface-muted text-noor-900 dark:text-noor-50"
                }`}
                dir={m.role === "assistant" ? answerDir : "auto"}
              >
                {m.role === "assistant" && m.notice && (
                  <p className="mb-2 text-[10px] italic text-faint">{m.notice}</p>
                )}

                <p className="whitespace-pre-wrap">{m.content}</p>

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
                          <p className="font-medium text-body">{s.ref}</p>
                          <p className="mt-1 whitespace-pre-wrap text-muted leading-snug">{s.snippet}</p>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-subtle bg-surface-muted px-3 py-2 text-xs text-faint">
                {t(lang, "chatThinking")}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <div className="px-3 pb-2">
            <NoticeCard
              tone="warning"
              title="Answer unavailable"
              message={error}
              actionLabel="Try again"
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
          className="flex flex-col gap-2 border-t border-subtle p-3 pb-safe sm:flex-row sm:pb-3"
        >
          <input
            className="input flex-1 text-sm"
            placeholder={t(lang, "chatPlaceholder")}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            dir="auto"
          />
          <button type="submit" className="btn-primary min-h-11 shrink-0 px-4 text-sm sm:min-h-0 sm:px-3" disabled={loading || !input.trim()}>
            {t(lang, "send")}
          </button>
        </form>
      </div>
    </>
  );
}
