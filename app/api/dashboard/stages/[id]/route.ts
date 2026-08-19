import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateStage, deleteStage } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }
  const { id } = await params;
  let body: { nameAr?: string; nameEn?: string | null; order?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
  const patch: { nameAr?: string; nameEn?: string | null; order?: number } = {};
  if (body.nameAr !== undefined) {
    const nameAr = body.nameAr.trim();
    if (!nameAr) return NextResponse.json({ error: "اسم المرحلة مطلوب" }, { status: 400 });
    patch.nameAr = nameAr;
  }
  if (body.nameEn !== undefined) patch.nameEn = body.nameEn?.trim() || null;
  if (body.order !== undefined) patch.order = body.order;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "لا توجد حقول للتحديث" }, { status: 400 });
  }
  try {
    await updateStage(id, patch);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("PATCH dashboard/stages/[id]", e);
    return NextResponse.json({ error: "فشل التحديث" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }
  const { id } = await params;
  try {
    await deleteStage(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE dashboard/stages/[id]", e);
    return NextResponse.json({ error: "تعذر الحذف" }, { status: 500 });
  }
}
