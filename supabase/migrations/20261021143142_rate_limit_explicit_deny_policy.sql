-- Make the intended deny-by-default client policy explicit for security review.
drop policy if exists "No client access to assistant rate limits" on public.athar_assistant_rate_limits;
create policy "No client access to assistant rate limits"
on public.athar_assistant_rate_limits
for all
to anon, authenticated
using (false)
with check (false);