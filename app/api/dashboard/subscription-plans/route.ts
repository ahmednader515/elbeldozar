import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createSubscriptionPlan, listSubscriptionPlansAll, swapSubscriptionPlanSortOrder } from "@/lib/db";
import type { SubscriptionDurationKind } from "@/lib/types";

const ICON_KEYS = ["shield", "crown", "star"] as const;
type FeatureInput = { text?: string; included?: boolean };
function parseFeatures(raw: unknown): { text: string; included: boolean }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is FeatureInput => !!f && typeof f === "object")
    .map((f) => ({ text: String(f.text ?? "").trim(), included: !!f.included }))
    .filter((f) => f.text.length > 0);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }
  try {
    const plans = await listSubscriptionPlansAll();
    return NextResponse.json({ plans });
  } catch (e) {
    console.error("GET subscription-plans", e);
    return NextResponse.json({ error: "فشل جلب الباقات" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }
  let body: {
    name?: string;
    description?: string;
    imageUrl?: string | null;
    durationKind?: string;
    price?: number;
    isActive?: boolean;
    badgeLabel?: string | null;
    isFeatured?: boolean;
    iconKey?: string;
    features?: FeatureInput[];
    courseIds?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "اسم الاشتراك مطلوب" }, { status: 400 });
  const dk = body.durationKind as SubscriptionDurationKind | undefined;
  if (dk !== "week" && dk !== "month" && dk !== "year") {
    return NextResponse.json({ error: "اختر مدة: week أو month أو year" }, { status: 400 });
  }
  const price = typeof body.price === "number" && Number.isFinite(body.price) ? Math.max(0, body.price) : 0;
  const iconKey = ICON_KEYS.includes(body.iconKey as (typeof ICON_KEYS)[number]) ? body.iconKey! : "shield";
  const courseIds = Array.isArray(body.courseIds) ? body.courseIds.filter((c): c is string => typeof c === "string" && c.trim().length > 0) : [];
  try {
    const { id } = await createSubscriptionPlan({
      name,
      description: body.description?.trim() ?? "",
      image_url: body.imageUrl?.trim() || null,
      duration_kind: dk,
      price,
      is_active: body.isActive !== false,
      badge_label: body.badgeLabel?.trim() || null,
      is_featured: !!body.isFeatured,
      icon_key: iconKey,
      features: parseFeatures(body.features),
      course_ids: courseIds,
    });
    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error("POST subscription-plans", e);
    return NextResponse.json({ error: "فشل إنشاء الباقة" }, { status: 500 });
  }
}

/** تبديل ترتيب باقتين متجاورتين (زر تحريك لأعلى/أسفل) */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }
  let body: { idA?: string; idB?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
  if (!body.idA?.trim() || !body.idB?.trim()) {
    return NextResponse.json({ error: "معرّفا الباقتين مطلوبان" }, { status: 400 });
  }
  try {
    await swapSubscriptionPlanSortOrder(body.idA.trim(), body.idB.trim());
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("PATCH subscription-plans reorder", e);
    return NextResponse.json({ error: "فشل تغيير الترتيب" }, { status: 500 });
  }
}
