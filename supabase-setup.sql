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
-- ---------- speed, tracking and safety ----------
create index if not exists students_rev_idx on public.students(rev);
create index if not exists transfers_rev_idx on public.transfers(rev);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='students_data_is_object') then
    alter table public.students add constraint students_data_is_object check (jsonb_typeof(data)='object');
  end if;
end $$;

-- activity log: who changed what, and when (Doctor can read it)
create table if not exists public.audit_log(
  id bigserial primary key,
  at timestamptz not null default now(),
  account_id text,
  actor text,
  role text,
  action text not null,
  target text,
  detail jsonb
);
create index if not exists audit_log_at_idx on public.audit_log(at desc);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
revoke all on sequence public.audit_log_id_seq from anon, authenticated;

create or replace function public.ehh_log(a public.accounts, p_action text, p_target text, p_detail jsonb default null) returns void
language sql security definer set search_path = public, extensions as $$
  insert into public.audit_log(account_id,actor,role,action,target,detail) values (a.id,a.name,a.role,p_action,p_target,p_detail);
$$;
revoke all on function public.ehh_log(public.accounts,text,text,jsonb) from anon, authenticated, public;

create or replace function public.app_audit(p_token text, p_limit int default 200) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  if a.role<>'Doctor' then raise exception 'NOT_ALLOWED'; end if;
  return coalesce((select jsonb_agg(x order by x.id desc) from (
    select l.id, l.at, l.actor, l.role, l.action, l.target, l.detail,
           (select s.data->>'first' || ' ' || (s.data->>'last') from public.students s where s.id=l.target) as who,
           (select s.data->>'lrn' from public.students s where s.id=l.target) as lrn
      from public.audit_log l order by l.id desc limit least(greatest(p_limit,1),500)) x),'[]'::jsonb);
end $$;

create or replace function public.app_sync(p_token text, p_since bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; st jsonb; sk jsonb := 'null'::jsonb; nt jsonb := 'null'::jsonb; tr jsonb := 'null'::jsonb; mx bigint; cnt bigint;
begin
  a := public.ehh_auth(p_token);
  -- teachers only receive learners enrolled in their own advisory
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'data',data) order by id),'[]'::jsonb) into st
    from public.students
   where rev>p_since
     and (a.role<>'Teacher' or exists (select 1 from jsonb_array_elements(data->'enr') e where e->>'section'=a.adv));
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

create or replace function public.app_save_students(p_token text, p_rows jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; r jsonb; kv record; cur jsonb; sid text; keys text[];
begin
  a := public.ehh_auth(p_token);
  if jsonb_typeof(p_rows)<>'array' then raise exception 'BAD_REQUEST'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    sid := r->>'id';
    if sid is null or jsonb_typeof(r->'patch')<>'object' then raise exception 'BAD_REQUEST'; end if;
    select data into cur from public.students where id=sid for update;
    if cur is null then cur := '{}'::jsonb; end if;
    keys := '{}';
    for kv in select key, value from jsonb_each(r->'patch') loop
      if a.role='Doctor' and kv.key<>'dental' then null;
      elsif a.role='Nurse' and kv.key not in ('dental','clear','plans') then null;
      elsif a.role='Dentist' and kv.key in ('dental','visits','passes') then null;
      elsif a.role='Teacher' and kv.key in ('photo','enr','passes') then null;
      else raise exception 'NOT_ALLOWED'; end if;
      if kv.value='null'::jsonb then cur := cur - kv.key;
      else cur := cur || jsonb_build_object(kv.key, kv.value); end if;
      keys := keys || kv.key;
    end loop;
    insert into public.students(id,data,updated_by) values (sid,cur,a.id)
      on conflict (id) do update set data=excluded.data, rev=nextval('public.ehh_rev'), updated_at=now(), updated_by=a.id;
    perform public.ehh_log(a,'student.update',sid,jsonb_build_object('fields',to_jsonb(keys)));
  end loop;
end $$;

create or replace function public.app_save_stock(p_token text, p_data jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  if a.role not in ('Doctor','Nurse') then raise exception 'NOT_ALLOWED'; end if;
  insert into public.stock(id,data,updated_by) values (1,p_data,a.id)
    on conflict (id) do update set data=excluded.data, rev=nextval('public.ehh_rev'), updated_at=now(), updated_by=a.id;
  perform public.ehh_log(a,'stock.update','stock',jsonb_build_object('items',jsonb_array_length(p_data)));
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
  perform public.ehh_log(a,'notes.update','notes',jsonb_build_object('notes',jsonb_array_length(p_data)));
end $$;

create or replace function public.app_add_transfer(p_token text, p_data jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  if a.role not in ('Doctor','Teacher') then raise exception 'NOT_ALLOWED'; end if;
  insert into public.transfers(data) values (p_data);
  perform public.ehh_log(a,'transfer',p_data->>'lrn',jsonb_build_object('from',p_data->>'from','to',p_data->>'to'));
end $$;
-- =====================================================================
--  MESSAGES: chat between accounts (teacher <-> clinic desk, staff team, direct messages)
-- =====================================================================
create table if not exists public.messages(
  id bigserial primary key,
  conv text not null,
  sender text not null,
  sname text not null,
  srole text not null,
  body text not null default '',
  kind text not null default 'text' check (kind in ('text','pass','record','event')),
  ref jsonb,
  at timestamptz not null default now()
);
create index if not exists messages_conv_id_idx on public.messages(conv,id);
create table if not exists public.msg_reads(
  account_id text not null,
  conv text not null,
  last_id bigint not null default 0,
  primary key(account_id,conv)
);
alter table public.messages enable row level security;
alter table public.msg_reads enable row level security;
revoke all on public.messages, public.msg_reads from anon, authenticated;
revoke all on sequence public.messages_id_seq from anon, authenticated;

-- who may see a conversation: 'clinic' = clinic staff; 'desk:<teacher id>' = that teacher + all clinic staff; 'dm:<a>:<b>' = those two
create or replace function public.ehh_conv_ok(a public.accounts, p_conv text) returns boolean
language sql immutable as $$
  select case
    when p_conv='clinic' then a.role<>'Teacher'
    when p_conv like 'desk:%' then a.role<>'Teacher' or p_conv='desk:'||a.id
    when p_conv like 'dm:%' then a.id in (split_part(p_conv,':',2),split_part(p_conv,':',3)) and split_part(p_conv,':',2) collate "C" < split_part(p_conv,':',3)
    else false end
$$;

create or replace function public.app_directory(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'role',x.role,'adv',x.adv,'photo',x.photo) order by x.role,x.name)
    from public.accounts x where x.id<>a.id and (a.role<>'Teacher' or x.role<>'Teacher')),'[]'::jsonb);
end $$;

create or replace function public.app_msg_send(p_token text, p_conv text, p_body text, p_kind text default 'text', p_ref jsonb default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; o public.accounts; oid text; m public.messages;
begin
  a := public.ehh_auth(p_token);
  if not public.ehh_conv_ok(a,p_conv) then raise exception 'NOT_ALLOWED'; end if;
  if p_kind not in ('text','pass','record','event') then raise exception 'BAD_REQUEST'; end if;
  if p_conv like 'dm:%' then
    oid := case when split_part(p_conv,':',2)=a.id then split_part(p_conv,':',3) else split_part(p_conv,':',2) end;
    select * into o from public.accounts where id=oid;
    if not found then raise exception 'NOT_ALLOWED'; end if;
    if a.role='Teacher' and o.role='Teacher' then raise exception 'NOT_ALLOWED'; end if;
  end if;
  p_body := btrim(coalesce(p_body,''));
  if p_kind='text' and p_body='' then raise exception 'EMPTY'; end if;
  if length(p_body)>2000 or length(coalesce(p_ref::text,''))>2000 then raise exception 'TOO_LONG'; end if;
  if (select count(*) from public.messages where sender=a.id and at>now()-interval '1 minute')>=40 then raise exception 'SLOW_DOWN'; end if;
  insert into public.messages(conv,sender,sname,srole,body,kind,ref) values (p_conv,a.id,a.name,a.role,p_body,p_kind,p_ref) returning * into m;
  insert into public.msg_reads(account_id,conv,last_id) values (a.id,p_conv,m.id)
    on conflict (account_id,conv) do update set last_id=greatest(public.msg_reads.last_id,excluded.last_id);
  return jsonb_build_object('id',m.id,'conv',m.conv,'s',m.sender,'sn',m.sname,'sr',m.srole,'b',m.body,'k',m.kind,'r',m.ref,'t',m.at);
end $$;

create or replace function public.app_msg_sync(p_token text, p_since bigint default 0) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; ms jsonb; rd jsonb;
begin
  a := public.ehh_auth(p_token);
  select coalesce(jsonb_agg(x order by x.id),'[]'::jsonb) into ms from (
    select m.id, m.conv, m.sender as s, m.sname as sn, m.srole as sr, m.body as b, m.kind as k, m.ref as r, m.at as t
      from public.messages m
     where m.id>p_since and public.ehh_conv_ok(a,m.conv)
     order by m.id desc limit 500) x;
  select coalesce(jsonb_object_agg(conv,last_id),'{}'::jsonb) into rd from public.msg_reads where account_id=a.id;
  return jsonb_build_object('messages',ms,'reads',rd);
end $$;

create or replace function public.app_msg_read(p_token text, p_conv text, p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  if not public.ehh_conv_ok(a,p_conv) then raise exception 'NOT_ALLOWED'; end if;
  insert into public.msg_reads(account_id,conv,last_id) values (a.id,p_conv,p_id)
    on conflict (account_id,conv) do update set last_id=greatest(public.msg_reads.last_id,excluded.last_id);
end $$;

-- ============ HARDENING (advisor fixes) ============
alter function public.ehh_acct_json set search_path = public, pg_temp;
alter function public.ehh_norm set search_path = public, pg_temp;
alter function public.ehh_mask set search_path = public, pg_temp;
alter function public.ehh_conv_ok set search_path = public, pg_temp;
create index if not exists sessions_account_id_idx on public.sessions(account_id);
-- ============ ERROR REPORTING ============
create table if not exists public.error_log(
  id bigserial primary key,
  at timestamptz not null default now(),
  account_id text,
  actor text,
  role text,
  page text,
  msg text not null,
  stack text,
  ua text
);
alter table public.error_log enable row level security;
revoke all on public.error_log from anon, authenticated;
create index if not exists error_log_at_idx on public.error_log(at desc);

-- Browsers report their own JavaScript errors. Works before login too (account stays empty),
-- so it is limited to 30 reports a minute in total and every field is cut to a safe length.
create or replace function public.app_report_error(p_token text, p_data jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  if (select count(*) from public.error_log where at>now()-interval '1 minute')>=30 then return; end if;
  begin a := public.ehh_auth(p_token); exception when others then a := null; end;
  insert into public.error_log(account_id,actor,role,page,msg,stack,ua)
  values (a.id,a.name,a.role,left(coalesce(p_data->>'page',''),200),left(coalesce(p_data->>'msg','(no message)'),500),
          left(p_data->>'stack',2000),left(p_data->>'ua',300));
  delete from public.error_log where at<now()-interval '30 days';
end $$;

create or replace function public.app_errors(p_token text, p_limit int default 100) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  if a.role<>'Doctor' then raise exception 'NOT_ALLOWED'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.id desc) from (
    select id,at,actor,role,page,msg,stack,ua from public.error_log order by id desc limit least(greatest(p_limit,1),300)) x),'[]'::jsonb);
end $$;

revoke all on function public.app_report_error(text,jsonb), public.app_errors(text,int) from public;
grant execute on function public.app_report_error(text,jsonb), public.app_errors(text,int) to anon, authenticated;

-- ============ REQUEST CAPS ============
-- Every signed-in call goes through ehh_auth, so one counter per account caps ALL requests:
-- at most 300 a minute (normal use is well under 100). Beyond that the call fails with SLOW_DOWN.
create table if not exists public.rate_limit(
  account_id text primary key,
  win timestamptz not null,
  n int not null
);
alter table public.rate_limit enable row level security;
revoke all on public.rate_limit from anon, authenticated;

create or replace function public.ehh_auth(p_token text) returns public.accounts
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; c int;
begin
  select ac.* into a from public.sessions s join public.accounts ac on ac.id=s.account_id
   where s.token=p_token and s.expires>now() and s.stage='ok';
  if not found then raise exception 'SESSION_EXPIRED'; end if;
  insert into public.rate_limit as r(account_id,win,n) values (a.id,now(),1)
  on conflict (account_id) do update set
    win = case when r.win < now()-interval '1 minute' then now() else r.win end,
    n   = case when r.win < now()-interval '1 minute' then 1 else r.n+1 end
  returning n into c;
  if c>300 then raise exception 'SLOW_DOWN'; end if;
  return a;
end $$;

-- ============ BACKUPS ============
-- 1) Every night at 03:00 (Manila) the database copies the records into backup_* tables and keeps 7 days.
--    Use it to undo a bad edit or deletion (see "Restore" in README.md).
-- 2) The Doctor can also download a full copy as a file (Activity log > Download backup).
create table if not exists public.backup_snapshots(id bigserial primary key, at timestamptz not null default now(), students int, note text);
create table if not exists public.backup_students(snap bigint not null references public.backup_snapshots(id) on delete cascade, id text not null, data jsonb not null, primary key(snap,id));
create table if not exists public.backup_extra(snap bigint not null references public.backup_snapshots(id) on delete cascade, tbl text not null, data jsonb not null, primary key(snap,tbl));
alter table public.backup_snapshots enable row level security;
alter table public.backup_students enable row level security;
alter table public.backup_extra enable row level security;
revoke all on public.backup_snapshots, public.backup_students, public.backup_extra from anon, authenticated;

create or replace function public.ehh_backup(p_note text default 'nightly') returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare sid bigint; n int;
begin
  insert into public.backup_snapshots(note) values (p_note) returning id into sid;
  insert into public.backup_students(snap,id,data) select sid,id,data from public.students;
  get diagnostics n = row_count;
  update public.backup_snapshots set students=n where id=sid;
  insert into public.backup_extra(snap,tbl,data)
    select sid,'stock',coalesce((select data from public.stock where id=1),'{}'::jsonb)
    union all select sid,'clinic_notes',coalesce((select data from public.clinic_notes where id=1),'[]'::jsonb)
    union all select sid,'transfers',coalesce((select jsonb_agg(data order by id) from public.transfers),'[]'::jsonb);
  delete from public.backup_snapshots where at<now()-interval '7 days';
  return sid;
end $$;

-- Put one learner's record back the way it was in a snapshot (run in the SQL editor).
create or replace function public.ehh_restore_student(p_snap bigint, p_id text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.students s set data=b.data, rev=nextval('public.ehh_rev'), updated_at=now(), updated_by='restore'
    from public.backup_students b where b.snap=p_snap and b.id=p_id and s.id=b.id;
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;
revoke all on function public.ehh_backup(text), public.ehh_restore_student(bigint,text) from public, anon, authenticated;

-- Doctor-only full export for the "Download backup" button.
create or replace function public.app_backup(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  if a.role<>'Doctor' then raise exception 'NOT_ALLOWED'; end if;
  perform public.ehh_log(a,'backup.download',null,'{}'::jsonb);
  return jsonb_build_object('app','EduHealthHub','at',now(),'by',a.name,
    'students',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'data',data) order by id),'[]'::jsonb) from public.students),
    'stock',(select data from public.stock where id=1),
    'clinic_notes',(select data from public.clinic_notes where id=1),
    'transfers',(select coalesce(jsonb_agg(data order by id),'[]'::jsonb) from public.transfers));
end $$;
revoke all on function public.app_backup(text) from public;
grant execute on function public.app_backup(text) to anon, authenticated;

create extension if not exists pg_cron;
select cron.unschedule('ehh-nightly-backup') where exists (select 1 from cron.job where jobname='ehh-nightly-backup');
select cron.schedule('ehh-nightly-backup','0 19 * * *','select public.ehh_backup()');

-- ============ STRICTER LOGIN ============
-- * Username and password are CASE-SENSITIVE ("Dummy Doctor1" is not "dummy doctor1"; spaces count).
--   (Email addresses stay case-insensitive, as emails always are.)
-- * Lockout grows: 5 wrong tries lock that name for 5 minutes, 10 wrong tries for 15 minutes.
--   The lock is kept per lower-cased name so changing capitals cannot dodge it.
-- * A site-wide brake stops guessing across many names (100 failures a minute).
-- * Unknown names cost the same time as wrong passwords, so the response does not reveal which names exist.
-- * Sessions last 8 hours and each account keeps at most 5 at a time.
create or replace function public.app_login(p_user text, p_pw text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; u text := btrim(coalesce(p_user,'')); nk text := lower(btrim(coalesce(p_user,''))); f public.login_fails; tok text; hit boolean; okpw boolean := false;
begin
  if length(u)=0 or length(u)>120 or length(coalesce(p_pw,''))>200 then return jsonb_build_object('error','BAD_LOGIN'); end if;
  if (select coalesce(sum(n),0) from public.login_fails where t>now()-interval '1 minute')>=100 then
    return jsonb_build_object('error','TOO_MANY_ATTEMPTS'); end if;
  select * into f from public.login_fails where login_fails.k=nk;
  if found and ((f.n>=10 and f.t>now()-interval '15 minutes') or (f.n>=5 and f.t>now()-interval '5 minutes')) then
    return jsonb_build_object('error','TOO_MANY_ATTEMPTS'); end if;
  select * into a from public.accounts
   where username=u or lower(email)=nk or (gmail_ok and lower(gmail)=nk) limit 1;
  hit := found;   -- keep FOUND: PERFORM/other statements would overwrite it
  if hit then okpw := (a.pw = crypt(coalesce(p_pw,''), a.pw));
  else okpw := (crypt(coalesce(p_pw,''), gen_salt('bf')) is null); end if;  -- same cost for unknown names
  if not hit or not okpw then
    insert into public.login_fails(k,n,t) values (nk,1,now())
      on conflict (k) do update set n = case when public.login_fails.t>now()-interval '15 minutes' then public.login_fails.n+1 else 1 end, t=now();
    return jsonb_build_object('error','BAD_LOGIN');
  end if;
  delete from public.login_fails where login_fails.k=nk;
  delete from public.sessions where expires<now();
  delete from public.sessions where account_id=a.id and token in (
    select token from public.sessions where account_id=a.id order by expires desc offset 4);
  tok := encode(gen_random_bytes(24),'hex');
  if a.gmail_ok then
    insert into public.sessions(token,account_id,expires,stage) values (tok,a.id,now()+interval '15 minutes','pending');
    return jsonb_build_object('pending',tok,'hint',public.ehh_mask(a.gmail));
  end if;
  insert into public.sessions(token,account_id,expires) values (tok,a.id,now()+interval '8 hours');
  return jsonb_build_object('token',tok,'account',public.ehh_acct_json(a));
end $$;

-- New passwords: at least 10 characters, with a letter and a number, not the username, not the old password.
-- Changing the password signs out every other session of that account.
create or replace function public.app_change_password(p_token text, p_old text, p_new text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; n text := coalesce(p_new,'');
begin
  a := public.ehh_auth(p_token);
  if a.pw <> crypt(coalesce(p_old,''), a.pw) then raise exception 'BAD_PASSWORD'; end if;
  if length(n)<10 or length(n)>200 or n !~ '[A-Za-z]' or n !~ '[0-9]' or lower(n)=lower(a.username) or n=coalesce(p_old,'') then
    raise exception 'WEAK_PASSWORD'; end if;
  update public.accounts set pw=crypt(n, gen_salt('bf')) where id=a.id;
  delete from public.sessions where account_id=a.id and token<>p_token;
  perform public.ehh_log(a,'password.change',null,'{}'::jsonb);
end $$;

-- ============ LIVE UPDATES (Supabase Realtime) ============
-- The database "pings" each signed-in browser the moment a message or record changes, so pages
-- refresh instantly instead of asking every few seconds. The ping carries NO data: it is an empty
-- signal on a private-by-secrecy channel name (rt:<random per session>); the browser then fetches
-- what it is allowed to see through the normal checked functions. If the live connection fails
-- the browser quietly falls back to checking every few seconds, as before.
alter table public.sessions add column if not exists rt text not null default encode(extensions.gen_random_bytes(12),'hex');

create or replace function public.app_rt(p_token text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; r text;
begin
  a := public.ehh_auth(p_token);
  select rt into r from public.sessions where token=p_token;
  return r;
end $$;
revoke all on function public.app_rt(text) from public;
grant execute on function public.app_rt(text) to anon, authenticated;

-- new message: ping only the sessions that may read that conversation
create or replace function public.ehh_trg_msg() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform realtime.send('{}'::jsonb,'ping','rt:'||s.rt,false)
    from public.sessions s join public.accounts ac on ac.id=s.account_id
   where s.stage='ok' and s.expires>now() and public.ehh_conv_ok(ac,NEW.conv);
  return null;
end $$;
drop trigger if exists ehh_msg_ping on public.messages;
create trigger ehh_msg_ping after insert on public.messages for each row execute function public.ehh_trg_msg();

-- record / stock / notes / transfer changed: ping every signed-in session (they re-sync what they may see)
create or replace function public.ehh_trg_data() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform realtime.send('{}'::jsonb,'ping','rt:'||s.rt,false)
    from public.sessions s where s.stage='ok' and s.expires>now();
  return null;
end $$;
drop trigger if exists ehh_students_ping on public.students;
create trigger ehh_students_ping after insert or update on public.students for each statement execute function public.ehh_trg_data();
drop trigger if exists ehh_stock_ping on public.stock;
create trigger ehh_stock_ping after insert or update on public.stock for each statement execute function public.ehh_trg_data();
drop trigger if exists ehh_notes_ping on public.clinic_notes;
create trigger ehh_notes_ping after insert or update on public.clinic_notes for each statement execute function public.ehh_trg_data();
drop trigger if exists ehh_transfers_ping on public.transfers;
create trigger ehh_transfers_ping after insert on public.transfers for each statement execute function public.ehh_trg_data();
revoke all on function public.ehh_trg_msg(), public.ehh_trg_data() from public, anon, authenticated;

-- ============ PRIVACY (forced password change, record-view log) ============
alter table public.accounts add column if not exists must_change boolean not null default false;

create or replace function public.ehh_acct_json(a public.accounts) returns jsonb
language sql immutable as $$
  select jsonb_build_object('id',a.id,'role',a.role,'name',a.name,'username',a.username,'email',a.email,'adv',a.adv,'photo',a.photo,'must_change',a.must_change) $$;
-- session check WITHOUT the must-change rule (used only by change-password)
create or replace function public.ehh_auth_any(p_token text) returns public.accounts
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; c int;
begin
  select ac.* into a from public.sessions s join public.accounts ac on ac.id=s.account_id
   where s.token=p_token and s.expires>now() and s.stage='ok';
  if not found then raise exception 'SESSION_EXPIRED'; end if;
  insert into public.rate_limit as r(account_id,win,n) values (a.id,now(),1)
  on conflict (account_id) do update set
    win = case when r.win < now()-interval '1 minute' then now() else r.win end,
    n   = case when r.win < now()-interval '1 minute' then 1 else r.n+1 end
  returning n into c;
  if c>300 then raise exception 'SLOW_DOWN'; end if;
  return a;
end $$;

-- normal session check: accounts flagged must_change can do nothing until they set a new password
create or replace function public.ehh_auth(p_token text) returns public.accounts
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth_any(p_token);
  if a.must_change then raise exception 'PASSWORD_CHANGE_REQUIRED'; end if;
  return a;
end $$;
revoke all on function public.ehh_auth_any(text) from public, anon, authenticated;

create or replace function public.app_change_password(p_token text, p_old text, p_new text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; n text := coalesce(p_new,'');
begin
  a := public.ehh_auth_any(p_token);
  if a.pw <> crypt(coalesce(p_old,''), a.pw) then raise exception 'BAD_PASSWORD'; end if;
  if length(n)<10 or length(n)>200 or n !~ '[A-Za-z]' or n !~ '[0-9]' or lower(n)=lower(a.username) or n=coalesce(p_old,'') then
    raise exception 'WEAK_PASSWORD'; end if;
  update public.accounts set pw=crypt(n, gen_salt('bf')), must_change=false where id=a.id;
  delete from public.sessions where account_id=a.id and token<>p_token;
  perform public.ehh_log(a,'password.change',null,'{}'::jsonb);
end $$;

-- Go-live switch (run once in the SQL editor): every account must choose a new password at next login.
create or replace function public.ehh_require_password_change() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin update public.accounts set must_change=true; get diagnostics n=row_count; return n; end $$;
revoke all on function public.ehh_require_password_change() from public, anon, authenticated;
-- Who OPENED a learner's record (reading is logged too). Same person + learner is logged once per 10 minutes.
create or replace function public.app_log_view(p_token text, p_student text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  if not exists (select 1 from public.students where id=p_student) then return; end if;
  if exists (select 1 from public.audit_log where account_id=a.id and action='student.view' and target=p_student and at>now()-interval '10 minutes') then return; end if;
  perform public.ehh_log(a,'student.view',p_student,'{}'::jsonb);
end $$;
revoke all on function public.app_log_view(text,text) from public;
grant execute on function public.app_log_view(text,text) to anon, authenticated;

drop function if exists public.app_audit(text,int);
create or replace function public.app_audit(p_token text, p_limit int default 200, p_kind text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  if a.role<>'Doctor' then raise exception 'NOT_ALLOWED'; end if;
  return coalesce((select jsonb_agg(x order by x.id desc) from (
    select l.id, l.at, l.actor, l.role, l.action, l.target, l.detail,
           (select s.data->>'first' || ' ' || (s.data->>'last') from public.students s where s.id=l.target) as who,
           (select s.data->>'lrn' from public.students s where s.id=l.target) as lrn
      from public.audit_log l
     where case p_kind when 'views' then l.action='student.view' when 'changes' then l.action<>'student.view' else true end
     order by l.id desc limit least(greatest(p_limit,1),500)) x),'[]'::jsonb);
end $$;
revoke all on function public.app_audit(text,int,text) from public;
grant execute on function public.app_audit(text,int,text) to anon, authenticated;

-- ============ CLEAN-UP (overall check, Nov 2) ============
drop function if exists public.app_audit_v2(text,int,text);
alter function public.ehh_acct_json(public.accounts) set search_path = public, pg_temp;

-- ============ RENAME: Parental Consent Form -> Purga Consent Form ============
update public.students
   set data = jsonb_set(data,'{files}', (select jsonb_agg(case when f->>'name'='Parental Consent Form' then jsonb_set(f,'{name}','"Purga Consent Form"') else f end) from jsonb_array_elements(data->'files') f)),
       rev = nextval('public.ehh_rev'), updated_at = now(), updated_by = 'rename'
 where data::text like '%Parental Consent Form%' and jsonb_typeof(data->'files')='array';

-- ============ BROWSER CLOSE = LOGOUT ============
-- A session with no sign of life for 10 minutes is dead on the server. Every open page pings every 45 s (app_ping),
-- and every normal call also counts as a sign of life.
alter table public.sessions add column if not exists last_seen timestamptz not null default now();
create or replace function public.ehh_auth_any(p_token text) returns public.accounts
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; c int;
begin
  select ac.* into a from public.sessions s join public.accounts ac on ac.id=s.account_id
   where s.token=p_token and s.expires>now() and s.stage='ok' and s.last_seen>now()-interval '10 minutes';
  if not found then raise exception 'SESSION_EXPIRED'; end if;
  update public.sessions set last_seen=now() where token=p_token and last_seen<now()-interval '20 seconds';
  insert into public.rate_limit as r(account_id,win,n) values (a.id,now(),1)
  on conflict (account_id) do update set
    win = case when r.win < now()-interval '1 minute' then now() else r.win end,
    n   = case when r.win < now()-interval '1 minute' then 1 else r.n+1 end
  returning n into c;
  if c>300 then raise exception 'SLOW_DOWN'; end if;
  return a;
end $$;
revoke all on function public.ehh_auth_any(text) from public, anon, authenticated;
create or replace function public.app_ping(p_token text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin a := public.ehh_auth_any(p_token); end $$;
revoke all on function public.app_ping(text) from public;
grant execute on function public.app_ping(text) to anon, authenticated;

-- =====================================================================
-- FILE ATTACHMENTS IN MESSAGES (pdf, photos, docx, xlsx, txt; max ~2 MB)
-- =====================================================================
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind = any (array['text','pass','record','event','file']));
create table if not exists public.message_files(id bigserial primary key, conv text not null, sender text not null, name text not null, mime text not null, size int not null, data text not null, at timestamptz not null default now());
alter table public.message_files enable row level security;
revoke all on public.message_files from anon, authenticated;
create index if not exists message_files_conv_idx on public.message_files(conv);

-- app_msg_send now also accepts kind 'file' (the file must be the sender's own upload in the same chat)
create or replace function public.app_msg_send(p_token text, p_conv text, p_body text, p_kind text default 'text', p_ref jsonb default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; o public.accounts; oid text; m public.messages;
begin
  a := public.ehh_auth(p_token);
  if not public.ehh_conv_ok(a,p_conv) then raise exception 'NOT_ALLOWED'; end if;
  if p_kind not in ('text','pass','record','event','file') then raise exception 'BAD_REQUEST'; end if;
  if p_conv like 'dm:%' then
    oid := case when split_part(p_conv,':',2)=a.id then split_part(p_conv,':',3) else split_part(p_conv,':',2) end;
    select * into o from public.accounts where id=oid;
    if not found then raise exception 'NOT_ALLOWED'; end if;
    if a.role='Teacher' and o.role='Teacher' then raise exception 'NOT_ALLOWED'; end if;
  end if;
  p_body := btrim(coalesce(p_body,''));
  if p_kind='text' and p_body='' then raise exception 'EMPTY'; end if;
  if p_kind='file' and not exists (select 1 from public.message_files f where f.id=(p_ref->>'fid')::bigint and f.sender=a.id and f.conv=p_conv) then raise exception 'BAD_REQUEST'; end if;
  if length(p_body)>2000 or length(coalesce(p_ref::text,''))>2000 then raise exception 'TOO_LONG'; end if;
  if (select count(*) from public.messages where sender=a.id and at>now()-interval '1 minute')>=40 then raise exception 'SLOW_DOWN'; end if;
  insert into public.messages(conv,sender,sname,srole,body,kind,ref) values (p_conv,a.id,a.name,a.role,p_body,p_kind,p_ref) returning * into m;
  insert into public.msg_reads(account_id,conv,last_id) values (a.id,p_conv,m.id)
    on conflict (account_id,conv) do update set last_id=greatest(public.msg_reads.last_id,excluded.last_id);
  return jsonb_build_object('id',m.id,'conv',m.conv,'s',m.sender,'sn',m.sname,'sr',m.srole,'b',m.body,'k',m.kind,'r',m.ref,'t',m.at);
end $$;

create or replace function public.app_file_put(p_token text, p_conv text, p_name text, p_mime text, p_b64 text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; o public.accounts; oid text; nm text; f public.message_files;
begin
  a := public.ehh_auth(p_token);
  if not public.ehh_conv_ok(a,p_conv) then raise exception 'NOT_ALLOWED'; end if;
  if p_conv like 'dm:%' then
    oid := case when split_part(p_conv,':',2)=a.id then split_part(p_conv,':',3) else split_part(p_conv,':',2) end;
    select * into o from public.accounts where id=oid;
    if not found or (a.role='Teacher' and o.role='Teacher') then raise exception 'NOT_ALLOWED'; end if;
  end if;
  nm := left(regexp_replace(coalesce(p_name,''),'[\\/:*?"<>|\r\n]+','_','g'),150);
  if nm !~* '\.(pdf|jpe?g|png|webp|gif|docx|xlsx|txt)$' then raise exception 'BAD_TYPE'; end if;
  if coalesce(p_mime,'') not in ('application/pdf','image/jpeg','image/png','image/webp','image/gif','text/plain',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') then raise exception 'BAD_TYPE'; end if;
  if p_b64 is null or length(p_b64)=0 or p_b64 !~ '^[A-Za-z0-9+/=]+$' then raise exception 'BAD_REQUEST'; end if;
  if length(p_b64)>2800000 then raise exception 'TOO_BIG'; end if;
  if (select count(*) from public.message_files where sender=a.id and at>now()-interval '1 minute')>=5
     or (select count(*) from public.message_files where sender=a.id and at>now()-interval '1 day')>=100 then raise exception 'SLOW_DOWN'; end if;
  insert into public.message_files(conv,sender,name,mime,size,data) values (p_conv,a.id,nm,p_mime,(length(p_b64)*3)/4,p_b64) returning * into f;
  perform public.ehh_log(a,'file.upload',null,jsonb_build_object('name',nm,'conv',p_conv,'size',f.size));
  return jsonb_build_object('fid',f.id,'name',f.name,'mime',f.mime,'size',f.size);
end $$;
revoke all on function public.app_file_put(text,text,text,text,text) from public;
grant execute on function public.app_file_put(text,text,text,text,text) to anon, authenticated;

create or replace function public.app_file_get(p_token text, p_fid bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; f public.message_files;
begin
  a := public.ehh_auth(p_token);
  select * into f from public.message_files where id=p_fid;
  if not found or not public.ehh_conv_ok(a,f.conv) then raise exception 'NOT_ALLOWED'; end if;
  return jsonb_build_object('name',f.name,'mime',f.mime,'size',f.size,'b64',f.data);
end $$;
revoke all on function public.app_file_get(text,bigint) from public;
grant execute on function public.app_file_get(text,bigint) to anon, authenticated;

-- =====================================================================
-- SIGN-UP REQUESTS (a Doctor must approve before the account exists)
-- =====================================================================
create table if not exists public.signup_requests(
  id bigserial primary key,
  name text not null, username text not null, email text not null,
  role text not null check (role in ('Doctor','Nurse','Dentist','Teacher')),
  adv text, pw text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  at timestamptz not null default now(), decided_by text, decided_at timestamptz);
alter table public.signup_requests enable row level security;
revoke all on public.signup_requests from anon, authenticated;
create index if not exists signup_requests_status_idx on public.signup_requests(status, at);

create or replace function public.app_signup(p_name text, p_role text, p_email text, p_username text, p_pw text, p_adv text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare nm text := btrim(coalesce(p_name,'')); un text := coalesce(p_username,''); em text := btrim(coalesce(p_email,'')); pw text := coalesce(p_pw,'');
        nu text; ne text;
begin
  if length(nm) not between 2 and 80 or p_role not in ('Doctor','Nurse','Dentist','Teacher') then raise exception 'BAD_REQUEST'; end if;
  if length(un) not between 3 and 40 or un<>btrim(un) then raise exception 'BAD_REQUEST'; end if;
  if length(em)>120 or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'BAD_REQUEST'; end if;
  if p_adv is not null and length(p_adv)>30 then raise exception 'BAD_REQUEST'; end if;
  if length(pw)<10 or length(pw)>200 or pw !~ '[A-Za-z]' or pw !~ '[0-9]' or lower(pw)=lower(un) then raise exception 'WEAK_PASSWORD'; end if;
  if (select count(*) from public.signup_requests where at>now()-interval '1 hour')>=30
     or (select count(*) from public.signup_requests where status='pending')>=100 then raise exception 'SLOW_DOWN'; end if;
  nu := regexp_replace(lower(un),'\s+','','g'); ne := regexp_replace(lower(em),'\s+','','g');
  if exists (select 1 from public.accounts where regexp_replace(lower(username),'\s+','','g')=nu or regexp_replace(lower(email),'\s+','','g')=ne)
     or exists (select 1 from public.signup_requests where status='pending' and (regexp_replace(lower(username),'\s+','','g')=nu or regexp_replace(lower(email),'\s+','','g')=ne))
  then raise exception 'DUPLICATE'; end if;
  insert into public.signup_requests(name,username,email,role,adv,pw) values (nm,un,em,p_role,case when p_role='Teacher' then nullif(btrim(p_adv),'') end,crypt(pw,gen_salt('bf')));
end $$;
revoke all on function public.app_signup(text,text,text,text,text,text) from public;
grant execute on function public.app_signup(text,text,text,text,text,text) to anon, authenticated;

create or replace function public.app_signups(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  if a.role<>'Doctor' then raise exception 'NOT_ALLOWED'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'username',username,'email',email,'role',role,'adv',adv,'at',at) order by id) from public.signup_requests where status='pending'),'[]'::jsonb);
end $$;
revoke all on function public.app_signups(text) from public;
grant execute on function public.app_signups(text) to anon, authenticated;

create or replace function public.app_signup_decide(p_token text, p_id bigint, p_ok boolean, p_role text default null, p_adv text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; r public.signup_requests; rl text; ad text;
begin
  a := public.ehh_auth(p_token);
  if a.role<>'Doctor' then raise exception 'NOT_ALLOWED'; end if;
  select * into r from public.signup_requests where id=p_id and status='pending' for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_ok then
    rl := coalesce(p_role,r.role);
    if rl not in ('Doctor','Nurse','Dentist','Teacher') then raise exception 'BAD_REQUEST'; end if;
    ad := case when rl='Teacher' then nullif(btrim(coalesce(p_adv,r.adv,'')),'') end;
    if ad is not null and length(ad)>30 then raise exception 'BAD_REQUEST'; end if;
    if exists (select 1 from public.accounts where regexp_replace(lower(username),'\s+','','g')=regexp_replace(lower(r.username),'\s+','','g')
               or regexp_replace(lower(email),'\s+','','g')=regexp_replace(lower(r.email),'\s+','','g')) then raise exception 'DUPLICATE'; end if;
    insert into public.accounts(id,role,name,username,email,adv,pw) values ('U'||r.id,rl,r.name,r.username,r.email,ad,r.pw);
  end if;
  update public.signup_requests set status=case when p_ok then 'approved' else 'rejected' end, pw='', decided_by=a.name, decided_at=now() where id=r.id;
  perform public.ehh_log(a,case when p_ok then 'account.approve' else 'account.reject' end,r.username,jsonb_build_object('role',coalesce(p_role,r.role),'name',r.name));
end $$;
revoke all on function public.app_signup_decide(text,bigint,boolean,text,text) from public;
grant execute on function public.app_signup_decide(text,bigint,boolean,text,text) to anon, authenticated;

-- =====================================================================
-- ACCOUNT TOOLS FOR DOCTORS + FULLER BACKUPS
-- =====================================================================
alter table public.accounts add column if not exists active boolean not null default true;

-- sessions of a deactivated account stop working
create or replace function public.ehh_auth_any(p_token text) returns public.accounts
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; c int;
begin
  select ac.* into a from public.sessions s join public.accounts ac on ac.id=s.account_id
   where s.token=p_token and s.expires>now() and s.stage='ok' and s.last_seen>now()-interval '10 minutes' and ac.active;
  if not found then raise exception 'SESSION_EXPIRED'; end if;
  update public.sessions set last_seen=now() where token=p_token and last_seen<now()-interval '20 seconds';
  insert into public.rate_limit as r(account_id,win,n) values (a.id,now(),1)
  on conflict (account_id) do update set
    win = case when r.win < now()-interval '1 minute' then now() else r.win end,
    n   = case when r.win < now()-interval '1 minute' then 1 else r.n+1 end
  returning n into c;
  if c>300 then raise exception 'SLOW_DOWN'; end if;
  return a;
end $$;
revoke all on function public.ehh_auth_any(text) from public, anon, authenticated;

-- app_login: a deactivated account cannot log in (same BAD_LOGIN answer, so nothing is revealed)
create or replace function public.app_login(p_user text, p_pw text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; u text := btrim(coalesce(p_user,'')); nk text := lower(btrim(coalesce(p_user,''))); f public.login_fails; tok text; hit boolean; okpw boolean := false;
begin
  if length(u)=0 or length(u)>120 or length(coalesce(p_pw,''))>200 then return jsonb_build_object('error','BAD_LOGIN'); end if;
  if (select coalesce(sum(n),0) from public.login_fails where t>now()-interval '1 minute')>=100 then
    return jsonb_build_object('error','TOO_MANY_ATTEMPTS'); end if;
  select * into f from public.login_fails where login_fails.k=nk;
  if found and ((f.n>=10 and f.t>now()-interval '15 minutes') or (f.n>=5 and f.t>now()-interval '5 minutes')) then
    return jsonb_build_object('error','TOO_MANY_ATTEMPTS'); end if;
  select * into a from public.accounts
   where username=u or lower(email)=nk or (gmail_ok and lower(gmail)=nk) limit 1;
  hit := found;
  if hit then okpw := (a.pw = crypt(coalesce(p_pw,''), a.pw)) and a.active;
  else okpw := (crypt(coalesce(p_pw,''), gen_salt('bf')) is null); end if;
  if not hit or not okpw then
    insert into public.login_fails(k,n,t) values (nk,1,now())
      on conflict (k) do update set n = case when public.login_fails.t>now()-interval '15 minutes' then public.login_fails.n+1 else 1 end, t=now();
    return jsonb_build_object('error','BAD_LOGIN');
  end if;
  delete from public.login_fails where login_fails.k=nk;
  delete from public.sessions where expires<now();
  delete from public.sessions where account_id=a.id and token in (
    select token from public.sessions where account_id=a.id order by expires desc offset 4);
  tok := encode(gen_random_bytes(24),'hex');
  if a.totp_on then
    insert into public.sessions(token,account_id,expires,stage) values (tok,a.id,now()+interval '15 minutes','totp');
    return jsonb_build_object('totp',tok);
  end if;
  if a.gmail_ok then
    insert into public.sessions(token,account_id,expires,stage) values (tok,a.id,now()+interval '15 minutes','pending');
    return jsonb_build_object('pending',tok,'hint',public.ehh_mask(a.gmail));
  end if;
  insert into public.sessions(token,account_id,expires) values (tok,a.id,now()+interval '8 hours');
  return jsonb_build_object('token',tok,'account',public.ehh_acct_json(a));
end $$;

create or replace function public.app_accounts(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  if a.role<>'Doctor' then raise exception 'NOT_ALLOWED'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'role',role,'name',name,'username',username,'email',email,'adv',adv,'active',active,'must_change',must_change) order by role,name) from public.accounts),'[]'::jsonb);
end $$;
revoke all on function public.app_accounts(text) from public;
grant execute on function public.app_accounts(text) to anon, authenticated;

create or replace function public.app_account_set(p_token text, p_id text, p_active boolean default null, p_adv text default null, p_set_adv boolean default false) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; t public.accounts;
begin
  a := public.ehh_auth(p_token);
  if a.role<>'Doctor' then raise exception 'NOT_ALLOWED'; end if;
  select * into t from public.accounts where id=p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_active is not null and p_active=false then
    if t.id=a.id then raise exception 'SELF'; end if;
    if t.role='Doctor' and t.active and (select count(*) from public.accounts where role='Doctor' and active)<=1 then raise exception 'LAST_DOCTOR'; end if;
  end if;
  if p_set_adv then
    if t.role<>'Teacher' or length(coalesce(p_adv,''))>30 then raise exception 'BAD_REQUEST'; end if;
    update public.accounts set adv=nullif(btrim(coalesce(p_adv,'')),'') where id=t.id;
    perform public.ehh_log(a,'account.advisory',t.username,jsonb_build_object('adv',nullif(btrim(coalesce(p_adv,'')),'')));
  end if;
  if p_active is not null then
    update public.accounts set active=p_active where id=t.id;
    if not p_active then delete from public.sessions where account_id=t.id; end if;
    perform public.ehh_log(a,case when p_active then 'account.activate' else 'account.deactivate' end,t.username,jsonb_build_object('name',t.name));
  end if;
end $$;
revoke all on function public.app_account_set(text,text,boolean,text,boolean) from public;
grant execute on function public.app_account_set(text,text,boolean,text,boolean) to anon, authenticated;

create or replace function public.app_account_reset(p_token text, p_id text, p_temp text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; t public.accounts; n text := coalesce(p_temp,'');
begin
  a := public.ehh_auth(p_token);
  if a.role<>'Doctor' then raise exception 'NOT_ALLOWED'; end if;
  select * into t from public.accounts where id=p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if t.id=a.id then raise exception 'SELF'; end if;
  if length(n)<10 or length(n)>200 or n !~ '[A-Za-z]' or n !~ '[0-9]' or lower(n)=lower(t.username) then raise exception 'WEAK_PASSWORD'; end if;
  update public.accounts set pw=crypt(n,gen_salt('bf')), must_change=true where id=t.id;
  delete from public.sessions where account_id=t.id;
  delete from public.login_fails where k=lower(btrim(t.username)) or k=lower(btrim(t.email));
  perform public.ehh_log(a,'account.reset',t.username,jsonb_build_object('name',t.name));
end $$;
revoke all on function public.app_account_reset(text,text,text) from public;
grant execute on function public.app_account_reset(text,text,text) to anon, authenticated;

-- Doctor download: now also accounts (no passwords), messages, file list and the activity log
create or replace function public.app_backup(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  if a.role<>'Doctor' then raise exception 'NOT_ALLOWED'; end if;
  perform public.ehh_log(a,'backup.download',null,'{}'::jsonb);
  return jsonb_build_object('app','EduHealthHub','version',2,'at',now(),'by',a.name,
    'students',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'data',data) order by id),'[]'::jsonb) from public.students),
    'stock',(select data from public.stock where id=1),
    'clinic_notes',(select data from public.clinic_notes where id=1),
    'transfers',(select coalesce(jsonb_agg(data order by id),'[]'::jsonb) from public.transfers),
    'accounts',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'role',role,'name',name,'username',username,'email',email,'adv',adv,'active',active) order by id),'[]'::jsonb) from public.accounts),
    'messages',(select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) from public.messages m),
    'file_list',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'conv',conv,'sender',sender,'name',name,'mime',mime,'size',size,'at',at) order by id),'[]'::jsonb) from public.message_files),
    'activity_log',(select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]'::jsonb) from (select * from public.audit_log order by id desc limit 5000) l),
    'note','Passwords are never exported. Uploaded file contents are not included (only their list).');
end $$;

-- Nightly snapshot: also accounts (with password hashes, server-side only), messages and the activity log
create or replace function public.ehh_backup(p_note text default 'nightly') returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare sid bigint; n int;
begin
  insert into public.backup_snapshots(note) values (p_note) returning id into sid;
  insert into public.backup_students(snap,id,data) select sid,id,data from public.students;
  get diagnostics n = row_count;
  update public.backup_snapshots set students=n where id=sid;
  insert into public.backup_extra(snap,tbl,data)
    select sid,'stock',coalesce((select data from public.stock where id=1),'{}'::jsonb)
    union all select sid,'clinic_notes',coalesce((select data from public.clinic_notes where id=1),'[]'::jsonb)
    union all select sid,'transfers',coalesce((select jsonb_agg(data order by id) from public.transfers),'[]'::jsonb)
    union all select sid,'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'role',role,'name',name,'username',username,'email',email,'adv',adv,'active',active,'pw',pw) order by id) from public.accounts),'[]'::jsonb)
    union all select sid,'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.id) from public.messages m),'[]'::jsonb)
    union all select sid,'activity_log',coalesce((select jsonb_agg(to_jsonb(l) order by l.id) from (select * from public.audit_log order by id desc limit 5000) l),'[]'::jsonb);
  delete from public.backup_snapshots where at<now()-interval '7 days';
  return sid;
end $$;

-- =====================================================================
-- EDIT AND UNSEND MESSAGES
-- Each change gets a new "rev" number so other people's screens pick it up through app_msg_sync.
-- =====================================================================
create sequence if not exists public.messages_rev_seq;
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists deleted boolean not null default false;
alter table public.messages add column if not exists rev bigint not null default nextval('public.messages_rev_seq');
create index if not exists messages_rev_idx on public.messages(rev);
drop trigger if exists ehh_msg_ping on public.messages;
create trigger ehh_msg_ping after insert or update on public.messages for each row execute function public.ehh_trg_msg();

drop function if exists public.app_msg_sync(text,bigint);
create or replace function public.app_msg_sync(p_token text, p_since bigint default 0, p_rev bigint default 0) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; ms jsonb; ch jsonb; rd jsonb;
begin
  a := public.ehh_auth(p_token);
  select coalesce(jsonb_agg(x order by x.id),'[]'::jsonb) into ms from (
    select m.id, m.conv, m.sender as s, m.sname as sn, m.srole as sr, m.body as b, m.kind as k, m.ref as r, m.at as t, m.rev as v, m.deleted as d, m.edited_at as e
      from public.messages m
     where m.id>p_since and public.ehh_conv_ok(a,m.conv)
     order by m.id desc limit 500) x;
  select coalesce(jsonb_agg(x order by x.v),'[]'::jsonb) into ch from (
    select m.id, m.conv, m.sender as s, m.sname as sn, m.srole as sr, m.body as b, m.kind as k, m.ref as r, m.at as t, m.rev as v, m.deleted as d, m.edited_at as e
      from public.messages m
     where p_rev>0 and m.id<=p_since and m.rev>p_rev and public.ehh_conv_ok(a,m.conv)
     order by m.rev limit 200) x;
  select coalesce(jsonb_object_agg(conv,last_id),'{}'::jsonb) into rd from public.msg_reads where account_id=a.id;
  return jsonb_build_object('messages',ms,'changes',ch,'reads',rd);
end $$;
revoke all on function public.app_msg_sync(text,bigint,bigint) from public;
grant execute on function public.app_msg_sync(text,bigint,bigint) to anon, authenticated;

create or replace function public.ehh_msg_json(m public.messages) returns jsonb
language sql immutable as $$ select jsonb_build_object('id',m.id,'conv',m.conv,'s',m.sender,'sn',m.sname,'sr',m.srole,'b',m.body,'k',m.kind,'r',m.ref,'t',m.at,'v',m.rev,'d',m.deleted,'e',m.edited_at) $$;
revoke all on function public.ehh_msg_json(public.messages) from public, anon, authenticated;

create or replace function public.app_msg_edit(p_token text, p_id bigint, p_body text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; m public.messages; b text := btrim(coalesce(p_body,''));
begin
  a := public.ehh_auth(p_token);
  select * into m from public.messages where id=p_id;
  if not found or m.sender<>a.id or not public.ehh_conv_ok(a,m.conv) then raise exception 'NOT_ALLOWED'; end if;
  if m.deleted or m.kind<>'text' then raise exception 'NOT_ALLOWED'; end if;
  if b='' then raise exception 'EMPTY'; end if;
  if length(b)>2000 then raise exception 'TOO_LONG'; end if;
  if (select count(*) from public.messages where sender=a.id and edited_at>now()-interval '1 minute')>=30 then raise exception 'SLOW_DOWN'; end if;
  if b<>m.body then
    update public.messages set body=b, edited_at=now(), rev=nextval('public.messages_rev_seq') where id=m.id returning * into m;
    perform public.ehh_log(a,'message.edit',m.conv,jsonb_build_object('id',m.id));
  end if;
  return public.ehh_msg_json(m);
end $$;
revoke all on function public.app_msg_edit(text,bigint,text) from public;
grant execute on function public.app_msg_edit(text,bigint,text) to anon, authenticated;

create or replace function public.app_msg_unsend(p_token text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; m public.messages;
begin
  a := public.ehh_auth(p_token);
  select * into m from public.messages where id=p_id;
  if not found or m.sender<>a.id or not public.ehh_conv_ok(a,m.conv) then raise exception 'NOT_ALLOWED'; end if;
  if m.kind not in ('text','file','record') then raise exception 'NOT_ALLOWED'; end if;
  if not m.deleted then
    if m.kind='file' and m.ref ? 'fid' then delete from public.message_files where id=(m.ref->>'fid')::bigint and sender=a.id; end if;
    update public.messages set deleted=true, body='', ref=null, rev=nextval('public.messages_rev_seq') where id=m.id returning * into m;
    perform public.ehh_log(a,'message.unsend',m.conv,jsonb_build_object('id',m.id));
  end if;
  return public.ehh_msg_json(m);
end $$;
revoke all on function public.app_msg_unsend(text,bigint) from public;
grant execute on function public.app_msg_unsend(text,bigint) to anon, authenticated;

-- app_msg_send returns the same shape (adds v, d, e)
create or replace function public.app_msg_send(p_token text, p_conv text, p_body text, p_kind text default 'text', p_ref jsonb default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.accounts; o public.accounts; oid text; m public.messages;
begin
  a := public.ehh_auth(p_token);
  if not public.ehh_conv_ok(a,p_conv) then raise exception 'NOT_ALLOWED'; end if;
  if p_kind not in ('text','pass','record','event','file') then raise exception 'BAD_REQUEST'; end if;
  if p_conv like 'dm:%' then
    oid := case when split_part(p_conv,':',2)=a.id then split_part(p_conv,':',3) else split_part(p_conv,':',2) end;
    select * into o from public.accounts where id=oid;
    if not found then raise exception 'NOT_ALLOWED'; end if;
    if a.role='Teacher' and o.role='Teacher' then raise exception 'NOT_ALLOWED'; end if;
  end if;
  p_body := btrim(coalesce(p_body,''));
  if p_kind='text' and p_body='' then raise exception 'EMPTY'; end if;
  if p_kind='file' and not exists (select 1 from public.message_files f where f.id=(p_ref->>'fid')::bigint and f.sender=a.id and f.conv=p_conv) then raise exception 'BAD_REQUEST'; end if;
  if length(p_body)>2000 or length(coalesce(p_ref::text,''))>2000 then raise exception 'TOO_LONG'; end if;
  if (select count(*) from public.messages where sender=a.id and at>now()-interval '1 minute')>=40 then raise exception 'SLOW_DOWN'; end if;
  insert into public.messages(conv,sender,sname,srole,body,kind,ref) values (p_conv,a.id,a.name,a.role,p_body,p_kind,p_ref) returning * into m;
  insert into public.msg_reads(account_id,conv,last_id) values (a.id,p_conv,m.id)
    on conflict (account_id,conv) do update set last_id=greatest(public.msg_reads.last_id,excluded.last_id);
  return public.ehh_msg_json(m);
end $$;

-- =====================================================================
-- DOWNLOAD BACKUP REMOVED (kept: the nightly in-database backup, ehh_backup)
-- =====================================================================
drop function if exists public.app_backup(text);

-- =====================================================================
-- TWO-STEP VERIFICATION (authenticator app codes, 6 digits, 30 seconds)
-- Required for everyone while app_flags.require_2fa is true.
-- Turn the rule off:  update public.app_flags set v=false where k='require_2fa';
-- =====================================================================
create table if not exists public.app_flags(k text primary key, v boolean not null);
insert into public.app_flags(k,v) values ('require_2fa',true) on conflict (k) do nothing;
alter table public.app_flags enable row level security;
revoke all on public.app_flags from anon, authenticated;

alter table public.accounts add column if not exists totp_secret bytea;
alter table public.accounts add column if not exists totp_pending bytea;
alter table public.accounts add column if not exists totp_on boolean not null default false;
alter table public.accounts add column if not exists totp_last bigint not null default 0;
create table if not exists public.totp_recovery(id bigserial primary key, account_id text not null references public.accounts(id) on delete cascade, h text not null, used boolean not null default false);
alter table public.totp_recovery enable row level security;
revoke all on public.totp_recovery from anon, authenticated;

create or replace function public.ehh_flag(p_k text) returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select v from public.app_flags where k=p_k),false) $$;
revoke all on function public.ehh_flag(text) from public, anon, authenticated;

create or replace function public.ehh_acct_json(a public.accounts) returns jsonb language sql stable set search_path=public,pg_temp as $$
  select jsonb_build_object('id',a.id,'role',a.role,'name',a.name,'username',a.username,'email',a.email,'adv',a.adv,'photo',a.photo,'must_change',a.must_change,'totp',a.totp_on,'need2fa',(public.ehh_flag('require_2fa') and not a.totp_on)) $$;

create or replace function public.ehh_b32(b bytea) returns text language plpgsql immutable as $$
declare al constant text:='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; bits text:=''; r text:=''; i int;
begin
  for i in 0..length(b)-1 loop bits:=bits||get_byte(b,i)::bit(8)::text; end loop;
  for i in 0..length(bits)/5-1 loop r:=r||substr(al,(substring(bits from i*5+1 for 5)::bit(5)::int)+1,1); end loop;
  return r;
end $$;

create or replace function public.ehh_totp(sec bytea, ctr bigint) returns text language plpgsql immutable set search_path=public,extensions as $$
declare h bytea; o int; v bigint;
begin
  h := hmac(decode(lpad(to_hex(ctr),16,'0'),'hex'), sec, 'sha1');
  o := get_byte(h,19) & 15;
  v := ((get_byte(h,o)&127)::bigint<<24)|(get_byte(h,o+1)::bigint<<16)|(get_byte(h,o+2)::bigint<<8)|get_byte(h,o+3)::bigint;
  return lpad((v % 1000000)::text,6,'0');
end $$;

-- a code is good if it matches this 30-second step or one either side, and is newer than the last one used
create or replace function public.ehh_totp_check(a public.accounts, sec bytea, p_code text, p_upd boolean) returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare c bigint := floor(extract(epoch from now())/30)::bigint; k bigint; cd text := regexp_replace(coalesce(p_code,''),'\s','','g');
begin
  if sec is null or cd !~ '^[0-9]{6}$' then return false; end if;
  for k in c-1..c+1 loop
    if k>a.totp_last and public.ehh_totp(sec,k)=cd then
      if p_upd then update public.accounts set totp_last=k where id=a.id; end if;
      return true;
    end if;
  end loop;
  return false;
end $$;

create or replace function public.ehh_totp_locked(p_id text) returns boolean language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.login_fails f where f.k='totp:'||p_id and ((f.n>=10 and f.t>now()-interval '15 minutes') or (f.n>=5 and f.t>now()-interval '5 minutes'))) $$;
create or replace function public.ehh_totp_fail(p_id text) returns void language sql security definer set search_path=public as $$
  insert into public.login_fails(k,n,t) values ('totp:'||p_id,1,now())
  on conflict (k) do update set n = case when public.login_fails.t>now()-interval '15 minutes' then public.login_fails.n+1 else 1 end, t=now() $$;

create or replace function public.ehh_new_codes(p_id text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare c text; out jsonb := '[]'::jsonb; i int;
begin
  delete from public.totp_recovery where account_id=p_id;
  for i in 1..8 loop
    c := lower(encode(gen_random_bytes(5),'hex'));
    insert into public.totp_recovery(account_id,h) values (p_id,crypt(c,gen_salt('bf')));
    out := out || to_jsonb(substr(c,1,5)||'-'||substr(c,6,5));
  end loop;
  return out;
end $$;
revoke all on function public.ehh_b32(bytea), public.ehh_totp(bytea,bigint), public.ehh_totp_check(public.accounts,bytea,text,boolean), public.ehh_totp_locked(text), public.ehh_totp_fail(text), public.ehh_new_codes(text) from public, anon, authenticated;

-- normal session check: also needs two-step set up while the rule is on
create or replace function public.ehh_auth(p_token text) returns public.accounts language plpgsql security definer set search_path=public,extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth_any(p_token);
  if a.must_change then raise exception 'PASSWORD_CHANGE_REQUIRED'; end if;
  if not a.totp_on and public.ehh_flag('require_2fa') then raise exception 'TWOFA_SETUP_REQUIRED'; end if;
  return a;
end $$;

-- set-up step 1: make a secret (shown once as a QR code / typed key)
create or replace function public.app_totp_begin(p_token text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a public.accounts; s bytea;
begin
  a := public.ehh_auth_any(p_token);
  if a.totp_on then raise exception 'BAD_REQUEST'; end if;
  s := gen_random_bytes(20);
  update public.accounts set totp_pending=s where id=a.id;
  return jsonb_build_object('secret',public.ehh_b32(s),'username',a.username);
end $$;

-- set-up step 2: prove it works with a first code, then get the recovery codes (shown once)
create or replace function public.app_totp_enable(p_token text, p_code text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a public.accounts; codes jsonb;
begin
  a := public.ehh_auth_any(p_token);
  if a.totp_on or a.totp_pending is null then raise exception 'BAD_REQUEST'; end if;
  if public.ehh_totp_locked(a.id) then return jsonb_build_object('error','TOO_MANY_ATTEMPTS'); end if;
  if not public.ehh_totp_check(a,a.totp_pending,p_code,true) then
    perform public.ehh_totp_fail(a.id); return jsonb_build_object('error','BAD_CODE'); end if;
  delete from public.login_fails where k='totp:'||a.id;
  update public.accounts set totp_secret=totp_pending, totp_pending=null, totp_on=true where id=a.id;
  codes := public.ehh_new_codes(a.id);
  perform public.ehh_log(a,'twofa.enable',null,'{}'::jsonb);
  return jsonb_build_object('codes',codes);
end $$;

-- login step 2: password was right, now the code (or one recovery code)
create or replace function public.app_totp_login(p_token text, p_code text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a public.accounts; ok boolean; rid bigint; rc text := lower(regexp_replace(coalesce(p_code,''),'[\s-]','','g'));
begin
  select ac.* into a from public.sessions s join public.accounts ac on ac.id=s.account_id
   where s.token=p_token and s.expires>now() and s.stage='totp' and ac.active and ac.totp_on;
  if not found then raise exception 'SESSION_EXPIRED'; end if;
  if public.ehh_totp_locked(a.id) then return jsonb_build_object('error','TOO_MANY_ATTEMPTS'); end if;
  ok := public.ehh_totp_check(a,a.totp_secret,p_code,true);
  if not ok and rc ~ '^[0-9a-f]{10}$' then
    select id into rid from public.totp_recovery where account_id=a.id and not used and h=crypt(rc,h) limit 1;
    if found then update public.totp_recovery set used=true where id=rid; ok:=true;
      perform public.ehh_log(a,'twofa.recovery_used',null,'{}'::jsonb); end if;
  end if;
  if not ok then perform public.ehh_totp_fail(a.id); return jsonb_build_object('error','BAD_CODE'); end if;
  delete from public.login_fails where k='totp:'||a.id;
  update public.sessions set stage='ok', expires=now()+interval '8 hours' where token=p_token;
  return jsonb_build_object('token',p_token,'account',public.ehh_acct_json(a));
end $$;

-- new set of recovery codes (needs a current code from the app)
create or replace function public.app_totp_new_codes(p_token text, p_code text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  if not a.totp_on then raise exception 'BAD_REQUEST'; end if;
  if public.ehh_totp_locked(a.id) then return jsonb_build_object('error','TOO_MANY_ATTEMPTS'); end if;
  if not public.ehh_totp_check(a,a.totp_secret,p_code,true) then
    perform public.ehh_totp_fail(a.id); return jsonb_build_object('error','BAD_CODE'); end if;
  perform public.ehh_log(a,'twofa.new_codes',null,'{}'::jsonb);
  return jsonb_build_object('codes',public.ehh_new_codes(a.id));
end $$;

-- a Doctor can reset someone else's two-step (lost phone). They set it up again at next login.
create or replace function public.app_account_2fa_reset(p_token text, p_id text) returns void language plpgsql security definer set search_path=public,extensions as $$
declare a public.accounts; t public.accounts;
begin
  a := public.ehh_auth(p_token);
  if a.role<>'Doctor' then raise exception 'NOT_ALLOWED'; end if;
  select * into t from public.accounts where id=p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if t.id=a.id then raise exception 'SELF'; end if;
  update public.accounts set totp_on=false, totp_secret=null, totp_pending=null, totp_last=0 where id=t.id;
  delete from public.totp_recovery where account_id=t.id;
  delete from public.sessions where account_id=t.id;
  perform public.ehh_log(a,'account.2fa_reset',t.username,jsonb_build_object('name',t.name));
end $$;

create or replace function public.app_accounts(p_token text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a public.accounts;
begin
  a := public.ehh_auth(p_token);
  if a.role<>'Doctor' then raise exception 'NOT_ALLOWED'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'role',role,'name',name,'username',username,'email',email,'adv',adv,'active',active,'must_change',must_change,'totp',totp_on) order by role,name) from public.accounts),'[]'::jsonb);
end $$;

-- login: accounts with two-step get a code step first
do $$ declare d text; begin
  d := pg_get_functiondef('public.app_login(text,text)'::regprocedure);
  if d not like '%''totp'',tok%' then
    d := replace(d, '  if a.gmail_ok then', E'  if a.totp_on then\n    insert into public.sessions(token,account_id,expires,stage) values (tok,a.id,now()+interval ''15 minutes'',''totp'');\n    return jsonb_build_object(''totp'',tok);\n  end if;\n  if a.gmail_ok then');
    execute d;
  end if;
end $$;
do $$ declare f text; begin
  foreach f in array array['app_totp_begin(text)','app_totp_enable(text,text)','app_totp_login(text,text)','app_totp_new_codes(text,text)','app_account_2fa_reset(text,text)'] loop
    execute 'revoke all on function public.'||f||' from public';
    execute 'grant execute on function public.'||f||' to anon, authenticated';
  end loop;
end $$;

-- =====================================================================
-- SECURITY TIDY-UP (after the audit)
-- =====================================================================
alter function public.ehh_b32(bytea) set search_path = public, pg_temp;
alter function public.ehh_msg_json(public.messages) set search_path = public, pg_temp;
revoke all on function public.ehh_conv_ok(public.accounts, text) from public, anon, authenticated;
