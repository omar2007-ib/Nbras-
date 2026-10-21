-- SECURITY INVOKER views require the caller to hold column-level privileges
-- on the underlying table. Grant only fields safe for public practice; never grant
-- correct_index, explanation, source_name, or status to anonymous clients.
GRANT SELECT (id, question, options, category, difficulty, created_at, updated_at)
ON TABLE public.mcq_questions TO anon;
