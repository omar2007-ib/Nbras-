# Athar launch checklist — 2026-10-20

## Verified current state
- Repository: https://github.com/omar2007-ib/Nbras-
- Arabic RTL pages and a preliminary sign-in screen exist.
- assets/supabase-config.js still has empty URL and publishableKey values.
- Supabase project cjccnpwukssimdgnyezi is INACTIVE. A table inspection timed out; live database access is unverified.
- admin.html is a localStorage prototype. Selecting files records their names only; it does not upload files.
- No SQL has been applied to the inactive project in this session.

## Safe activation sequence
1. In the Supabase dashboard, inspect why the project is INACTIVE and verify plan/cost before restoring it. Do not restore until any possible charge is understood.
2. If the project becomes active, take a backup if it contains data, then review and apply supabase/schema.sql.
3. Review and apply supabase/storage-policies.sql. These scripts are preparation only and have not been tested against a live database.
4. Create the owner account through Authentication, then assign role=owner from the trusted SQL Editor. Never allow users to set their own role.
5. Configure email authentication, Site URL, and Redirect URLs for the final deployed domain.
6. Put only the project URL and publishable key in assets/supabase-config.js. Never expose service_role or secret keys in browser code or Git.
7. Replace the local-only admin prototype with real database CRUD and private Storage upload flows.
8. Test with separate visitor, student, admin, and owner accounts. Confirm students cannot manage course content and unpublished files are inaccessible.
9. Test PDF/image/video uploads. The current Storage policy limit is 50 MiB, which is unsuitable for many course videos; use resumable uploads or a dedicated video-storage plan before launch.
10. Verify CI checks and browser tests on mobile and desktop, then deploy. Only configure a custom domain if a domain is owned and its cost is acceptable.

## Launch acceptance criteria
- Real sign-in and email verification work.
- Roles are enforced by database policies, not merely hidden UI.
- Courses and lessons can be managed through the database.
- Files are uploaded to cloud storage and access is restricted correctly.
- Functional and security tests pass and are documented.
- Backup/recovery plan exists.
- Production URL opens without 404.

## Not yet completed
A live database cannot be activated or tested while the connected Supabase project is inactive. Configuration values and email/domain settings must be confirmed in the user's account. Do not claim production readiness until those checks pass.
