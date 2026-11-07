-- Rewards Chart — give logins access
-- 1. In Supabase → Authentication → Users → "Add user", create:
--      • one user for each parent (your own emails)
--      • one user for the kids' iPad (e.g. ipad@yourfamily.local, any strong password)
--    Tick "Auto Confirm User" when you add them.
-- 2. Put the emails below and run this file.

insert into public.profiles (user_id, role, display_name)
select id, 'parent', 'Mum' from auth.users where email = 'mum@example.com'
on conflict (user_id) do update set role = excluded.role, display_name = excluded.display_name;

insert into public.profiles (user_id, role, display_name)
select id, 'parent', 'Dad' from auth.users where email = 'dad@example.com'
on conflict (user_id) do update set role = excluded.role, display_name = excluded.display_name;

insert into public.profiles (user_id, role, display_name)
select id, 'tablet', 'Kids iPad' from auth.users where email = 'ipad@example.com'
on conflict (user_id) do update set role = excluded.role, display_name = excluded.display_name;

-- Check: this should list all three logins with their roles.
select u.email, p.role, p.display_name
from public.profiles p join auth.users u on u.id = p.user_id;
