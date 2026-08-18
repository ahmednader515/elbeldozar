import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getSubscriptionsFeatureEnabled, listSubscriptionPlansAll, getCoursesPublished } from "@/lib/db";
import { SubscriptionsAdminClient, type AdminPlanRow } from "./SubscriptionsAdminClient";

export default async function SubscriptionsDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const enabled = await getSubscriptionsFeatureEnabled();
  let plans: AdminPlanRow[] = [];
  try {
    const rows = await listSubscriptionPlansAll();
    plans = rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      imageUrl: r.imageUrl,
      durationKind: r.durationKind,
      price: r.price,
      isActive: r.isActive,
      badgeLabel: r.badgeLabel,
      isFeatured: r.isFeatured,
      iconKey: r.iconKey,
      features: r.features,
      sortOrder: r.sortOrder,
      courseIds: r.courseIds,
    }));
  } catch {
    plans = [];
  }

  let courses: { id: string; title: string; titleAr: string | null }[] = [];
  try {
    const rows = await getCoursesPublished(false);
    courses = rows.map((c) => ({
      id: c.id,
      title: c.title,
      titleAr: (c as { titleAr?: string | null }).titleAr ?? null,
    }));
  } catch {
    courses = [];
  }

  return <SubscriptionsAdminClient initialEnabled={enabled} initialPlans={plans} courses={courses} />;
}
