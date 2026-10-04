"use client";

import { useRef, useState } from "react";
import {
  hasFeedbackConsent,
  newFeedbackId,
  rememberFeedbackConsent,
  sendFeedback,
  type FeedbackPayload,
} from "@/lib/chat-feedback";
import { t, type Lang } from "@/lib/i18n";

export type FeedbackTarget = Omit<FeedbackPayload, "id" | "rating" | "comment">;

type Status = "idle" | "consent" | "sending" | "sent" | "error";

function Thumb({ down, filled }: { down?: boolean; filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-3.5 w-3.5 ${down ? "rotate-180" : ""}`}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 10v11M3 11h4v10H3zM7 11l4-8a2.5 2.5 0 0 1 2.5 2.5V9h5.2a2 2 0 0 1 2 2.3l-1.3 8A2 2 0 0 1 17.4 21H7" />
    </svg>
  );
}

/**
 * Thumbs up/down under an answer. The first vote on a device asks for consent (the vote saves
 * the question and answer); a thumbs-down then offers an optional comment, sent as an update
 * to the same vote.
 */
export function ChatFeedback({ target, lang }: { target: FeedbackTarget; lang: Lang }) {
  const id = useRef(newFeedbackId());
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [pending, setPending] = useState<1 | -1 | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [comment, setComment] = useState("");
  const [commentSent, setCommentSent] = useState(false);

  async function submit(value: 1 | -1, note?: string) {
    setStatus("sending");
    try {
      await sendFeedback({ ...target, id: id.current, rating: value, comment: note });
      setRating(value);
      setStatus("sent");
      if (note) setCommentSent(true);
    } catch {
      setStatus("error");
    }
  }

  function vote(value: 1 | -1) {
    if (status === "sending" || value === rating) return;
    if (!hasFeedbackConsent()) {
      setPending(value);
      setStatus("consent");
      return;
    }
    void submit(value);
  }

  return (
    <div className="mt-2 border-t border-subtle pt-1.5" dir="ltr">
      <div className="flex items-center justify-end gap-1">
        {status === "sent" && !commentSent && rating === 1 && (
          <span className="me-auto text-[10px] text-faint">{t(lang, "feedbackThanks")}</span>
        )}
        {([1, -1] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => vote(value)}
            disabled={status === "sending"}
            aria-pressed={rating === value}
            aria-label={t(lang, value === 1 ? "feedbackHelpful" : "feedbackNotHelpful")}
            title={t(lang, value === 1 ? "feedbackHelpful" : "feedbackNotHelpful")}
            className={`rounded-md p-1.5 transition-colors disabled:opacity-50 ${
              rating === value
                ? "bg-noor-100 text-noor-700 dark:bg-noor-800 dark:text-noor-200"
                : "text-faint hover:bg-noor-50 hover:text-body dark:hover:bg-noor-800"
            }`}
          >
            <Thumb down={value === -1} filled={rating === value} />
          </button>
        ))}
      </div>

      {status === "consent" && pending !== null && (
        <div className="mt-1.5 rounded-lg border border-subtle bg-white p-2 text-[11px] dark:bg-noor-800" role="dialog" aria-modal="false">
          <p className="font-semibold text-heading">{t(lang, "feedbackConsentTitle")}</p>
          <p className="mt-0.5 text-muted">{t(lang, "feedbackConsentBody")}</p>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPending(null);
                setStatus("idle");
              }}
              className="rounded-md px-2 py-1 text-muted hover:bg-noor-50 dark:hover:bg-noor-700"
            >
              {t(lang, "feedbackCancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                rememberFeedbackConsent();
                const value = pending;
                setPending(null);
                void submit(value);
              }}
              className="rounded-md bg-noor-700 px-2.5 py-1 font-medium text-white dark:bg-noor-600"
            >
              {t(lang, "feedbackShare")}
            </button>
          </div>
        </div>
      )}

      {(status === "sent" || (status === "error" && comment.trim() !== "")) && rating === -1 && !commentSent && (
        <form
          className="mt-1.5 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (comment.trim()) void submit(-1, comment);
          }}
        >
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            placeholder={t(lang, "feedbackCommentPlaceholder")}
            aria-label={t(lang, "feedbackCommentPlaceholder")}
            dir="auto"
            className="input min-w-0 flex-1 py-1 text-[11px]"
          />
          <button type="submit" disabled={!comment.trim()} className="btn-primary px-2.5 py-1 text-[11px] disabled:opacity-50">
            {t(lang, "send")}
          </button>
        </form>
      )}

      {commentSent && <p className="mt-1 text-end text-[10px] text-faint">{t(lang, "feedbackThanks")}</p>}
      {status === "error" && <p className="mt-1 text-end text-[10px] text-red-600 dark:text-red-400">{t(lang, "feedbackError")}</p>}
    </div>
  );
}
