---
name: athar-security
description: Review Athar authentication, authorization, database policies, file uploads, dependencies, and secret handling before release.
---
# Athar Security Skill

- Treat all user input and imported JSON as untrusted; validate type, length, shape and size.
- Never expose Supabase service-role or secret API keys in HTML, browser JS, public repository files, or client-side environment variables.
- Keep RLS enabled on all exposed tables and use least-privilege grants plus ownership/role predicates.
- Never trust user-editable profile metadata for authorization. Student role is the safe default; owner/admin assignment must be done through a trusted process.
- For UPDATE policies, require both USING and WITH CHECK. Test read, insert, update, and delete as anon, student, admin and owner where possible.
- Keep course files private by default. Permit student reads only for files attached to published course content; permit upload/replace/delete only for trusted owner/admin profiles.
- Validate uploads by size, MIME allowlist, and actual content where server-side tooling exists. Never serve untrusted uploads as executable HTML.
- Inspect external skill repositories and dependencies before installation. Do not execute scripts from a repository just because it is listed in the resource catalog.
- Review Git diffs for secrets before commit. Run Supabase security advisors after activating/configuring the project.
- Report unresolved issues explicitly; a static review is not a penetration test.
