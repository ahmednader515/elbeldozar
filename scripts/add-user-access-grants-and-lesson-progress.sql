-- منح وصول دائم للحصص/الاختبارات عبر أكواد جزئية + تتبع مشاهدة المحاضرات
-- تشغيله مرة واحدة من لوحة Neon: SQL Editor (أو يُنشأ تلقائياً عبر ensure في lib/db.ts)

CREATE TABLE IF NOT EXISTS "UserLessonAccess" (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  course_id       TEXT NOT NULL REFERENCES "Course"(id) ON DELETE CASCADE,
  lesson_id       TEXT NOT NULL REFERENCES "Lesson"(id) ON DELETE CASCADE,
  source_code_id  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_lesson_access_unique UNIQUE (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS "UserLessonAccess_user_course_idx" ON "UserLessonAccess"(user_id, course_id);
CREATE INDEX IF NOT EXISTS "UserLessonAccess_lesson_idx" ON "UserLessonAccess"(lesson_id);

CREATE TABLE IF NOT EXISTS "UserQuizAccess" (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  course_id       TEXT NOT NULL REFERENCES "Course"(id) ON DELETE CASCADE,
  quiz_id         TEXT NOT NULL REFERENCES "Quiz"(id) ON DELETE CASCADE,
  source_code_id  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_quiz_access_unique UNIQUE (user_id, quiz_id)
);

CREATE INDEX IF NOT EXISTS "UserQuizAccess_user_course_idx" ON "UserQuizAccess"(user_id, course_id);
CREATE INDEX IF NOT EXISTS "UserQuizAccess_quiz_idx" ON "UserQuizAccess"(quiz_id);

CREATE TABLE IF NOT EXISTS "LessonProgress" (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  lesson_id        TEXT NOT NULL REFERENCES "Lesson"(id) ON DELETE CASCADE,
  course_id        TEXT NOT NULL REFERENCES "Course"(id) ON DELETE CASCADE,
  watched_seconds  INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER,
  completed        BOOLEAN NOT NULL DEFAULT FALSE,
  last_watched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lesson_progress_unique_user_lesson UNIQUE (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS "LessonProgress_user_course_idx" ON "LessonProgress"(user_id, course_id);
CREATE INDEX IF NOT EXISTS "LessonProgress_course_idx" ON "LessonProgress"(course_id);

-- ترحيل المنح الحالية من أكواد مستخدمة إلى جداول الوصول الدائم
INSERT INTO "UserLessonAccess" (id, user_id, course_id, lesson_id, source_code_id, created_at)
SELECT
  ('ula_' || ac.id || '_' || acl.lesson_id),
  ac.used_by_user_id,
  ac.course_id,
  acl.lesson_id,
  ac.id,
  COALESCE(ac.used_at, NOW())
FROM "ActivationCode" ac
JOIN "ActivationCodeLesson" acl ON acl.activation_code_id = ac.id
WHERE ac.used_at IS NOT NULL AND ac.used_by_user_id IS NOT NULL
ON CONFLICT (user_id, lesson_id) DO NOTHING;

INSERT INTO "UserQuizAccess" (id, user_id, course_id, quiz_id, source_code_id, created_at)
SELECT
  ('uqa_' || ac.id || '_' || acq.quiz_id),
  ac.used_by_user_id,
  ac.course_id,
  acq.quiz_id,
  ac.id,
  COALESCE(ac.used_at, NOW())
FROM "ActivationCode" ac
JOIN "ActivationCodeQuiz" acq ON acq.activation_code_id = ac.id
WHERE ac.used_at IS NOT NULL AND ac.used_by_user_id IS NOT NULL
ON CONFLICT (user_id, quiz_id) DO NOTHING;
