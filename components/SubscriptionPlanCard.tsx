"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type SubscriptionPlanFeatureData = { text: string; included: boolean };

export type SubscriptionPlanCardData = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  durationKind: string;
  price: number;
  badgeLabel: string | null;
  isFeatured: boolean;
  iconKey: string;
  features: SubscriptionPlanFeatureData[];
};

function durationLabel(kind: string): string {
  if (kind === "week") return "أسبوع";
  if (kind === "month") return "شهر";
  if (kind === "year") return "سنة";
  return kind;
}

const ADD_BALANCE_HREF = "/dashboard/add-balance";

function formatRenewalDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("ar-EG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

function PlanIcon({ iconKey }: { iconKey: string }) {
  if (iconKey === "crown") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
        <path
          d="M3 8.5 6.5 11l3-5 2.5 4.5L14.5 6l3 5L21 8.5l-1.5 8.5h-15L3 8.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M5.5 19.5h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (iconKey === "star") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
        <path
          d="M12 3.5 14.6 9l6 .9-4.3 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.3-4.2 6-.9 2.6-5.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
      <path
        d="M12 3 5 5.5V11c0 4.8 3 8.4 7 9.5 4-1.1 7-4.7 7-9.5V5.5L12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="m9.2 12 1.9 1.9 3.7-3.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckCircle() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0" aria-hidden>
      <circle cx="10" cy="10" r="9" fill="var(--color-accent)" fillOpacity="0.18" />
      <circle cx="10" cy="10" r="9" stroke="var(--color-accent)" strokeWidth="1.3" />
      <path d="m6.5 10.2 2.2 2.2 4.8-5" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XCircle() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0" aria-hidden>
      <circle cx="10" cy="10" r="9" fill="#ef4444" fillOpacity="0.12" />
      <circle cx="10" cy="10" r="9" stroke="#ef4444" strokeOpacity="0.55" strokeWidth="1.3" />
      <path d="m7.2 7.2 5.6 5.6M12.8 7.2l-5.6 5.6" stroke="#ef4444" strokeOpacity="0.75" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function SubscriptionPlanCard({
  plan,
  isStudent,
  isLoggedIn,
  hasActivePlatformSubscription = false,
  activePlatformSubscriptionExpiresAtIso = null,
}: {
  plan: SubscriptionPlanCardData;
  isStudent: boolean;
  isLoggedIn: boolean;
  /** للطالب: هل لديه اشتراك منصة نشط (أي باقة) */
  hasActivePlatformSubscription?: boolean;
  /** تاريخ انتهاء الاشتراك النشط (ISO) */
  activePlatformSubscriptionExpiresAtIso?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [showAddBalanceLink, setShowAddBalanceLink] = useState(false);
  /** تاريخ انتهاء الاشتراك بعد نجاح الشراء (ISO) */
  const [successExpiresAt, setSuccessExpiresAt] = useState<string | null>(null);

  const activeSubExpiryFormatted =
    hasActivePlatformSubscription && activePlatformSubscriptionExpiresAtIso
      ? formatRenewalDate(activePlatformSubscriptionExpiresAtIso)
      : null;

  async function purchase() {
    setErr("");
    setInfoMessage("");
    setShowAddBalanceLink(false);
    setSuccessExpiresAt(null);
    if (isStudent && hasActivePlatformSubscription) {
      const line = activeSubExpiryFormatted
        ? `اشتراكك في المنصة نشط حتى ${activeSubExpiryFormatted}. `
        : "لديك اشتراك منصة نشط. ";
      setInfoMessage(
        `${line}لا تحتاج لدفع مرة أخرى؛ يمكنك تجديد أو شراء باقة جديدة بعد انتهاء هذه المدة فقط.`,
      );
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/subscriptions/purchase", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      let data: {
        success?: boolean;
        expiresAt?: string;
        error?: string;
        insufficientBalance?: boolean;
        alreadySubscribed?: boolean;
      } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        data = {};
      }
      if (!res.ok) {
        if (data.alreadySubscribed && typeof data.error === "string") {
          setInfoMessage(data.error);
        } else {
          setErr(typeof data.error === "string" ? data.error : "تعذر إتمام الشراء");
          setShowAddBalanceLink(!!data.insufficientBalance);
        }
        return;
      }
      if (typeof data.expiresAt !== "string" || !data.expiresAt.trim()) {
        setErr(
          "تم تنفيذ الطلب لكن لم يُرجع الخادم تاريخ انتهاء الاشتراك. إن خُصم من رصيدك، راجع لوحة التحكم أو أعد تحميل الصفحة.",
        );
        router.refresh();
        return;
      }
      setSuccessExpiresAt(data.expiresAt.trim());
      router.refresh();
    } catch {
      setErr("تعذر الاتصال بالخادم. تحقق من الشبكة ثم أعد المحاولة.");
    } finally {
      setLoading(false);
    }
  }

  const priceStr = Number(plan.price).toFixed(0);
  const loginHref = `/login?callbackUrl=${encodeURIComponent("/")}`;
  const chipLabel = plan.badgeLabel?.trim() || durationLabel(plan.durationKind);
  const featured = plan.isFeatured;

  return (
    <article
      className={`subscription-plan-card relative mx-auto flex w-full max-w-sm flex-col rounded-2xl border px-6 pb-6 pt-8 shadow-[var(--shadow-card)] transition sm:px-7 ${
        featured ? "border-2 shadow-2xl md:-translate-y-3 md:scale-[1.03]" : "border-[var(--color-border)]"
      }`}
      style={{
        background: "var(--color-surface)",
        borderColor: featured ? "var(--color-accent)" : undefined,
      }}
      dir="rtl"
    >
      {featured && (
        <div className="absolute -top-4 left-1/2 z-[1] -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-lg" style={{ background: "var(--color-accent)" }}>
          ⭐ الأكثر اختياراً
        </div>
      )}

      <div className="flex flex-col items-center text-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            color: featured ? "var(--color-accent)" : "var(--color-muted)",
            background: featured ? "color-mix(in srgb, var(--color-accent) 15%, transparent)" : "var(--color-background)",
            border: `2px solid ${featured ? "var(--color-accent)" : "var(--color-border)"}`,
          }}
        >
          <PlanIcon iconKey={plan.iconKey} />
        </div>

        <h3 className="mt-3 text-lg font-bold text-[var(--color-foreground)]">{plan.name}</h3>

        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-4xl font-extrabold tabular-nums text-[var(--color-foreground)]">{priceStr}</span>
          <span className="text-sm font-medium text-[var(--color-muted)]">جنيه</span>
        </div>

        <span
          className="mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            background: featured ? "var(--color-accent)" : "var(--color-primary)",
            color: "#fff",
          }}
        >
          {chipLabel}
        </span>

        {isStudent && hasActivePlatformSubscription ? (
          <p className="mt-3 text-xs leading-relaxed text-emerald-600 dark:text-emerald-300/95">
            {activeSubExpiryFormatted ? (
              <>
                أنت مشترك حتى <span className="font-semibold">{activeSubExpiryFormatted}</span>.
              </>
            ) : (
              <>أنت مشترك في اشتراك المنصة.</>
            )}
          </p>
        ) : null}
      </div>

      <div className="my-5 h-px w-full" style={{ background: "var(--color-border)" }} />

      {plan.features.length > 0 ? (
        <ul className="space-y-2.5">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              {f.included ? <CheckCircle /> : <XCircle />}
              <span className={f.included ? "text-[var(--color-foreground)]" : "text-[var(--color-muted)]"}>{f.text}</span>
            </li>
          ))}
        </ul>
      ) : plan.description?.trim() ? (
        <p className="text-center text-sm leading-relaxed text-[var(--color-muted)]">{plan.description.trim()}</p>
      ) : (
        <p className="text-center text-sm text-[var(--color-muted)]">وصول لجميع الكورسات المدفوعة المنشورة طوال مدة الاشتراك.</p>
      )}

      <div className="mt-6 flex flex-col gap-2.5">
        {isStudent ? (
          <button
            type="button"
            onClick={purchase}
            disabled={loading}
            className={`w-full rounded-xl px-5 py-3 text-center text-sm font-bold shadow-md transition ${
              hasActivePlatformSubscription
                ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
                : "text-white hover:opacity-90 disabled:opacity-50"
            }`}
            style={hasActivePlatformSubscription ? undefined : { backgroundColor: featured ? "var(--color-accent)" : "var(--color-primary)" }}
          >
            {loading
              ? "جاري الشراء…"
              : hasActivePlatformSubscription
                ? "أنت مشترك — التفاصيل"
                : "اشتر الآن"}
          </button>
        ) : isLoggedIn ? (
          <span className="rounded-xl px-3 py-2 text-center text-xs text-[var(--color-muted)]" style={{ background: "var(--color-background)" }}>
            للطلاب فقط
          </span>
        ) : (
          <Link
            href={loginHref}
            className="w-full rounded-xl px-5 py-3 text-center text-sm font-bold text-white shadow-md transition hover:opacity-90"
            style={{ backgroundColor: featured ? "var(--color-accent)" : "var(--color-primary)" }}
          >
            اشتر كطالب
          </Link>
        )}
        {isStudent ? (
          <Link
            href="/courses"
            className="w-full rounded-xl border px-3 py-2 text-center text-xs font-semibold text-[var(--color-foreground)] transition hover:bg-[var(--color-border)]/40"
            style={{ borderColor: "var(--color-border)" }}
          >
            عرض الكورسات
          </Link>
        ) : !isLoggedIn ? (
          <Link
            href={loginHref}
            className="w-full rounded-xl border px-3 py-2 text-center text-xs font-semibold text-[var(--color-foreground)] transition hover:bg-[var(--color-border)]/40"
            style={{ borderColor: "var(--color-border)" }}
          >
            تسجيل الدخول
          </Link>
        ) : null}
      </div>

      {infoMessage ? (
        <div className="mt-4 rounded-xl border border-amber-500/45 bg-amber-500/10 p-3 text-center text-sm leading-relaxed text-amber-700 dark:text-amber-100">
          {infoMessage}
        </div>
      ) : null}

      {successExpiresAt ? (
        <div
          className="mt-4 space-y-2 rounded-xl border border-emerald-500/45 bg-emerald-500/10 p-4 text-center"
          role="status"
        >
          <p className="text-base font-bold text-emerald-700 dark:text-emerald-200">تم الاشتراك بنجاح</p>
          <p className="text-sm leading-relaxed text-emerald-700/90 dark:text-emerald-100/95">
            موعد انتهاء اشتراكك الحالي (وبداية دورة التجديد التالية إن رغبت بالتمديد):{" "}
            <span className="block pt-1 font-semibold text-[var(--color-foreground)] sm:inline sm:pt-0">
              {formatRenewalDate(successExpiresAt)}
            </span>
          </p>
          <Link
            href="/courses"
            className="mt-2 inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90"
            style={{ background: "var(--color-primary)" }}
          >
            الانتقال إلى الكورسات
          </Link>
        </div>
      ) : null}

      {err ? (
        <div className="mt-4 space-y-2 text-center">
          <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
          {showAddBalanceLink ? (
            <Link
              href={ADD_BALANCE_HREF}
              className="inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition"
              style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}
            >
              إضافة رصيد في حسابك
            </Link>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
