-- Keep SECURITY DEFINER implementations outside the exposed public API schema.
-- Public RPC wrappers are SECURITY INVOKER and delegate to tightly-scoped private functions.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

drop policy if exists deny_direct_client_access_to_exam_attempts on public.mcq_exam_attempts;
create policy deny_direct_client_access_to_exam_attempts
on public.mcq_exam_attempts for all to public
using (false) with check (false);

create or replace function private.start_mcq_exam(p_category text default null, p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_ids uuid[]; v_attempt uuid; v_questions jsonb;
begin
  if p_category is not null and p_category not in ('كمي','لفظي','عام') then raise exception 'Invalid category'; end if;
  select array_agg(p.id), jsonb_agg(jsonb_build_object('id',p.id,'question',p.question,'options',p.options,'category',p.category,'difficulty',p.difficulty))
  into v_ids,v_questions
  from (select q.id,q.question,q.options,q.category,q.difficulty from public.mcq_questions q
        where q.status='approved' and (p_category is null or q.category=p_category)
        order by random() limit greatest(1,least(coalesce(p_limit,20),50))) p;
  if coalesce(array_length(v_ids,1),0)=0 then return jsonb_build_object('attempt_id',null,'questions','[]'::jsonb); end if;
  insert into public.mcq_exam_attempts(question_ids) values(v_ids) returning id into v_attempt;
  return jsonb_build_object('attempt_id',v_attempt,'questions',v_questions);
end; $$;

create or replace function private.submit_mcq_exam(p_attempt_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_ids uuid[]; v_status text; v_expires timestamptz; v_saved_result jsonb;
  v_qid uuid; v_question public.mcq_questions%rowtype; v_item jsonb; v_selected integer;
  v_score integer:=0; v_total integer:=0; v_details jsonb:='[]'::jsonb; v_result jsonb;
begin
  if p_answers is null or jsonb_typeof(p_answers)<>'array' or jsonb_array_length(p_answers)>50 then raise exception 'Invalid answers payload'; end if;
  if exists(select 1 from jsonb_array_elements(p_answers) as a(value) where coalesce(a.value->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(a.value->>'selected','') !~ '^[0-3]$') then raise exception 'Invalid answer item'; end if;
  if (select count(*) from jsonb_array_elements(p_answers))<>(select count(distinct a.value->>'id') from jsonb_array_elements(p_answers) as a(value)) then raise exception 'Duplicate answers are not allowed'; end if;
  select question_ids,status,expires_at,result into v_ids,v_status,v_expires,v_saved_result from public.mcq_exam_attempts where id=p_attempt_id for update;
  if v_ids is null then raise exception 'Attempt not found'; end if;
  if v_status='submitted' and v_saved_result is not null then return v_saved_result; end if;
  if v_status<>'in_progress' or v_expires<=now() then raise exception 'Attempt expired or unavailable'; end if;
  if exists(select 1 from jsonb_array_elements(p_answers) as a(value) where not ((a.value->>'id')::uuid=any(v_ids))) then raise exception 'Answer contains a question outside this attempt'; end if;
  v_total:=coalesce(array_length(v_ids,1),0);
  foreach v_qid in array v_ids loop
    select * into v_question from public.mcq_questions q where q.id=v_qid;
    select a.value into v_item from jsonb_array_elements(p_answers) as a(value) where (a.value->>'id')::uuid=v_qid limit 1;
    v_selected:=case when v_item is null then null else (v_item->>'selected')::integer end;
    if v_selected=v_question.correct_index then v_score:=v_score+1; end if;
    v_details:=v_details||jsonb_build_array(jsonb_build_object('id',v_question.id,'question',v_question.question,'options',v_question.options,'selected',v_selected,'correct_index',v_question.correct_index,'explanation',coalesce(v_question.explanation,'')));
  end loop;
  v_result:=jsonb_build_object('score',v_score,'total',v_total,'percent',case when v_total>0 then round((v_score::numeric/v_total)*100) else 0 end,'details',v_details);
  update public.mcq_exam_attempts set status='submitted',submitted_at=now(),result=v_result where id=p_attempt_id;
  return v_result;
end; $$;

revoke all on function private.start_mcq_exam(text,integer) from public;
revoke all on function private.submit_mcq_exam(uuid,jsonb) from public;
grant execute on function private.start_mcq_exam(text,integer) to anon,authenticated;
grant execute on function private.submit_mcq_exam(uuid,jsonb) to anon,authenticated;

create or replace function public.start_mcq_exam(p_category text default null,p_limit integer default 20)
returns jsonb language sql security invoker set search_path = pg_catalog, public, private
as $$ select private.start_mcq_exam(p_category,p_limit); $$;
create or replace function public.submit_mcq_exam(p_attempt_id uuid,p_answers jsonb)
returns jsonb language sql security invoker set search_path = pg_catalog, public, private
as $$ select private.submit_mcq_exam(p_attempt_id,p_answers); $$;
revoke all on function public.start_mcq_exam(text,integer) from public;
revoke all on function public.submit_mcq_exam(uuid,jsonb) from public;
grant execute on function public.start_mcq_exam(text,integer) to anon,authenticated;
grant execute on function public.submit_mcq_exam(uuid,jsonb) to anon,authenticated;
