import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  getUsersByRole,
  getEnrollmentsWithCourseByUserId,
  getAccessibleCoursesForUser,
  getCoursesPublished,
  backfillMissingStudentCopyrightCodes,
  listStages,
} from "@/lib/db";
import { getServerTranslator } from "@/lib/i18n/server";
import { StudentsList } from "./StudentsList";
import { StaffAccountsSection } from "./StaffAccountsSection";

export default async function StudentsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "ASSISTANT_ADMIN") {
    redirect("/dashboard");
  }
  const t = await getServerTranslator();

  const isAdmin = session.user.role === "ADMIN";
  const isAssistant = session.user.role === "ASSISTANT_ADMIN";

  await backfillMissingStudentCopyrightCodes().catch(() => {});

  const [rows, coursesList, stages] = await Promise.all([
    getUsersByRole("STUDENT"),
    getCoursesPublished(true),
    listStages().catch(() => []),
  ]);

  let admins: Awaited<ReturnType<typeof getUsersByRole>> = [];
  let assistantAdmins: Awaited<ReturnType<typeof getUsersByRole>> = [];
  if (isAdmin) {
    [admins, assistantAdmins] = await Promise.all([
      getUsersByRole("ADMIN"),
      getUsersByRole("ASSISTANT_ADMIN"),
    ]);
  }

  const enrollmentsByUser = await Promise.all(rows.map((s) => getEnrollmentsWithCourseByUserId(s.id)));
  // كورسات متاحة للطالب بوصول جزئي (كود حصص/اختبارات محددة) أو اشتراك منصة — لا يوجد لها Enrollment
  // نجلبها لعرض حالة مشاهدة المحاضرات لهؤلاء الطلاب أيضاً في لوحة الأدمن (وليس فقط المسجَّلين بالكامل)
  const accessibleByUser = await Promise.all(rows.map((s) => getAccessibleCoursesForUser(s.id).catch(() => [])));

  const students = rows.map((s, i) => {
    const row = s as unknown as Record<string, unknown>;
    const enrolledCourseIds = new Set(enrollmentsByUser[i].map((e) => e.course_id));
    return {
    id: s.id,
    name: s.name,
    email: s.email,
    role: s.role,
    balance: Number(s.balance),
    student_number: s.student_number ?? null,
    guardian_number: s.guardian_number ?? null,
    stage_id: (row.stageId as string | null | undefined) ?? (s as { stage_id?: string | null }).stage_id ?? null,
    copyright_code: (row.copyright_code as string | null | undefined) ?? (s as { copyright_code?: string | null }).copyright_code ?? null,
    _count: { enrollments: enrollmentsByUser[i].length },
    enrollments: enrollmentsByUser[i].map((e) => ({
      id: e.id,
      courseId: e.course_id,
      course: { id: e.course.id, title: e.course.title, titleAr: e.course.titleAr, slug: e.course.slug },
    })),
    partialAccessCourses: accessibleByUser[i]
      .filter((c) => !enrolledCourseIds.has(c.id))
      .map((c) => ({ id: c.id, title: c.title, titleAr: (c as { titleAr?: string | null }).titleAr ?? null })),
    };
  });

  const coursesPlain = coursesList.map((c) => {
    const row = c as unknown as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      title: String(row.title ?? ""),
      titleAr: (row.titleAr != null ? String(row.titleAr) : null) as string | null,
      slug: String(row.slug ?? ""),
    };
  });

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-[var(--color-foreground)]">
        {isAdmin
          ? t("dashboard.studentsPage.pageTitleAccounts", "Students & accounts")
          : t("dashboard.studentsPage.pageTitleStudentsOnly", "Student list")}
      </h2>
      {isAdmin && (
        <StaffAccountsSection
          admins={admins.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }))}
          assistantAdmins={assistantAdmins.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }))}
        />
      )}
      <div className={isAdmin ? "mt-8" : ""}>
        <h3 className="mb-4 text-lg font-semibold text-[var(--color-foreground)]">
          {t("dashboard.studentsPage.studentListHeading", "Student list")}
        </h3>
        <StudentsList
          students={students}
          courses={coursesPlain}
          stages={stages}
          isAdmin={isAdmin}
          canAddBalance={isAdmin || isAssistant}
          canManageEnrollments={isAdmin}
          canEditFullProfile={isAdmin}
        />
      </div>
    </div>
  );
}
