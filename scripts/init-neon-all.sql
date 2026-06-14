-- ============================================================
-- تهيئة قاعدة بيانات Neon — ملف واحد شامل
-- يدمج init-neon-database.sql + جميع scripts/add-*.sql
-- تشغيل هذا الملف مرة واحدة من لوحة Neon: SQL Editor
--
-- يشمل: الجداول الأساسية، أكواد التفعيل، البث المباشر، التعليقات،
-- إعدادات الصفحة الرئيسية، المدرسين، الواجبات، الرسائل، المتجر،
-- الاشتراكات، تقييمات الدروس، وطلبات تغيير كلمة المرور.
-- ============================================================

-- 1) المستخدمون
CREATE TABLE IF NOT EXISTS "User" (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  name           TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'STUDENT' CHECK (role IN ('ADMIN', 'ASSISTANT_ADMIN', 'STUDENT', 'TEACHER')),
  balance        DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) التصنيفات
CREATE TABLE IF NOT EXISTS "Category" (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  name_ar     TEXT,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url   TEXT,
  "order"        INT NOT NULL DEFAULT 0,
  created_by_id  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3) الكورسات (تعتمد على User و Category)
CREATE TABLE IF NOT EXISTS "Course" (
  id                  TEXT PRIMARY KEY,
  title               TEXT NOT NULL,
  title_ar            TEXT,
  slug                TEXT NOT NULL UNIQUE,
  description         TEXT NOT NULL,
  description_en      TEXT,
  short_desc          VARCHAR(300),
  short_desc_en       VARCHAR(300),
  image_url           TEXT,
  price               DECIMAL(10, 2) NOT NULL DEFAULT 0,
  duration            TEXT,
  level               TEXT,
  is_published        BOOLEAN NOT NULL DEFAULT false,
  "order"             INT NOT NULL DEFAULT 0,
  max_quiz_attempts   INT,
  category_id         TEXT REFERENCES "Category"(id) ON DELETE SET NULL,
  created_by_id       TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "Course_slug_idx" ON "Course"(slug);
CREATE INDEX IF NOT EXISTS "Course_category_id_idx" ON "Course"(category_id);
CREATE INDEX IF NOT EXISTS "Course_created_by_id_idx" ON "Course"(created_by_id);
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS short_desc_en VARCHAR(300);

-- 4) الدروس
CREATE TABLE IF NOT EXISTS "Lesson" (
  id         TEXT PRIMARY KEY,
  course_id  TEXT NOT NULL REFERENCES "Course"(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  title_ar   TEXT,
  slug       TEXT NOT NULL,
  content    TEXT,
  video_url  TEXT,
  pdf_url    TEXT,
  duration   INT,
  "order"    INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(course_id, slug)
);

CREATE INDEX IF NOT EXISTS "Lesson_course_id_idx" ON "Lesson"(course_id);

-- 5) الاختبارات
CREATE TABLE IF NOT EXISTS "Quiz" (
  id                  TEXT PRIMARY KEY,
  course_id           TEXT NOT NULL REFERENCES "Course"(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  "order"             INT NOT NULL DEFAULT 0,
  time_limit_minutes   INT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "Quiz_course_id_idx" ON "Quiz"(course_id);

-- 6) أسئلة الاختبار
CREATE TABLE IF NOT EXISTS "Question" (
  id            TEXT PRIMARY KEY,
  quiz_id       TEXT NOT NULL REFERENCES "Quiz"(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('MULTIPLE_CHOICE', 'ESSAY', 'TRUE_FALSE')),
  question_text TEXT NOT NULL,
  "order"       INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "Question_quiz_id_idx" ON "Question"(quiz_id);

-- 7) خيارات الأسئلة
CREATE TABLE IF NOT EXISTS "QuestionOption" (
  id          TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES "Question"(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  is_correct  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "QuestionOption_question_id_idx" ON "QuestionOption"(question_id);

-- 8) التسجيل في الكورسات
CREATE TABLE IF NOT EXISTS "Enrollment" (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  course_id   TEXT NOT NULL REFERENCES "Course"(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS "Enrollment_user_id_idx" ON "Enrollment"(user_id);
CREATE INDEX IF NOT EXISTS "Enrollment_course_id_idx" ON "Enrollment"(course_id);

-- 8.5) أكواد التفعيل (لكورس كامل أو حصص محددة)
CREATE TABLE IF NOT EXISTS "ActivationCode" (
  id               TEXT PRIMARY KEY,
  course_id        TEXT NOT NULL REFERENCES "Course"(id) ON DELETE CASCADE,
  code             TEXT NOT NULL UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at          TIMESTAMPTZ,
  used_by_user_id  TEXT REFERENCES "User"(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "ActivationCode_course_id_idx" ON "ActivationCode"(course_id);
CREATE INDEX IF NOT EXISTS "ActivationCode_code_idx" ON "ActivationCode"(code);
CREATE INDEX IF NOT EXISTS "ActivationCode_created_at_idx" ON "ActivationCode"(created_at);

-- ربط الكود بحصص محددة داخل الكورس (اختياري)
CREATE TABLE IF NOT EXISTS "ActivationCodeLesson" (
  activation_code_id TEXT NOT NULL REFERENCES "ActivationCode"(id) ON DELETE CASCADE,
  lesson_id          TEXT NOT NULL REFERENCES "Lesson"(id) ON DELETE CASCADE,
  PRIMARY KEY (activation_code_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS "ActivationCodeLesson_code_idx" ON "ActivationCodeLesson"(activation_code_id);
CREATE INDEX IF NOT EXISTS "ActivationCodeLesson_lesson_idx" ON "ActivationCodeLesson"(lesson_id);

-- ربط الكود باختبارات محددة داخل الكورس (اختياري)
CREATE TABLE IF NOT EXISTS "ActivationCodeQuiz" (
  activation_code_id TEXT NOT NULL REFERENCES "ActivationCode"(id) ON DELETE CASCADE,
  quiz_id            TEXT NOT NULL REFERENCES "Quiz"(id) ON DELETE CASCADE,
  PRIMARY KEY (activation_code_id, quiz_id)
);

CREATE INDEX IF NOT EXISTS "ActivationCodeQuiz_code_idx" ON "ActivationCodeQuiz"(activation_code_id);
CREATE INDEX IF NOT EXISTS "ActivationCodeQuiz_quiz_idx" ON "ActivationCodeQuiz"(quiz_id);

-- 9) محاولات الاختبار
CREATE TABLE IF NOT EXISTS "QuizAttempt" (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  quiz_id         TEXT NOT NULL REFERENCES "Quiz"(id) ON DELETE CASCADE,
  score           INT NOT NULL,
  total_questions INT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "QuizAttempt_user_quiz_idx" ON "QuizAttempt"(user_id, quiz_id);
CREATE INDEX IF NOT EXISTS "QuizAttempt_user_id_idx" ON "QuizAttempt"(user_id);

-- 10) المدفوعات (رصيد مدفوع — أرباح المنصة)
CREATE TABLE IF NOT EXISTS "Payment" (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  course_id  TEXT NOT NULL REFERENCES "Course"(id) ON DELETE CASCADE,
  amount     DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "Payment_created_at_idx" ON "Payment"(created_at);

-- 11) البث المباشر
CREATE TABLE IF NOT EXISTS "LiveStream" (
  id                TEXT PRIMARY KEY,
  course_id         TEXT NOT NULL REFERENCES "Course"(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  title_ar          TEXT,
  provider          TEXT NOT NULL CHECK (provider IN ('zoom', 'google_meet')),
  meeting_url       TEXT NOT NULL,
  meeting_id        TEXT,
  meeting_password  TEXT,
  scheduled_at      TIMESTAMPTZ NOT NULL,
  description       TEXT,
  "order"           INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "LiveStream_course_id_idx" ON "LiveStream"(course_id);
CREATE INDEX IF NOT EXISTS "LiveStream_scheduled_at_idx" ON "LiveStream"(scheduled_at);

-- إضافة أعمدة اختيارية للمستخدم (لو الجدول قديم)
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS student_number      TEXT,
  ADD COLUMN IF NOT EXISTS guardian_number     TEXT,
  ADD COLUMN IF NOT EXISTS current_session_id  TEXT;

-- إضافة وقت الاختبار بالدقائق للاختبارات (لو الجدول قديم)
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS time_limit_minutes INT;

-- طلبات تغيير كلمة المرور (نسيان كلمة المرور — تنفيذها الأدمن)
CREATE TABLE IF NOT EXISTS "PasswordChangeRequest" (
  id                            TEXT PRIMARY KEY,
  user_id                       TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  new_password_hash             TEXT NOT NULL,
  requested_identifier         TEXT,
  requested_old_password       TEXT,
  requested_new_password_plain TEXT,
  status                        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at                  TIMESTAMPTZ,
  processed_by_id               TEXT REFERENCES "User"(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "PasswordChangeRequest_user_id_idx" ON "PasswordChangeRequest"(user_id);
CREATE INDEX IF NOT EXISTS "PasswordChangeRequest_status_idx" ON "PasswordChangeRequest"(status);
CREATE INDEX IF NOT EXISTS "PasswordChangeRequest_created_at_idx" ON "PasswordChangeRequest"(created_at DESC);
ALTER TABLE "PasswordChangeRequest" ADD COLUMN IF NOT EXISTS requested_identifier TEXT;
ALTER TABLE "PasswordChangeRequest" ADD COLUMN IF NOT EXISTS requested_old_password TEXT;
ALTER TABLE "PasswordChangeRequest" ADD COLUMN IF NOT EXISTS requested_new_password_plain TEXT;

-- إضافة عمود القسم للكورسات لو الجدول قديم وبدون العمود
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Course' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE "Course" ADD COLUMN category_id TEXT REFERENCES "Category"(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS "Course_category_id_idx" ON "Course"(category_id);
  END IF;
END $$;

-- 12) تعليقات الطلاب (للصفحة الرئيسية)
CREATE TABLE IF NOT EXISTS "Review" (
  id             TEXT PRIMARY KEY,
  text           TEXT NOT NULL,
  text_en        TEXT,
  author_name    TEXT NOT NULL,
  author_title   TEXT,
  author_title_en TEXT,
  avatar_letter  TEXT,
  image_url      TEXT,
  "order"        INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "Review_order_idx" ON "Review"("order");
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS text_en TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS author_title_en TEXT;

-- 13) إعدادات الصفحة الرئيسية (صورة المدرس، النصوص، روابط واتساب/فيسبوك، عنوان التبويب، لون الهيرو، نصوص الفوتر)
CREATE TABLE IF NOT EXISTS "HomepageSetting" (
  id                  TEXT PRIMARY KEY DEFAULT 'default',
  teacher_image_url   TEXT,
  hero_title          TEXT,
  hero_slogan         TEXT,
  platform_name       TEXT,
  youtube_url         TEXT,
  linkedin_url        TEXT,
  whatsapp_url        TEXT,
  facebook_url        TEXT,
  telegram_url        TEXT,
  team_youtube_url    TEXT,
  team_linkedin_url   TEXT,
  team_whatsapp_url   TEXT,
  team_facebook_url   TEXT,
  team_telegram_url   TEXT,
  social_right_label  TEXT,
  social_left_label   TEXT,
  social_left_enabled BOOLEAN NOT NULL DEFAULT true,
  page_title          TEXT,
  hero_bg_preset      TEXT,
  footer_title        TEXT,
  footer_tagline      TEXT,
  footer_copyright    TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- لو الجدول كان موجوداً قديماً بدون الأعمدة الجديدة نضيفها
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS whatsapp_url TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS youtube_url TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS telegram_url TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS team_whatsapp_url TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS team_facebook_url TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS team_youtube_url TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS team_linkedin_url TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS team_telegram_url TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS social_right_label TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS social_left_label TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS social_right_label_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS social_left_label_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS social_left_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS page_title TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS page_title_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero_bg_preset TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero_bg_custom_from TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero_bg_custom_to TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS copyright_overlay_style TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS platform_name_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero_title_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero_slogan_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS footer_title TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS footer_title_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS footer_tagline TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS footer_tagline_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS footer_copyright TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS footer_copyright_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS reviews_section_title_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS reviews_section_subtitle_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS cta_badge_text_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS cta_title_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS cta_description_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS cta_button_text_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero3_title_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero3_subtitle_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS platform_details_title_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS platform_details_subtitle_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS platform_news_section_title_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS add_balance_title_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS add_balance_subtitle_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS add_balance_method_title_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS add_balance_transfer_instruction_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS add_balance_confirmation_note_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS add_balance_whatsapp_button_text_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS add_balance_waiting_note_en TEXT;

-- إدراج الصف الافتراضي إن لم يكن موجوداً
INSERT INTO "HomepageSetting" (id, teacher_image_url, hero_title, hero_slogan, platform_name, whatsapp_url, facebook_url, team_whatsapp_url, team_facebook_url, page_title, hero_bg_preset, footer_title, footer_tagline, footer_copyright, updated_at)
VALUES (
  'default',
  '/instructor.png',
  'أستاذ / عصام محي',
  'ادرسها... يمكن تفهم المعلومة صح!',
  'منصة أستاذ عصام محي',
  'https://wa.me/966553612356',
  'https://www.facebook.com/profile.php?id=61562686209159',
  NULL,
  NULL,
  'منصتي التعليمية | دورات وتعلم أونلاين',
  'navy',
  'منصتي التعليمية',
  'تعلم بأسلوب حديث ومنهجية واضحة',
  'منصتي التعليمية. جميع الحقوق محفوظة.',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- تعيين قيم افتراضية للأعمدة الجديدة لو الصف كان موجوداً من قبل
UPDATE "HomepageSetting"
SET
  whatsapp_url     = COALESCE(whatsapp_url, 'https://wa.me/966553612356'),
  facebook_url     = COALESCE(facebook_url, 'https://www.facebook.com/profile.php?id=61562686209159'),
  youtube_url      = COALESCE(youtube_url, NULL),
  linkedin_url     = COALESCE(linkedin_url, NULL),
  telegram_url     = COALESCE(telegram_url, NULL),
  team_youtube_url = COALESCE(team_youtube_url, NULL),
  team_linkedin_url = COALESCE(team_linkedin_url, NULL),
  team_whatsapp_url = COALESCE(team_whatsapp_url, NULL),
  team_facebook_url = COALESCE(team_facebook_url, NULL),
  team_telegram_url = COALESCE(team_telegram_url, NULL),
  social_right_label = COALESCE(NULLIF(TRIM(social_right_label), ''), 'الدعم'),
  social_left_label = COALESCE(NULLIF(TRIM(social_left_label), ''), 'دعم الفريق'),
  social_left_enabled = COALESCE(social_left_enabled, true),
  page_title       = COALESCE(page_title, 'منصتي التعليمية | دورات وتعلم أونلاين'),
  hero_bg_preset   = COALESCE(hero_bg_preset, 'navy'),
  copyright_overlay_style = COALESCE(copyright_overlay_style, 'floating'),
  footer_title     = COALESCE(footer_title, 'منصتي التعليمية'),
  footer_tagline   = COALESCE(footer_tagline, 'تعلم بأسلوب حديث ومنهجية واضحة'),
  footer_copyright = COALESCE(footer_copyright, 'منصتي التعليمية. جميع الحقوق محفوظة.'),
  updated_at       = NOW()
WHERE id = 'default';

-- ============================================================
-- 14) Category.created_by_id (add-category-if-missing)
-- ============================================================
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS created_by_id TEXT;

-- ============================================================
-- 15) User: TEACHER + حقوق الطبع + حقول المدرس
--     (add-teachers-multi, add-user-copyright-code, add-teacher-homepage-order)
-- ============================================================
DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'TEACHER';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $fix$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname AS cname
    FROM pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'User'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%role%'
      AND pg_get_constraintdef(con.oid) NOT ILIKE '%TEACHER%'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', 'public', 'User', r.cname);
  END LOOP;
END
$fix$;
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_role_allowed_values_check";
ALTER TABLE "User" ADD CONSTRAINT "User_role_allowed_values_check"
  CHECK (role IN ('ADMIN', 'ASSISTANT_ADMIN', 'STUDENT', 'TEACHER'));

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS copyright_code VARCHAR(10);
CREATE UNIQUE INDEX IF NOT EXISTS user_copyright_code_unique
  ON "User" (copyright_code)
  WHERE copyright_code IS NOT NULL AND TRIM(copyright_code) <> '';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS teacher_subject TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS teacher_avatar_url TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS teacher_homepage_order INTEGER;

-- ============================================================
-- 16) الواجبات (add-homework, add-homework-lesson)
-- ============================================================
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS accepts_homework BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS accepts_homework BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "HomeworkSubmission" (
  id              TEXT PRIMARY KEY,
  course_id       TEXT NOT NULL REFERENCES "Course"(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  submission_type TEXT NOT NULL CHECK (submission_type IN ('link', 'pdf', 'image')),
  link_url        TEXT,
  file_url        TEXT,
  file_name       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "HomeworkSubmission_course_id_idx" ON "HomeworkSubmission"(course_id);
CREATE INDEX IF NOT EXISTS "HomeworkSubmission_user_id_idx" ON "HomeworkSubmission"(user_id);
CREATE INDEX IF NOT EXISTS "HomeworkSubmission_created_at_idx" ON "HomeworkSubmission"(created_at);

ALTER TABLE "HomeworkSubmission" ADD COLUMN IF NOT EXISTS lesson_id TEXT REFERENCES "Lesson"(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "HomeworkSubmission_lesson_id_idx" ON "HomeworkSubmission"(lesson_id);

-- ============================================================
-- 17) الرسائل والمحادثات (add-messages)
-- ============================================================
CREATE TABLE IF NOT EXISTS "Conversation" (
  id              TEXT PRIMARY KEY,
  staff_user_id   TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  student_user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(staff_user_id, student_user_id)
);
CREATE INDEX IF NOT EXISTS "Conversation_staff_user_id_idx" ON "Conversation"(staff_user_id);
CREATE INDEX IF NOT EXISTS "Conversation_student_user_id_idx" ON "Conversation"(student_user_id);

CREATE TABLE IF NOT EXISTS "Message" (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES "Conversation"(id) ON DELETE CASCADE,
  sender_id       TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  message_type    TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'file')),
  content         TEXT,
  file_url        TEXT,
  file_name       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "Message_conversation_id_idx" ON "Message"(conversation_id);
CREATE INDEX IF NOT EXISTS "Message_created_at_idx" ON "Message"(created_at);

-- ============================================================
-- 18) المتجر (add-store-feature, add-store-purchases, add-store-home-section-copy)
-- ============================================================
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS store_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS store_section_title TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS store_section_description TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS store_section_title_en TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS store_section_description_en TEXT;

CREATE TABLE IF NOT EXISTS "StoreProduct" (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price       DECIMAL(10, 2) NOT NULL DEFAULT 0,
  image_url   TEXT,
  pdf_url     TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "StoreProduct_active_sort_idx" ON "StoreProduct"(is_active, sort_order, created_at DESC);
ALTER TABLE "StoreProduct" ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "UserStorePurchase" (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES "StoreProduct"(id) ON DELETE CASCADE,
  price_paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);
CREATE INDEX IF NOT EXISTS "UserStorePurchase_user_idx" ON "UserStorePurchase"(user_id, created_at DESC);

-- ============================================================
-- 19) اشتراكات المنصة (add-platform-subscriptions)
-- ============================================================
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS subscriptions_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "SubscriptionPlan" (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  image_url     TEXT,
  duration_kind TEXT NOT NULL CHECK (duration_kind IN ('week', 'month', 'year')),
  price         DECIMAL(10, 2) NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "SubscriptionPlan_active_sort_idx" ON "SubscriptionPlan"(is_active, sort_order);

CREATE TABLE IF NOT EXISTS "UserPlatformSubscription" (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  plan_id    TEXT REFERENCES "SubscriptionPlan"(id) ON DELETE SET NULL,
  price_paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "UserPlatformSubscription_user_expires_idx" ON "UserPlatformSubscription"(user_id, expires_at);

-- ============================================================
-- 20) تقييمات الدروس (add-lesson-ratings)
-- ============================================================
CREATE TABLE IF NOT EXISTS "LessonRating" (
  id         TEXT PRIMARY KEY,
  lesson_id  TEXT NOT NULL REFERENCES "Lesson"(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  course_id  TEXT NOT NULL REFERENCES "Course"(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lesson_rating_unique_lesson_user UNIQUE (lesson_id, user_id)
);
CREATE INDEX IF NOT EXISTS "LessonRating_lesson_id_idx" ON "LessonRating"(lesson_id);
CREATE INDEX IF NOT EXISTS "LessonRating_course_id_idx" ON "LessonRating"(course_id);
CREATE INDEX IF NOT EXISTS "LessonRating_user_id_idx" ON "LessonRating"(user_id);

-- ============================================================
-- 21) أعمدة HomepageSetting الإضافية (ensure-homepage-setting-columns + add-homepage-*)
-- ============================================================
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS reviews_section_title TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS reviews_section_subtitle TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero_slider_course_id_1 TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero_slider_course_id_2 TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero_slider_course_id_3 TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero_slider_course_id_4 TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero_slider_course_id_5 TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS primary_color TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS header_logo_url TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS cta_badge_text TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS cta_title TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS cta_description TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS cta_button_text TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero_template TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero_slider_image_1 TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero_slider_image_2 TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero_slider_image_3 TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero_slider_image_4 TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero_slider_image_5 TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero_slider_interval_ms INTEGER;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero3_title TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero3_subtitle TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero3_phone_image_url TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero3_phone_bg_color TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero3_store_badge_1_image_url TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero3_store_badge_1_link TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero3_store_badge_2_image_url TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero3_store_badge_2_link TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS teachers_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS platform_details_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS platform_details_title TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS platform_details_subtitle TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS platform_details_background_color TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS platform_details_items TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS platform_news_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS platform_news_items TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS platform_news_section_title TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS add_balance_title TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS add_balance_subtitle TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS add_balance_method_title TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS add_balance_transfer_instruction TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS add_balance_wallet_number TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS add_balance_confirmation_note TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS add_balance_whatsapp_number TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS add_balance_whatsapp_button_text TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS add_balance_waiting_note TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero_float_image_1 TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero_float_image_2 TEXT;
ALTER TABLE "HomepageSetting" ADD COLUMN IF NOT EXISTS hero_float_image_3 TEXT;

UPDATE "HomepageSetting" SET teachers_enabled = COALESCE(teachers_enabled, false) WHERE id = 'default';

UPDATE "HomepageSetting"
SET platform_news_section_title = 'أخبار المنصة', updated_at = NOW()
WHERE id = 'default' AND platform_news_section_title IS NULL;

UPDATE "HomepageSetting"
SET
  add_balance_title = COALESCE(add_balance_title, 'إضافة رصيد'),
  add_balance_subtitle = COALESCE(add_balance_subtitle, 'اختر طريقة الدفع ثم اتبع التعليمات'),
  add_balance_method_title = COALESCE(add_balance_method_title, 'فودافون كاش'),
  add_balance_transfer_instruction = COALESCE(add_balance_transfer_instruction, 'قم بتحويل المبلغ المطلوب إلى رقم المحفظة التالي:'),
  add_balance_wallet_number = COALESCE(add_balance_wallet_number, '01023005622'),
  add_balance_confirmation_note = COALESCE(add_balance_confirmation_note, 'بعد التحويل، يجب إرسال صورة تأكيد التحويل على واتساب على الرقم'),
  add_balance_whatsapp_number = COALESCE(add_balance_whatsapp_number, '966553612356'),
  add_balance_whatsapp_button_text = COALESCE(add_balance_whatsapp_button_text, 'إرسال صورة التأكيد على واتساب'),
  add_balance_waiting_note = COALESCE(add_balance_waiting_note, 'بعد إرسال صورة التأكيد، يكون رصيدك في انتظار وصوله إلى حسابك. سيتم إضافة الرصيد خلال أقرب وقت.')
WHERE id = 'default';
