"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { useDashboardTable, dateLocaleForUi } from "@/lib/i18n/dashboard-table";

type Answer = {
  id: string;
  questionText: string;
  maxScore: number;
  answerText: string;
  awardedScore: number | null;
  feedback: string | null;
  studentName: string;
  studentEmail: string;
  quizTitle: string;
  courseTitle: string;
  createdAt: string;
};

export function EssayGradingList() {
  const t = useT();
  const L = "dashboard.essayGradingPage";
  const { dir, locale } = useDashboardTable();
  const dateLocale = dateLocaleForUi(locale);
  const [list, setList] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [drafts, setDrafts] = useState<Record<string, { score: string; feedback: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<Record<string, string>>({});

  function load() {
    setLoading(true);
    setLoadError(null);
    fetch("/api/dashboard/essay-answers")
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error ?? t(`${L}.loadFailed`, "Failed to load essay answers"));
        return data;
      })
      .then((data) => {
        const rows: Answer[] = Array.isArray(data.answers) ? data.answers : [];
        setList(rows);
        setDrafts((prev) => {
          const next = { ...prev };
          for (const a of rows) {
            if (!next[a.id]) {
              next[a.id] = { score: a.awardedScore != null ? String(a.awardedScore) : "", feedback: a.feedback ?? "" };
            }
          }
          return next;
        });
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : t(`${L}.loadFailed`, "Failed to load essay answers")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = list.filter((a) => (filter === "pending" ? a.awardedScore == null : true));

  async function handleSave(a: Answer) {
    const draft = drafts[a.id];
    const score = Number(draft?.score);
    if (!Number.isFinite(score) || score < 0 || score > a.maxScore) {
      setSaveError((e) => ({ ...e, [a.id]: t(`${L}.invalidScore`, "Enter a score between 0 and the max") }));
      return;
    }
    setSavingId(a.id);
    setSaveError((e) => ({ ...e, [a.id]: "" }));
    try {
      const res = await fetch(`/api/dashboard/essay-answers/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ awardedScore: score, feedback: draft?.feedback ?? "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError((e) => ({ ...e, [a.id]: data.error ?? t(`${L}.saveFailed`, "Failed to save score") }));
        return;
      }
      setList((prev) => prev.map((x) => (x.id === a.id ? { ...x, awardedScore: score, feedback: draft?.feedback ?? "" } : x)));
    } catch {
      setSaveError((e) => ({ ...e, [a.id]: t(`${L}.saveFailed`, "Failed to save score") }));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div dir={dir} className="mt-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter("pending")}
          className={`rounded-[var(--radius-btn)] border px-4 py-2 text-sm font-medium transition ${
            filter === "pending"
              ? "border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
              : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-border)]/50"
          }`}
        >
          {t(`${L}.filterPending`, "Ungraded")}
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-[var(--radius-btn)] border px-4 py-2 text-sm font-medium transition ${
            filter === "all"
              ? "border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
              : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-border)]/50"
          }`}
        >
          {t(`${L}.filterAll`, "All")}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-muted)]">{t(`${L}.loading`, "Loading...")}</p>
      ) : loadError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          {filter === "pending" ? t(`${L}.noPending`, "No essay answers waiting for grading.") : t(`${L}.noAnswers`, "No essay answers yet.")}
        </p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((a) => (
            <li key={a.id} className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--color-muted)]">
                <span>
                  <span className="font-medium text-[var(--color-foreground)]">{a.studentName}</span> ({a.studentEmail})
                </span>
                <span>
                  {a.courseTitle} — {a.quizTitle}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-[var(--color-foreground)]">{a.questionText}</p>
              <p className="mt-2 whitespace-pre-wrap rounded border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-sm text-[var(--color-foreground)]">
                {a.answerText || t(`${L}.emptyAnswer`, "(No answer written)")}
              </p>
              {a.awardedScore != null && (
                <p className="mt-2 text-sm text-[var(--color-success)]">
                  {t(`${L}.currentScore`, "Current score:")} {a.awardedScore} / {a.maxScore}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-[var(--color-muted)]">
                    {t(`${L}.scoreLabel`, "Score (out of")} {a.maxScore})
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={a.maxScore}
                    value={drafts[a.id]?.score ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [a.id]: { ...d[a.id], score: e.target.value, feedback: d[a.id]?.feedback ?? "" } }))}
                    className="mt-1 w-24 rounded border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-[var(--color-muted)]">{t(`${L}.feedbackLabel`, "Feedback (optional)")}</label>
                  <input
                    type="text"
                    value={drafts[a.id]?.feedback ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [a.id]: { score: d[a.id]?.score ?? "", feedback: e.target.value } }))}
                    className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSave(a)}
                  disabled={savingId === a.id}
                  className="rounded-[var(--radius-btn)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
                >
                  {savingId === a.id ? t(`${L}.saving`, "Saving...") : t(`${L}.saveScore`, "Save score")}
                </button>
              </div>
              {saveError[a.id] ? <p className="mt-1 text-sm text-red-600 dark:text-red-400">{saveError[a.id]}</p> : null}
              <p className="mt-2 text-xs text-[var(--color-muted)]">{new Date(a.createdAt).toLocaleString(dateLocale)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
