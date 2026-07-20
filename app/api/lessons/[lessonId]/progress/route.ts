import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getAllowedLessonIdsForUserCourse,
  getEnrollment,
  getLessonById,
  hasFullCourseAccessAsStudent,
  upsertLessonProgress,
} from "@/lib/db";

async function canAccessLesson(
  userId: string,
  role: string,
  lessonId: string,
  courseId: string
): Promise<boolean> {
  if (role === "ADMIN" || role === "ASSISTANT_ADMIN") return true;
  if (await getEnrollment(userId, courseId)) return true;
  if (role === "STUDENT") {
    if (await hasFullCourseAccessAsStudent(userId, courseId)) return true;
    const partial = await getAllowedLessonIdsForUserCourse(userId, courseId);
    if (partial.includes(lessonId)) return true;
  }
  return false;
}

/** تسجيل تقدم مشاهدة المحاضرة للطالب */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { lessonId } = await params;
    if (!lessonId) {
      return NextResponse.json({ error: "معرّف الحصة غير صالح" }, { status: 400 });
    }

    const lesson = await getLessonById(lessonId);
    if (!lesson) {
      return NextResponse.json({ error: "الحصة غير موجودة" }, { status: 404 });
    }

    const allowed = await canAccessLesson(
      session.user.id,
      session.user.role,
      lesson.id,
      lesson.course_id
    );
    if (!allowed) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    let body: {
      watchedSeconds?: number;
      durationSeconds?: number | null;
      completed?: boolean;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
    }

    const watchedSeconds = Number(body.watchedSeconds ?? 0);
    if (!Number.isFinite(watchedSeconds) || watchedSeconds < 0) {
      return NextResponse.json({ error: "وقت المشاهدة غير صالح" }, { status: 400 });
    }

    await upsertLessonProgress({
      userId: session.user.id,
      lessonId: lesson.id,
      courseId: lesson.course_id,
      watchedSeconds,
      durationSeconds: body.durationSeconds ?? null,
      completed: Boolean(body.completed),
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("API lessons progress POST:", e);
    return NextResponse.json({ error: "تعذر حفظ التقدم" }, { status: 500 });
  }
}
