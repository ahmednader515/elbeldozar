import { NextResponse } from "next/server";
import { listStages } from "@/lib/db";

export const dynamic = "force-dynamic";

/** قائمة المراحل الدراسية — عامة، تُستخدم في صفحة التسجيل قبل تسجيل الدخول */
export async function GET() {
  const stages = await listStages();
  return NextResponse.json({ stages });
}
