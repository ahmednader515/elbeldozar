"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/LocaleProvider";
import { useDashboardTable } from "@/lib/i18n/dashboard-table";
import { fillMessage } from "@/lib/i18n/interpolate";

export type StageRow = { id: string; nameAr: string; nameEn: string | null; order: number };

export function StagesAdminClient({ initialStages }: { initialStages: StageRow[] }) {
  const router = useRouter();
  const t = useT();
  const St = "dashboard.stagesAdmin";
  const { dir, thClass } = useDashboardTable();

  const [stages, setStages] = useState(initialStages);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [order, setOrder] = useState("0");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameAr, setEditNameAr] = useState("");
  const [editNameEn, setEditNameEn] = useState("");
  const [editOrder, setEditOrder] = useState("0");
  const [editLoading, setEditLoading] = useState(false);

  async function reload() {
    const res = await fetch("/api/dashboard/stages", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { stages?: StageRow[] };
    if (data.stages) setStages(data.stages);
  }

  async function createStageSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!nameAr.trim()) {
      setError(t(`${St}.nameRequired`, "Stage name is required"));
      return;
    }
    setFormLoading(true);
    const res = await fetch("/api/dashboard/stages", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameAr: nameAr.trim(), nameEn: nameEn.trim() || null, order: parseInt(order, 10) || 0 }),
    });
    const data = await res.json().catch(() => ({}));
    setFormLoading(false);
    if (!res.ok) {
      setError(data.error ?? t(`${St}.createFailed`, "Failed to create stage"));
      return;
    }
    setSuccess(t(`${St}.createSuccess`, "Stage created"));
    setNameAr("");
    setNameEn("");
    setOrder("0");
    await reload();
    router.refresh();
  }

  function startEdit(row: StageRow) {
    setError("");
    setSuccess("");
    setEditingId(row.id);
    setEditNameAr(row.nameAr);
    setEditNameEn(row.nameEn ?? "");
    setEditOrder(String(row.order));
  }

  async function saveEdit(id: string) {
    if (!editNameAr.trim()) {
      setError(t(`${St}.nameRequired`, "Stage name is required"));
      return;
    }
    setEditLoading(true);
    setError("");
    const res = await fetch(`/api/dashboard/stages/${encodeURIComponent(id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameAr: editNameAr.trim(), nameEn: editNameEn.trim() || null, order: parseInt(editOrder, 10) || 0 }),
    });
    const data = await res.json().catch(() => ({}));
    setEditLoading(false);
    if (!res.ok) {
      setError(data.error ?? t(`${St}.updateFailed`, "Failed to update stage"));
      return;
    }
    setEditingId(null);
    await reload();
    router.refresh();
  }

  async function removeStage(row: StageRow) {
    const ok = window.confirm(fillMessage(t(`${St}.confirmDelete`, "Delete stage «{name}»? Students/courses using it will fall back to no stage restriction."), { name: row.nameAr }));
    if (!ok) return;
    setError("");
    const res = await fetch(`/api/dashboard/stages/${encodeURIComponent(row.id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? t(`${St}.deleteFailed`, "Failed to delete"));
      return;
    }
    if (editingId === row.id) setEditingId(null);
    await reload();
    router.refresh();
  }

  return (
    <div className="space-y-8" dir={dir}>
      <div>
        <h2 className="text-xl font-bold text-[var(--color-foreground)]">{t(`${St}.pageTitle`, "Educational stages")}</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          {t(`${St}.pageIntro`, "Manage the list of grade levels. Students pick one at signup, and courses can be tagged with one to control subscription-based access.")}
        </p>
      </div>

      {error ? <div className="rounded-[var(--radius-btn)] bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</div> : null}
      {success ? <div className="rounded-[var(--radius-btn)] bg-[var(--color-primary)]/10 px-3 py-2 text-sm text-[var(--color-primary)]">{success}</div> : null}

      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="text-lg font-semibold text-[var(--color-foreground)]">{t(`${St}.addStageTitle`, "Add a new stage")}</h3>
        <form onSubmit={createStageSubmit} className="mt-4 grid max-w-lg gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)]">{t(`${St}.labelNameAr`, "Name (Arabic)")}</label>
            <input
              required
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder={t(`${St}.nameArPlaceholder`, "e.g. ثالثة إعدادي")}
              className="mt-1 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-[var(--color-foreground)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)]">{t(`${St}.labelNameEn`, "Name (English, optional)")}</label>
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className="mt-1 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-[var(--color-foreground)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)]">{t(`${St}.labelOrder`, "Display order")}</label>
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              className="mt-1 w-32 rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-[var(--color-foreground)]"
            />
          </div>
          <button
            type="submit"
            disabled={formLoading}
            className="w-fit rounded-[var(--radius-btn)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {formLoading ? t(`${St}.savingBusy`, "Saving...") : t(`${St}.addStageBtn`, "Add stage")}
          </button>
        </form>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="text-lg font-semibold text-[var(--color-foreground)]">{t(`${St}.currentStagesTitle`, "Current stages")}</h3>
        <div className="mt-4 overflow-x-auto" dir={dir}>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <th className={thClass}>{t(`${St}.colNameAr`, "Name (Arabic)")}</th>
                <th className={thClass}>{t(`${St}.colNameEn`, "Name (English)")}</th>
                <th className={thClass}>{t(`${St}.colOrder`, "Order")}</th>
                <th className={thClass}>{t(`${St}.colActions`, "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {stages.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[var(--color-muted)]">
                    {t(`${St}.emptyStages`, "No stages yet.")}
                  </td>
                </tr>
              ) : (
                stages.map((row) =>
                  editingId === row.id ? (
                    <tr key={row.id} className="border-b border-[var(--color-border)]/60">
                      <td className="px-3 py-2">
                        <input
                          value={editNameAr}
                          onChange={(e) => setEditNameAr(e.target.value)}
                          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={editNameEn}
                          onChange={(e) => setEditNameEn(e.target.value)}
                          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={editOrder}
                          onChange={(e) => setEditOrder(e.target.value)}
                          className="w-20 rounded border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void saveEdit(row.id)}
                            disabled={editLoading}
                            className="rounded-[var(--radius-btn)] bg-[var(--color-primary)] px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                          >
                            {t(`${St}.save`, "Save")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-[var(--radius-btn)] border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-border)]/40"
                          >
                            {t(`${St}.cancel`, "Cancel")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id} className="border-b border-[var(--color-border)]/60">
                      <td className="px-3 py-2 font-medium">{row.nameAr}</td>
                      <td className="px-3 py-2 text-[var(--color-muted)]">{row.nameEn || "—"}</td>
                      <td className="px-3 py-2 tabular-nums text-[var(--color-muted)]">{row.order}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            className="rounded-[var(--radius-btn)] border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-border)]/40"
                          >
                            {t(`${St}.edit`, "Edit")}
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeStage(row)}
                            className="rounded-[var(--radius-btn)] border border-red-500/40 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400"
                          >
                            {t(`${St}.delete`, "Delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
