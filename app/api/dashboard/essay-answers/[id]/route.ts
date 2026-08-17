import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { gradeQuizEssayAnswer } from "@/lib/db";

/** تصحيح إجابة سؤال مقالي — للأدمن ومساعد الأدمن */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ASSISTANT_ADMIN")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id } = await params;

  let body: { awardedScore?: number; feedback?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const awardedScore = Number(body.awardedScore);
  if (!Number.isFinite(awardedScore) || awardedScore < 0) {
    return NextResponse.json({ error: "الدرجة غير صالحة" }, { status: 400 });
  }

  try {
    const ok = await gradeQuizEssayAnswer({
      id,
      awardedScore,
      feedback: typeof body.feedback === "string" ? body.feedback : null,
      gradedByUserId: session.user.id,
    });
    if (!ok) {
      return NextResponse.json({ error: "الإجابة غير موجودة" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("API essay-answers PATCH:", e);
    return NextResponse.json({ error: "تعذر حفظ الدرجة" }, { status: 500 });
  }
}
