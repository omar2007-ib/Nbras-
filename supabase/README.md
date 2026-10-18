# إعداد Supabase لمنصة أثَر

هذه ملفات إعداد وتجهيز، وليست دليلاً على أن قاعدة البيانات متصلة بالموقع بالفعل.

## الخطوات
1. افتح مشروع Supabase الخاص بك وتأكد أنه نشط.
2. افتح SQL Editor وشغّل الملف schema.sql بعد مراجعة السياسات.
3. من Authentication، اضبط طريقة الدخول بالبريد الإلكتروني وعناوين إعادة التوجيه إلى صفحات الموقع بعد نشره.
4. أنشئ حساب المالك بنفسك أولاً، ثم عيّن دوره من SQL Editor باستخدام الاستعلام المعلّق في نهاية schema.sql بعد استبدال البريد ببريدك.
5. أنشئ bucket خاصاً للملفات، ثم أضف سياسات Storage منفصلة تسمح بالرفع والتعديل والحذف للمالك والمدير فقط. لا تضع service-role key في المتصفح.
6. أدخل رابط المشروع وpublishable key في assets/supabase-config.js. هذه القيم لا تُعدّ سرية، لكن الحماية تعتمد على RLS.
7. اختبر القراءة المجهولة للمحتوى المنشور، ومنع الطالب من تعديل المحتوى، والسماح للمالك/المدير فقط بإدارته.

## الأدوار
- student: افتراضي عند التسجيل.
- admin: يعيّنه المالك من قاعدة البيانات.
- owner: يعيّنه المالك من قاعدة البيانات.

لا تعتمد على user_metadata لتحديد الصلاحيات. ولا تضع أي مفتاح service_role أو مفتاحاً سرياً في الواجهة أو GitHub.

## تنبيه
لا تضع بيانات حقيقية أو ترفع ملفات حساسة قبل إكمال إعداد Storage واختبارات RLS. هذه الملفات لا تنشئ المشروع ولا تنشّطه تلقائياً.


## Private course file storage
1. After restoring/activating the Supabase project, review `schema.sql` and run it in SQL Editor.
2. Then review and run `storage-policies.sql` to create the private `athar-content` bucket and policies.
3. The bucket allows PDF, JPEG/PNG/WebP, MP4 and WebM files up to 50 MiB. Update this allowlist only after reviewing the actual upload workflow.
4. Student read access is limited to files whose `storage_path` exactly matches a published `course_content` row. Owner/admin roles alone can upload, replace or delete files.
5. This SQL has been committed as a preparation only; it has **not** been applied to the inactive project or tested against a live database.
6. Never expose a service-role or secret key in client-side files. Set only the project URL and publishable key in `assets/supabase-config.js`.
