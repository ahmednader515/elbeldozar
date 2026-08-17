import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listQuizEssayAnswersForAdmin } from "@/lib/db";

/** كل إجابات الأسئلة المقالية — للأدمن ومساعد الأدمن */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ASSISTANT_ADMIN")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  try {
    const answers = await listQuizEssayAnswersForAdmin();
    return NextResponse.json({ answers });
  } catch (e) {
    console.error("API essay-answers GET:", e);
    return NextResponse.json({ error: "تعذر تحميل الإجابات المقالية" }, { status: 500 });
  }
}
