import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLessonProgressForUserCourse, getUserById } from "@/lib/db";

/** تقدم مشاهدة محاضرات كورس لطالب — للأدمن/مساعد الأدمن */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session?.user?.id ||
      (session.user.role !== "ADMIN" && session.user.role !== "ASSISTANT_ADMIN")
    ) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id: studentId } = await params;
    const courseId = request.nextUrl.searchParams.get("courseId")?.trim();
    if (!studentId || !courseId) {
      return NextResponse.json({ error: "معرّفات غير صالحة" }, { status: 400 });
    }

    const student = await getUserById(studentId);
    if (!student || student.role !== "STUDENT") {
      return NextResponse.json({ error: "الطالب غير موجود" }, { status: 404 });
    }

    const lessons = await getLessonProgressForUserCourse(studentId, courseId);
    return NextResponse.json({ lessons });
  } catch (e) {
    console.error("API dashboard student lesson-progress:", e);
    return NextResponse.json({ error: "تعذر تحميل تقدم المشاهدة" }, { status: 500 });
  }
}
