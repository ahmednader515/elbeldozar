import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { listStages } from "@/lib/db";
import { StagesAdminClient } from "./StagesAdminClient";

export default async function StagesDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  let stages: Awaited<ReturnType<typeof listStages>> = [];
  try {
    stages = await listStages();
  } catch {
    stages = [];
  }

  return <StagesAdminClient initialStages={stages} />;
}
