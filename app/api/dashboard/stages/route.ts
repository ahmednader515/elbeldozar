import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listStages, createStage } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }
  try {
    const stages = await listStages();
    return NextResponse.json({ stages });
  } catch (e) {
    console.error("GET dashboard/stages", e);
    return NextResponse.json({ error: "فشل جلب المراحل" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }
  let body: { nameAr?: string; nameEn?: string | null; order?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
  const nameAr = body.nameAr?.trim();
  if (!nameAr) return NextResponse.json({ error: "اسم المرحلة مطلوب" }, { status: 400 });
  try {
    const { id } = await createStage({
      nameAr,
      nameEn: body.nameEn?.trim() || null,
      order: typeof body.order === "number" ? body.order : 0,
    });
    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error("POST dashboard/stages", e);
    return NextResponse.json({ error: "فشل إنشاء المرحلة" }, { status: 500 });
  }
}
