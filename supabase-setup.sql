-- =====================================================================
--  EduHealthHub shared database (Supabase / Postgres)
--  Paste this whole file into Supabase > SQL Editor > New query > Run.
--  Safe to run again: it will not erase student data.
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;
set search_path = public, extensions;

-- ---------- tables ----------
create sequence if not exists public.ehh_rev;

create table if not exists public.accounts(
  id text primary key,
  role text not null check (role in ('Doctor','Nurse','Dentist','Teacher')),
  name text not null,
  username text not null,
  email text not null,
  adv text,
  pw text not null,
  photo text
);
alter table public.accounts add column if not exists photo text;
create unique index if not exists accounts_username_u on public.accounts ((regexp_replace(lower(username),'\s+','','g')));
create unique index if not exists accounts_email_u on public.accounts ((regexp_replace(lower(email),'\s+','','g')));

create table if not exists public.sessions(
  token text primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  expires timestamptz not null
);

create table if not exists public.login_fails(
  k text primary key, n int not null default 0, t timestamptz not null default now()
);

create table if not exists public.students(
  id text primary key,
  data jsonb not null,
  rev bigint not null default nextval('public.ehh_rev'),
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.stock(
  id int primary key default 1 check (id=1),
  data jsonb not null,
  rev bigint not null default nextval('public.ehh_rev'),
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.transfers(
  id bigserial primary key,
  data jsonb not null,
  rev bigint not null default nextval('public.ehh_rev'),
  created_at timestamptz not null default now()
);

-- lock every table: the public key can NOT read or write them directly
alter table public.accounts enable row level security;
alter table public.sessions enable row level security;
alter table public.login_fails enable row level security;
alter table public.students enable row level security;
alter table public.stock enable row level security;
alter table public.transfers enable row level security;
revoke all on public.accounts, public.sessions, public.login_fails, public.students, public.stock, public.transfers from anon, authenticated;
revoke all on sequence public.ehh_rev from anon, authenticated;

-- ---------- helpers ----------
create or replace function public.ehh_norm(s text) returns text
language sql immutable as $$ select regexp_replace(lower(coalesce(s,'')),'\s+','','g') $$;

create or replace function public.ehh_auth(p_token text) returns public.accounts
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  select ac.* into a from public.sessions s join public.accounts ac on ac.id=s.account_id
   where s.token=p_token and s.expires>now();
  if not found then raise exception 'SESSION_EXPIRED'; end if;
  return a;
end $$;

create or replace function public.ehh_acct_json(a public.accounts) returns jsonb
language sql immutable as $$
  select jsonb_build_object('id',a.id,'role',a.role,'name',a.name,'username',a.username,'email',a.email,'adv',a.adv,'photo',a.photo) $$;

-- ---------- login / logout ----------
create or replace function public.app_login(p_user text, p_pw text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; nk text := public.ehh_norm(p_user); f public.login_fails; tok text;
begin
  select * into f from public.login_fails where login_fails.k=nk;
  if found and f.n>=5 and f.t>now()-interval '60 seconds' then return jsonb_build_object('error','TOO_MANY_ATTEMPTS'); end if;
  select * into a from public.accounts
   where public.ehh_norm(username)=nk or public.ehh_norm(email)=nk limit 1;
  if not found or a.pw <> crypt(coalesce(p_pw,''), a.pw) then
    insert into public.login_fails(k,n,t) values (nk,1,now())
      on conflict (k) do update set n = case when public.login_fails.t>now()-interval '60 seconds' then public.login_fails.n+1 else 1 end, t=now();
    return jsonb_build_object('error','BAD_LOGIN');
  end if;
  delete from public.login_fails where login_fails.k=nk;
  delete from public.sessions where expires<now();
  tok := encode(gen_random_bytes(24),'hex');
  insert into public.sessions(token,account_id,expires) values (tok,a.id,now()+interval '12 hours');
  return jsonb_build_object('token',tok,'account',public.ehh_acct_json(a));
end $$;

create or replace function public.app_logout(p_token text) returns void
language sql security definer set search_path = public, extensions as $$
  delete from public.sessions where token=p_token $$;

-- ---------- read: everything that changed since a revision number ----------
create or replace function public.app_sync(p_token text, p_since bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; st jsonb; sk jsonb := 'null'::jsonb; tr jsonb := 'null'::jsonb; mx bigint; cnt bigint;
begin
  a := public.ehh_auth(p_token);
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'data',data) order by id),'[]'::jsonb) into st
    from public.students where rev>p_since;
  select count(*) into cnt from public.students;
  select jsonb_build_object('data',data) into sk from public.stock where rev>p_since;
  if p_since<=0 or exists(select 1 from public.transfers where rev>p_since) then
    select coalesce(jsonb_agg(data order by id),'[]'::jsonb) into tr from public.transfers;
  end if;
  select greatest(
    coalesce((select max(rev) from public.students),0),
    coalesce((select max(rev) from public.stock),0),
    coalesce((select max(rev) from public.transfers),0)) into mx;
  return jsonb_build_object('rev',mx,'count',cnt,'account',public.ehh_acct_json(a),
                            'students',st,'stock',sk,'transfers',tr);
end $$;

-- ---------- write student changes (only the fields the role may edit) ----------
create or replace function public.app_save_students(p_token text, p_rows jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; r jsonb; kv record; allowed text[]; cur jsonb; sid text;
begin
  a := public.ehh_auth(p_token);
  if jsonb_typeof(p_rows)<>'array' then raise exception 'BAD_REQUEST'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    sid := r->>'id';
    if sid is null or jsonb_typeof(r->'patch')<>'object' then raise exception 'BAD_REQUEST'; end if;
    select data into cur from public.students where id=sid for update;
    if cur is null then cur := '{}'::jsonb; end if;
    for kv in select key, value from jsonb_each(r->'patch') loop
      if a.role='Doctor' then null;
      elsif a.role='Nurse' and kv.key<>'dental' then null;
      elsif a.role='Dentist' and kv.key='dental' then null;
      elsif a.role='Teacher' and kv.key in ('photo','enr') then null;
      else raise exception 'NOT_ALLOWED'; end if;
      if kv.value='null'::jsonb then cur := cur - kv.key;
      else cur := cur || jsonb_build_object(kv.key, kv.value); end if;
    end loop;
    insert into public.students(id,data,updated_by) values (sid,cur,a.id)
      on conflict (id) do update set data=excluded.data, rev=nextval('public.ehh_rev'), updated_at=now(), updated_by=a.id;
  end loop;
end $$;

-- Doctor only: fill in starting data without overwriting anything already saved
create or replace function public.app_seed(p_token text, p_rows jsonb, p_stock jsonb default null) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; r jsonb; n int := 0;
begin
  a := public.ehh_auth(p_token);
  if a.role<>'Doctor' then raise exception 'NOT_ALLOWED'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public.students(id,data,updated_by) values (r->>'id', r->'data', a.id)
      on conflict (id) do update set data = excluded.data || public.students.data,
        rev=nextval('public.ehh_rev'), updated_at=now();
    n := n+1;
  end loop;
  if p_stock is not null then
    insert into public.stock(id,data,updated_by) values (1,p_stock,a.id) on conflict (id) do nothing;
  end if;
  return n;
end $$;

-- ---------- stock & transfers ----------
create or replace function public.app_save_stock(p_token text, p_data jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  if a.role not in ('Doctor','Nurse') then raise exception 'NOT_ALLOWED'; end if;
  insert into public.stock(id,data,updated_by) values (1,p_data,a.id)
    on conflict (id) do update set data=excluded.data, rev=nextval('public.ehh_rev'), updated_at=now(), updated_by=a.id;
end $$;

create or replace function public.app_add_transfer(p_token text, p_data jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  if a.role not in ('Doctor','Teacher') then raise exception 'NOT_ALLOWED'; end if;
  insert into public.transfers(data) values (p_data);
end $$;

-- ---------- my account ----------
create or replace function public.app_update_account(p_token text, p_username text, p_email text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  if length(trim(p_username))<3 or p_email !~ '^\S+@\S+\.\S+$' then raise exception 'BAD_REQUEST'; end if;
  if exists(select 1 from public.accounts x where x.id<>a.id and
     (public.ehh_norm(x.username)=public.ehh_norm(p_username) or public.ehh_norm(x.email)=public.ehh_norm(p_email))) then
    raise exception 'DUPLICATE'; end if;
  update public.accounts set username=trim(p_username), email=trim(p_email) where id=a.id returning * into a;
  return public.ehh_acct_json(a);
end $$;

create or replace function public.app_change_password(p_token text, p_old text, p_new text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  if a.pw <> crypt(coalesce(p_old,''), a.pw) then raise exception 'BAD_PASSWORD'; end if;
  if length(coalesce(p_new,''))<8 then raise exception 'BAD_REQUEST'; end if;
  update public.accounts set pw=crypt(p_new, gen_salt('bf')) where id=a.id;
end $$;

create or replace function public.app_set_photo(p_token text, p_photo text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  if p_photo is not null and (p_photo !~ '^data:image/(jpeg|png|webp);base64,' or length(p_photo)>200000) then
    raise exception 'BAD_REQUEST'; end if;
  update public.accounts set photo=p_photo where id=a.id returning * into a;
  return public.ehh_acct_json(a);
end $$;
alter table public.accounts add column if not exists photo text;

-- the public key may call ONLY these functions
revoke all on function public.ehh_auth(text), public.ehh_acct_json(public.accounts), public.ehh_norm(text) from public, anon, authenticated;
grant execute on function public.app_login(text,text), public.app_logout(text), public.app_sync(text,bigint),
  public.app_save_students(text,jsonb), public.app_seed(text,jsonb,jsonb), public.app_save_stock(text,jsonb),
  public.app_add_transfer(text,jsonb), public.app_update_account(text,text,text), public.app_change_password(text,text,text), public.app_set_photo(text,text)
  to anon, authenticated;

-- ---------- the 30 starting accounts (only added if missing) ----------
insert into public.accounts(id,role,name,username,email,adv,pw) values
  ('A1','Doctor','Dummy Doctor1','Dummy Doctor1','dummydoctor1@eduhealthhub.demo',null,crypt('doctor1',gen_salt('bf'))),
  ('A2','Doctor','Dummy Doctor2','Dummy Doctor2','dummydoctor2@eduhealthhub.demo',null,crypt('doctor2',gen_salt('bf'))),
  ('A3','Nurse','Dummy Nurse1','Dummy Nurse1','dummynurse1@eduhealthhub.demo',null,crypt('nurse1',gen_salt('bf'))),
  ('A4','Nurse','Dummy Nurse2','Dummy Nurse2','dummynurse2@eduhealthhub.demo',null,crypt('nurse2',gen_salt('bf'))),
  ('A5','Nurse','Dummy Nurse3','Dummy Nurse3','dummynurse3@eduhealthhub.demo',null,crypt('nurse3',gen_salt('bf'))),
  ('A6','Dentist','Dummy Dentist1','Dummy Dentist1','dummydentist1@eduhealthhub.demo',null,crypt('dentist1',gen_salt('bf'))),
  ('T1','Teacher','Dummy Teacher 11A1','Dummy Teacher 11A1','dummyteacher11a1@eduhealthhub.demo','11-ACAD-1',crypt('acad1',gen_salt('bf'))),
  ('T2','Teacher','Dummy Teacher 11A2','Dummy Teacher 11A2','dummyteacher11a2@eduhealthhub.demo','11-ACAD-2',crypt('acad2',gen_salt('bf'))),
  ('T3','Teacher','Dummy Teacher 11TP1','Dummy Teacher 11TP1','dummyteacher11tp1@eduhealthhub.demo','11-TP-1',crypt('techpro1',gen_salt('bf'))),
  ('T4','Teacher','Dummy Teacher 11TP2','Dummy Teacher 11TP2','dummyteacher11tp2@eduhealthhub.demo','11-TP-2',crypt('techpro2',gen_salt('bf'))),
  ('T5','Teacher','Dummy Teacher 12STEM1','Dummy Teacher 12STEM1','dummyteacher12stem1@eduhealthhub.demo','12-STEM-1',crypt('stem1',gen_salt('bf'))),
  ('T6','Teacher','Dummy Teacher 12STEM2','Dummy Teacher 12STEM2','dummyteacher12stem2@eduhealthhub.demo','12-STEM-2',crypt('stem2',gen_salt('bf'))),
  ('T7','Teacher','Dummy Teacher 12STEM3','Dummy Teacher 12STEM3','dummyteacher12stem3@eduhealthhub.demo','12-STEM-3',crypt('stem3',gen_salt('bf'))),
  ('T8','Teacher','Dummy Teacher 12ABM1','Dummy Teacher 12ABM1','dummyteacher12abm1@eduhealthhub.demo','12-ABM-1',crypt('abm1',gen_salt('bf'))),
  ('T9','Teacher','Dummy Teacher 12ABM2','Dummy Teacher 12ABM2','dummyteacher12abm2@eduhealthhub.demo','12-ABM-2',crypt('abm2',gen_salt('bf'))),
  ('T10','Teacher','Dummy Teacher 12ABM3','Dummy Teacher 12ABM3','dummyteacher12abm3@eduhealthhub.demo','12-ABM-3',crypt('abm3',gen_salt('bf'))),
  ('T11','Teacher','Dummy Teacher 12HUMMS1','Dummy Teacher 12HUMMS1','dummyteacher12humms1@eduhealthhub.demo','12-HUMSS-1',crypt('humms1',gen_salt('bf'))),
  ('T12','Teacher','Dummy Teacher 12HUMMS2','Dummy Teacher 12HUMMS2','dummyteacher12humms2@eduhealthhub.demo','12-HUMSS-2',crypt('humms2',gen_salt('bf'))),
  ('T13','Teacher','Dummy Teacher 12HUMMS3','Dummy Teacher 12HUMMS3','dummyteacher12humms3@eduhealthhub.demo','12-HUMSS-3',crypt('humms3',gen_salt('bf'))),
  ('T14','Teacher','Dummy Teacher 12TVL1','Dummy Teacher 12TVL1','dummyteacher12tvl1@eduhealthhub.demo','12-TVL-1',crypt('tvl1',gen_salt('bf'))),
  ('T15','Teacher','Dummy Teacher 12TVL2','Dummy Teacher 12TVL2','dummyteacher12tvl2@eduhealthhub.demo','12-TVL-2',crypt('tvl2',gen_salt('bf'))),
  ('T16','Teacher','Dummy Teacher 12TVL3','Dummy Teacher 12TVL3','dummyteacher12tvl3@eduhealthhub.demo','12-TVL-3',crypt('tvl3',gen_salt('bf'))),
  ('T17','Teacher','Dummy Teacher 11A3','Dummy Teacher 11A3','dummyteacher11a3@eduhealthhub.demo','11-ACAD-3',crypt('acad3',gen_salt('bf'))),
  ('T18','Teacher','Dummy Teacher 11A4','Dummy Teacher 11A4','dummyteacher11a4@eduhealthhub.demo','11-ACAD-4',crypt('acad4',gen_salt('bf'))),
  ('T19','Teacher','Dummy Teacher 11A5','Dummy Teacher 11A5','dummyteacher11a5@eduhealthhub.demo','11-ACAD-5',crypt('acad5',gen_salt('bf'))),
  ('T20','Teacher','Dummy Teacher 11A6','Dummy Teacher 11A6','dummyteacher11a6@eduhealthhub.demo','11-ACAD-6',crypt('acad6',gen_salt('bf'))),
  ('T21','Teacher','Dummy Teacher 11TP3','Dummy Teacher 11TP3','dummyteacher11tp3@eduhealthhub.demo','11-TP-3',crypt('techpro3',gen_salt('bf'))),
  ('T22','Teacher','Dummy Teacher 11TP4','Dummy Teacher 11TP4','dummyteacher11tp4@eduhealthhub.demo','11-TP-4',crypt('techpro4',gen_salt('bf'))),
  ('T23','Teacher','Dummy Teacher 11TP5','Dummy Teacher 11TP5','dummyteacher11tp5@eduhealthhub.demo','11-TP-5',crypt('techpro5',gen_salt('bf'))),
  ('T24','Teacher','Dummy Teacher 11TP6','Dummy Teacher 11TP6','dummyteacher11tp6@eduhealthhub.demo','11-TP-6',crypt('techpro6',gen_salt('bf')))
on conflict (id) do nothing;

-- Done. Now open the website, log in as Dummy Doctor1 and press 'Upload starting data' on the Overview page.

-- =====================================================================
--  Gmail confirmation (each person links their own Gmail; every login then
--  needs a 6-digit code emailed to it). Safe to run again.
-- =====================================================================
alter table public.accounts add column if not exists gmail text;
alter table public.accounts add column if not exists gmail_ok boolean not null default false;
alter table public.sessions add column if not exists stage text not null default 'ok';
create unique index if not exists accounts_gmail_u on public.accounts ((lower(gmail))) where gmail_ok;

create table if not exists public.email_codes(
  id bigserial primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  purpose text not null check (purpose in ('login','link')),
  email text not null,
  code_hash text not null,
  expires timestamptz not null,
  tries int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.email_codes enable row level security;
revoke all on public.email_codes from anon, authenticated;

create or replace function public.ehh_acct_json(a public.accounts) returns jsonb
language sql immutable as $$
  select jsonb_build_object('id',a.id,'role',a.role,'name',a.name,'username',a.username,'email',a.email,'adv',a.adv,
    'photo',a.photo,'gmail',case when a.gmail_ok then a.gmail end,'gmail_ok',a.gmail_ok) $$;

-- only fully confirmed sessions may use the app
create or replace function public.ehh_auth(p_token text) returns public.accounts
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  select ac.* into a from public.sessions s join public.accounts ac on ac.id=s.account_id
   where s.token=p_token and s.expires>now() and s.stage='ok';
  if not found then raise exception 'SESSION_EXPIRED'; end if;
  return a;
end $$;

create or replace function public.ehh_pending(p_token text) returns public.accounts
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  select ac.* into a from public.sessions s join public.accounts ac on ac.id=s.account_id
   where s.token=p_token and s.expires>now() and s.stage='pending';
  if not found then raise exception 'SESSION_EXPIRED'; end if;
  return a;
end $$;

create or replace function public.ehh_mask(m text) returns text
language sql immutable as $$ select left(m,1)||'***'||substr(m,position('@' in m)) $$;

-- login: password first; if a Gmail is linked, a code is needed next
create or replace function public.app_login(p_user text, p_pw text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; nk text := public.ehh_norm(p_user); f public.login_fails; tok text;
begin
  select * into f from public.login_fails where login_fails.k=nk;
  if found and f.n>=5 and f.t>now()-interval '60 seconds' then return jsonb_build_object('error','TOO_MANY_ATTEMPTS'); end if;
  select * into a from public.accounts
   where public.ehh_norm(username)=nk or public.ehh_norm(email)=nk
      or (gmail_ok and public.ehh_norm(gmail)=nk) limit 1;
  if not found or a.pw <> crypt(coalesce(p_pw,''), a.pw) then
    insert into public.login_fails(k,n,t) values (nk,1,now())
      on conflict (k) do update set n = case when public.login_fails.t>now()-interval '60 seconds' then public.login_fails.n+1 else 1 end, t=now();
    return jsonb_build_object('error','BAD_LOGIN');
  end if;
  delete from public.login_fails where login_fails.k=nk;
  delete from public.sessions where expires<now();
  delete from public.email_codes where created_at<now()-interval '1 day';
  tok := encode(gen_random_bytes(24),'hex');
  if a.gmail_ok then
    insert into public.sessions(token,account_id,expires,stage) values (tok,a.id,now()+interval '15 minutes','pending');
    return jsonb_build_object('pending',tok,'hint',public.ehh_mask(a.gmail));
  end if;
  insert into public.sessions(token,account_id,expires) values (tok,a.id,now()+interval '12 hours');
  return jsonb_build_object('token',tok,'account',public.ehh_acct_json(a));
end $$;

-- called only by the send-code email function (service role), never by the browser
create or replace function public.ehh_issue_code(p_token text, p_purpose text, p_email text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; mail text; c text; lastc timestamptz; n int;
begin
  if p_purpose='login' then a := public.ehh_pending(p_token); mail := a.gmail;
  elsif p_purpose='link' then
    a := public.ehh_auth(p_token); mail := lower(trim(coalesce(p_email,'')));
    if mail !~ '^[a-z0-9._+-]+@(gmail|googlemail)\.com$' then raise exception 'BAD_EMAIL'; end if;
    if exists(select 1 from public.accounts x where x.id<>a.id and x.gmail_ok and lower(x.gmail)=mail) then raise exception 'EMAIL_TAKEN'; end if;
  else raise exception 'BAD_REQUEST'; end if;
  select max(created_at) filter (where purpose=p_purpose), count(*) filter (where created_at>now()-interval '1 hour') into lastc, n
    from public.email_codes where account_id=a.id;
  if lastc is not null and lastc>now()-interval '30 seconds' then raise exception 'WAIT'; end if;
  if n>=6 then raise exception 'TOO_MANY_CODES'; end if;
  update public.email_codes set expires=now() where account_id=a.id and purpose=p_purpose and expires>now();
  c := lpad((('x'||encode(gen_random_bytes(4),'hex'))::bit(32)::bigint % 1000000)::text,6,'0');
  insert into public.email_codes(account_id,purpose,email,code_hash,expires)
    values (a.id,p_purpose,mail,crypt(c,gen_salt('bf')),now()+interval '10 minutes');
  return jsonb_build_object('email',mail,'code',c,'name',a.name);
end $$;

-- check a code row; wrong guesses are counted (and kept, so no exception here)
create or replace function public.ehh_check_code(p_acct text, p_purpose text, p_code text, out ok boolean, out err text, out mail text)
language plpgsql security definer set search_path = public, extensions as $$
declare r public.email_codes;
begin
  ok := false; mail := null;
  select * into r from public.email_codes where account_id=p_acct and purpose=p_purpose and expires>now() order by id desc limit 1;
  if not found then err := 'CODE_EXPIRED'; return; end if;
  if r.tries>=5 then err := 'TOO_MANY_TRIES'; return; end if;
  update public.email_codes set tries=tries+1 where id=r.id;
  if r.code_hash <> crypt(coalesce(p_code,''), r.code_hash) then
    err := case when r.tries+1>=5 then 'TOO_MANY_TRIES' else 'BAD_CODE' end; return; end if;
  update public.email_codes set expires=now() where id=r.id;
  ok := true; mail := r.email;
end $$;

create or replace function public.app_verify_login(p_token text, p_code text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; v record;
begin
  a := public.ehh_pending(p_token);
  select * into v from public.ehh_check_code(a.id,'login',p_code);
  if not v.ok then
    if v.err='TOO_MANY_TRIES' then delete from public.sessions where token=p_token; end if;
    return jsonb_build_object('error',v.err);
  end if;
  update public.sessions set stage='ok', expires=now()+interval '12 hours' where token=p_token;
  return jsonb_build_object('token',p_token,'account',public.ehh_acct_json(a));
end $$;

create or replace function public.app_verify_link(p_token text, p_code text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; v record;
begin
  a := public.ehh_auth(p_token);
  select * into v from public.ehh_check_code(a.id,'link',p_code);
  if not v.ok then return jsonb_build_object('error',v.err); end if;
  update public.accounts set gmail=v.mail, gmail_ok=true where id=a.id returning * into a;
  return jsonb_build_object('account',public.ehh_acct_json(a));
end $$;

create or replace function public.app_unlink_gmail(p_token text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  if a.pw <> crypt(coalesce(p_password,''), a.pw) then raise exception 'BAD_PASSWORD'; end if;
  update public.accounts set gmail=null, gmail_ok=false where id=a.id returning * into a;
  return public.ehh_acct_json(a);
end $$;

revoke all on function public.ehh_pending(text), public.ehh_mask(text), public.ehh_check_code(text,text,text),
  public.ehh_issue_code(text,text,text) from public, anon, authenticated;
revoke all on function public.app_verify_login(text,text), public.app_verify_link(text,text), public.app_unlink_gmail(text,text) from public;
grant execute on function public.app_login(text,text), public.app_verify_login(text,text),
  public.app_verify_link(text,text), public.app_unlink_gmail(text,text) to anon, authenticated;
do $$ begin
  if exists(select 1 from pg_roles where rolname='service_role') then
    grant execute on function public.ehh_issue_code(text,text,text) to service_role;
  end if;
end $$;

-- latest version of the code issuer (returns the row id so a failed email can be undone)
create or replace function public.ehh_issue_code(p_token text, p_purpose text, p_email text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; mail text; c text; lastc timestamptz; n int; cid bigint;
begin
  if p_purpose='login' then a := public.ehh_pending(p_token); mail := a.gmail;
  elsif p_purpose='link' then
    a := public.ehh_auth(p_token); mail := lower(trim(coalesce(p_email,'')));
    if mail !~ '^[a-z0-9._+-]+@(gmail|googlemail)\.com$' then raise exception 'BAD_EMAIL'; end if;
    if exists(select 1 from public.accounts x where x.id<>a.id and x.gmail_ok and lower(x.gmail)=mail) then raise exception 'EMAIL_TAKEN'; end if;
  else raise exception 'BAD_REQUEST'; end if;
  select max(created_at) filter (where purpose=p_purpose), count(*) filter (where created_at>now()-interval '1 hour') into lastc, n
    from public.email_codes where account_id=a.id;
  if lastc is not null and lastc>now()-interval '30 seconds' then raise exception 'WAIT'; end if;
  if n>=6 then raise exception 'TOO_MANY_CODES'; end if;
  update public.email_codes set expires=now() where account_id=a.id and purpose=p_purpose and expires>now();
  c := lpad((('x'||encode(gen_random_bytes(4),'hex'))::bit(32)::bigint % 1000000)::text,6,'0');
  insert into public.email_codes(account_id,purpose,email,code_hash,expires)
    values (a.id,p_purpose,mail,crypt(c,gen_salt('bf')),now()+interval '10 minutes') returning id into cid;
  return jsonb_build_object('email',mail,'code',c,'name',a.name,'id',cid);
end $$;

-- =====================================================================
--  Sign in with Google confirmation (no email sending needed)
-- =====================================================================
alter table public.accounts add column if not exists google_sub text;

-- called only by the google-auth edge function (service role), after Google's token was verified
create or replace function public.ehh_link_google(p_token text, p_email text, p_sub text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; mail text := lower(trim(coalesce(p_email,'')));
begin
  a := public.ehh_auth(p_token);
  if mail !~ '^\S+@\S+\.\S+$' then raise exception 'BAD_EMAIL'; end if;
  if exists(select 1 from public.accounts x where x.id<>a.id and x.gmail_ok and lower(x.gmail)=mail) then raise exception 'EMAIL_TAKEN'; end if;
  update public.accounts set gmail=mail, gmail_ok=true, google_sub=p_sub where id=a.id returning * into a;
  return jsonb_build_object('account',public.ehh_acct_json(a));
end $$;

create or replace function public.ehh_google_login(p_pending text, p_email text, p_sub text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_pending(p_pending);
  if not a.gmail_ok or lower(a.gmail)<>lower(coalesce(p_email,'')) or (a.google_sub is not null and a.google_sub<>p_sub) then
    raise exception 'WRONG_GOOGLE'; end if;
  if a.google_sub is null then update public.accounts set google_sub=p_sub where id=a.id; end if;
  delete from public.email_codes where account_id=a.id and purpose='login';
  update public.sessions set stage='ok', expires=now()+interval '12 hours' where token=p_pending;
  return jsonb_build_object('token',p_pending,'account',public.ehh_acct_json(a));
end $$;

revoke all on function public.ehh_link_google(text,text,text), public.ehh_google_login(text,text,text) from public, anon, authenticated;
do $$ begin
  if exists(select 1 from pg_roles where rolname='service_role') then
    grant execute on function public.ehh_link_google(text,text,text), public.ehh_google_login(text,text,text) to service_role;
  end if;
end $$;

-- =====================================================================
--  HOME TAB: clinic walk-ins, referrals, clearances, care plans, handover notes
--  (visits / refs / clear / plans are stored inside each student's data)
-- =====================================================================
create table if not exists public.clinic_notes(
  id int primary key default 1 check (id=1),
  data jsonb not null,
  rev bigint not null default nextval('public.ehh_rev'),
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.clinic_notes enable row level security;
revoke all on public.clinic_notes from anon, authenticated;

create or replace function public.app_sync(p_token text, p_since bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; st jsonb; sk jsonb := 'null'::jsonb; nt jsonb := 'null'::jsonb; tr jsonb := 'null'::jsonb; mx bigint; cnt bigint;
begin
  a := public.ehh_auth(p_token);
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'data',data) order by id),'[]'::jsonb) into st
    from public.students where rev>p_since;
  select count(*) into cnt from public.students;
  select jsonb_build_object('data',data) into sk from public.stock where rev>p_since;
  select jsonb_build_object('data',data) into nt from public.clinic_notes where rev>p_since;
  if p_since<=0 or exists(select 1 from public.transfers where rev>p_since) then
    select coalesce(jsonb_agg(data order by id),'[]'::jsonb) into tr from public.transfers;
  end if;
  select greatest(
    coalesce((select max(rev) from public.students),0),
    coalesce((select max(rev) from public.stock),0),
    coalesce((select max(rev) from public.clinic_notes),0),
    coalesce((select max(rev) from public.transfers),0)) into mx;
  return jsonb_build_object('rev',mx,'count',cnt,'account',public.ehh_acct_json(a),
                            'students',st,'stock',sk,'notes',nt,'transfers',tr);
end $$;

create or replace function public.app_save_notes(p_token text, p_data jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  if a.role not in ('Doctor','Nurse') then raise exception 'NOT_ALLOWED'; end if;
  if jsonb_typeof(p_data)<>'array' then raise exception 'BAD_REQUEST'; end if;
  insert into public.clinic_notes(id,data,updated_by) values (1,p_data,a.id)
    on conflict (id) do update set data=excluded.data, rev=nextval('public.ehh_rev'), updated_at=now(), updated_by=a.id;
end $$;

-- Nurses may now also write visits / refs; clearances and care plans stay Doctor-only
create or replace function public.app_save_students(p_token text, p_rows jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; r jsonb; kv record; cur jsonb; sid text;
begin
  a := public.ehh_auth(p_token);
  if jsonb_typeof(p_rows)<>'array' then raise exception 'BAD_REQUEST'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    sid := r->>'id';
    if sid is null or jsonb_typeof(r->'patch')<>'object' then raise exception 'BAD_REQUEST'; end if;
    select data into cur from public.students where id=sid for update;
    if cur is null then cur := '{}'::jsonb; end if;
    for kv in select key, value from jsonb_each(r->'patch') loop
      if a.role='Doctor' then null;
      elsif a.role='Nurse' and kv.key not in ('dental','clear','plans') then null;
      elsif a.role='Dentist' and kv.key='dental' then null;
      elsif a.role='Teacher' and kv.key in ('photo','enr') then null;
      else raise exception 'NOT_ALLOWED'; end if;
      if kv.value='null'::jsonb then cur := cur - kv.key;
      else cur := cur || jsonb_build_object(kv.key, kv.value); end if;
    end loop;
    insert into public.students(id,data,updated_by) values (sid,cur,a.id)
      on conflict (id) do update set data=excluded.data, rev=nextval('public.ehh_rev'), updated_at=now(), updated_by=a.id;
  end loop;
end $$;

-- ---------- permissions matrix update ----------
-- Doctor: everything except the odontogram (read only). Nurse: no dental, clearances or care plans.
-- Dentist: dental chart + clinic time-outs (visits) + passes. Teacher: photo, enrolment and "send to clinic" passes.
create or replace function public.app_save_students(p_token text, p_rows jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; r jsonb; kv record; cur jsonb; sid text;
begin
  a := public.ehh_auth(p_token);
  if jsonb_typeof(p_rows)<>'array' then raise exception 'BAD_REQUEST'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    sid := r->>'id';
    if sid is null or jsonb_typeof(r->'patch')<>'object' then raise exception 'BAD_REQUEST'; end if;
    select data into cur from public.students where id=sid for update;
    if cur is null then cur := '{}'::jsonb; end if;
    for kv in select key, value from jsonb_each(r->'patch') loop
      if a.role='Doctor' and kv.key<>'dental' then null;
      elsif a.role='Nurse' and kv.key not in ('dental','clear','plans') then null;
      elsif a.role='Dentist' and kv.key in ('dental','visits','passes') then null;
      elsif a.role='Teacher' and kv.key in ('photo','enr','passes') then null;
      else raise exception 'NOT_ALLOWED'; end if;
      if kv.value='null'::jsonb then cur := cur - kv.key;
      else cur := cur || jsonb_build_object(kv.key, kv.value); end if;
    end loop;
    insert into public.students(id,data,updated_by) values (sid,cur,a.id)
      on conflict (id) do update set data=excluded.data, rev=nextval('public.ehh_rev'), updated_at=now(), updated_by=a.id;
  end loop;
end $$;
