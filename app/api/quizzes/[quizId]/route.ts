import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getQuizById,
  getEnrollment,
  getAllowedQuizIdsForUserCourse,
  countCompletedQuizAttemptsByUserAndCourse,
  createQuizAttemptReturningId,
  updateQuizAttemptById,
  hasFullCourseAccessAsStudent,
  canUserAccessQuiz,
  saveQuizEssayAnswers,
  getMissingRequiredHomeworkForQuiz,
} from "@/lib/db";

/**
 * جلب اختبار بالمعرّف — مع التحقق من حد المحاولات إن وُجد.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    if (!quizId || quizId.length < 20) {
      return NextResponse.json({ error: "معرّف الاختبار غير صالح" }, { status: 400 });
    }

    const result = await getQuizById(quizId);

    if (!result || !result.course) {
      return NextResponse.json({ error: "الاختبار غير موجود" }, { status: 404 });
    }

    const isPublished = result.course.isPublished ?? result.course.is_published;
    if (!isPublished) {
      return NextResponse.json({ error: "الدورة غير منشورة" }, { status: 404 });
    }

    const courseId = (result.quiz.courseId ?? result.quiz.course_id) as string;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
    }
    const role = (session.user as { role?: string }).role;
    const isStaff = role === "ADMIN" || role === "ASSISTANT_ADMIN";
    if (!isStaff) {
      const canAccess = await canUserAccessQuiz(session.user.id, courseId, quizId);
      if (!canAccess) {
        return NextResponse.json(
          { error: "غير مسجّل في هذه الدورة أو لا تملك صلاحية لهذا الاختبار" },
          { status: 403 }
        );
      }
    }

    const maxAttempts = result.course.max_quiz_attempts ?? result.course.maxQuizAttempts;
    let canAttempt = true;
    let attemptsUsed = 0;
    if (session?.user?.id && typeof maxAttempts === "number" && maxAttempts > 0) {
      const enrolled = await getEnrollment(session.user.id, courseId);
      const fullCourse = await hasFullCourseAccessAsStudent(session.user.id, courseId);
      const allowedQuizIds = !enrolled && !fullCourse
        ? await getAllowedQuizIdsForUserCourse(session.user.id, courseId)
        : [];
      if (enrolled || fullCourse || allowedQuizIds.includes(quizId)) {
        attemptsUsed = await countCompletedQuizAttemptsByUserAndCourse(session.user.id, courseId);
        if (attemptsUsed >= maxAttempts) {
          canAttempt = false;
        }
      }
    }

    let missingHomeworkLessons: Array<{ id: string; title: string; titleAr: string | null }> = [];
    if (!isStaff && canAttempt) {
      missingHomeworkLessons = await getMissingRequiredHomeworkForQuiz(session.user.id, quizId);
      if (missingHomeworkLessons.length > 0) canAttempt = false;
    }

    const rawLimit = result.quiz.timeLimitMinutes ?? result.quiz.time_limit_minutes;
    let timeLimitMinutes: number | null = null;
    if (rawLimit != null && rawLimit !== "") {
      const n = Math.floor(Number(rawLimit));
      if (Number.isFinite(n) && n >= 1) {
        timeLimitMinutes = Math.min(24 * 60, n);
      }
    }

    const payload = {
      id: result.quiz.id,
      title: result.quiz.title,
      courseId: result.quiz.courseId ?? result.quiz.course_id,
      order: result.quiz.order,
      timeLimitMinutes,
      course: {
        id: result.course.id,
        slug: result.course.slug,
        title: result.course.title,
        titleAr: result.course.titleAr ?? result.course.title_ar,
      },
      questions: result.questions.map((q) => ({
        id: q.id,
        type: q.type,
        questionText: q.questionText ?? q.question_text,
        order: q.order,
        maxScore: (q as { maxScore?: number | null; max_score?: number | null }).maxScore ?? (q as { max_score?: number | null }).max_score ?? null,
        options: (q.options ?? []).map((o: Record<string, unknown>) => ({
          id: o.id,
          text: o.text,
          isCorrect: o.isCorrect ?? o.is_correct,
        })),
      })),
      maxQuizAttempts: typeof maxAttempts === "number" ? maxAttempts : null,
      attemptsUsed,
      canAttempt,
      missingHomeworkLessons: missingHomeworkLessons.map((l) => ({ id: l.id, title: l.title, titleAr: l.titleAr })),
    };

    if (!canAttempt) {
      const isHomeworkBlock = missingHomeworkLessons.length > 0;
      const names = missingHomeworkLessons.map((l) => l.titleAr ?? l.title).join("، ");
      return NextResponse.json(
        {
          error: isHomeworkBlock
            ? `يجب رفع واجبات الحصص التالية أولاً: ${names}`
            : "تم استنفاد عدد المحاولات المسموح بها لهذا الاختبار في الكورس.",
          ...payload,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(payload);
  } catch (e) {
    console.error("API quizzes [quizId]:", e);
    return NextResponse.json(
      { error: "حدث خطأ في جلب الاختبار" },
      { status: 500 }
    );
  }
}

/** تسجيل نتيجة محاولة الاختبار */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
    }

    const { quizId } = await params;
    if (!quizId || quizId.length < 20) {
      return NextResponse.json({ error: "معرّف الاختبار غير صالح" }, { status: 400 });
    }

    let body: {
      score?: number;
      totalQuestions?: number;
      attemptId?: string | null;
      essayAnswers?: Array<{ questionId?: string; answerText?: string }>;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
    }

    const score = Number(body.score ?? 0);
    const totalQuestions = Number(body.totalQuestions ?? 0);
    if (totalQuestions < 1) {
      return NextResponse.json({ error: "عدد الأسئلة غير صالح" }, { status: 400 });
    }

    const result = await getQuizById(quizId);
    if (!result || !result.course) {
      return NextResponse.json({ error: "الاختبار غير موجود" }, { status: 404 });
    }

    const courseId = (result.quiz.courseId ?? result.quiz.course_id) as string;
    const role = (session.user as { role?: string }).role;
    const isStaff = role === "ADMIN" || role === "ASSISTANT_ADMIN";
    const canAccess = await canUserAccessQuiz(session.user.id, courseId, quizId, { isStaff });
    if (!canAccess) {
      return NextResponse.json({ error: "غير مسجّل في هذه الدورة" }, { status: 403 });
    }

    const attemptId = typeof body.attemptId === "string" && body.attemptId.trim() ? body.attemptId.trim() : null;

    // إذا وُجد attemptId فالمحاولة حُسبت عند البدء — لا نرفض التسليم بحد المحاولات
    if (!attemptId) {
      const maxAttempts = result.course.max_quiz_attempts ?? result.course.maxQuizAttempts;
      if (typeof maxAttempts === "number" && maxAttempts > 0) {
        const used = await countCompletedQuizAttemptsByUserAndCourse(session.user.id, courseId);
        if (used >= maxAttempts) {
          return NextResponse.json({ error: "تم استنفاد المحاولات" }, { status: 403 });
        }
      }
    }

    let finalAttemptId: string | null = attemptId;
    if (attemptId) {
      const ok = await updateQuizAttemptById({
        attemptId,
        userId: session.user.id,
        quizId,
        score,
        totalQuestions,
      });
      if (!ok) {
        finalAttemptId = await createQuizAttemptReturningId(session.user.id, quizId, score, totalQuestions);
      }
    } else {
      finalAttemptId = await createQuizAttemptReturningId(session.user.id, quizId, score, totalQuestions);
    }

    if (finalAttemptId && Array.isArray(body.essayAnswers) && body.essayAnswers.length > 0) {
      const essayQuestions = new Map(
        result.questions.filter((q) => q.type === "ESSAY").map((q) => [q.id as string, q])
      );
      const essayAnswers = body.essayAnswers
        .filter(
          (a): a is { questionId: string; answerText?: string } =>
            !!a && typeof a.questionId === "string" && essayQuestions.has(a.questionId)
        )
        .map((a) => {
          const q = essayQuestions.get(a.questionId)!;
          const maxScore = Number((q as { maxScore?: number | null; max_score?: number | null }).maxScore ?? (q as { max_score?: number | null }).max_score ?? 5) || 5;
          return { questionId: a.questionId, answerText: String(a.answerText ?? "").slice(0, 20000), maxScore };
        });
      if (essayAnswers.length > 0) {
        await saveQuizEssayAnswers({
          attemptId: finalAttemptId,
          userId: session.user.id,
          quizId,
          courseId,
          answers: essayAnswers,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("API quizzes [quizId] POST:", e);
    return NextResponse.json({ error: "حدث خطأ في تسجيل النتيجة" }, { status: 500 });
  }
}
