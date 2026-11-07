-- Rewards Chart — starting data
-- Run after schema.sql. Safe to edit names, amounts and jobs here first,
-- or change everything later from the parent screens.

insert into public.settings (id) values (1) on conflict (id) do nothing;

-- Starting parent PIN is 1234. Change it from Parent → Settings straight away.
insert into public.parent_pin (id, pin_hash)
values (1, extensions.crypt('1234', extensions.gen_salt('bf')))
on conflict (id) do nothing;

with k as (
  insert into public.kids (name, age, color, weekly_pocket_money, daily_tech_minutes, sort)
  values
    ('Tommy', 11, '#FF5A5A', 10, 30, 1),
    ('Louie', 7, '#2EE6D6', 8, 30, 2)
  returning id, name
)
insert into public.jobs (kid_id, title, icon, kind, stars, max_per_week, days, sort)
select k.id, j.title, j.icon, j.kind, j.stars, j.max_per_week, j.days::int[], j.sort
from k
join (values
  -- Tommy's morning quests
  ('Tommy', 'Make bed',      'bed',     'daily', 10, 3, '{1,2,3,4,5,6,7}', 1),
  ('Tommy', 'Get dressed',   'shirt',   'daily', 10, 3, '{1,2,3,4,5}',     2),
  ('Tommy', 'Teeth',         'teeth',   'daily', 10, 3, '{1,2,3,4,5,6,7}', 3),
  ('Tommy', 'Make lunch',    'lunch',   'daily', 10, 3, '{1,2,3,4,5}',     4),
  ('Tommy', 'School bag',    'bag',     'daily', 10, 3, '{1,2,3,4,5}',     5),
  -- Tommy's bonus jobs
  ('Tommy', 'Dishwasher',    'dish',    'bonus', 15, 3, '{1,2,3,4,5,6,7}', 1),
  ('Tommy', 'Rubbish out',   'bin',     'bonus', 15, 3, '{1,2,3,4,5,6,7}', 2),
  ('Tommy', 'Hang washing',  'washing', 'bonus', 15, 3, '{1,2,3,4,5,6,7}', 3),
  ('Tommy', 'Toilet paper',  'roll',    'bonus', 10, 3, '{1,2,3,4,5,6,7}', 4),
  -- Louie's morning quests
  ('Louie', 'Bed',           'bed',     'daily', 10, 3, '{1,2,3,4,5,6,7}', 1),
  ('Louie', 'Get dressed',   'shirt',   'daily', 10, 3, '{1,2,3,4,5}',     2),
  ('Louie', 'Teeth',         'teeth',   'daily', 10, 3, '{1,2,3,4,5,6,7}', 3),
  ('Louie', 'Bowl to sink',  'bowl',    'daily', 10, 3, '{1,2,3,4,5,6,7}', 4),
  ('Louie', 'School bag',    'bag',     'daily', 10, 3, '{1,2,3,4,5}',     5),
  -- Louie's bonus jobs
  ('Louie', 'Clothes away',  'clothes', 'bonus', 15, 3, '{1,2,3,4,5,6,7}', 1),
  ('Louie', 'Toilet paper',  'roll',    'bonus', 10, 3, '{1,2,3,4,5,6,7}', 2),
  ('Louie', 'Set the table', 'table',   'bonus', 10, 3, '{1,2,3,4,5,6,7}', 3),
  ('Louie', 'Shoes away',    'shoe',    'bonus', 10, 3, '{1,2,3,4,5,6,7}', 4)
) as j(kid, title, icon, kind, stars, max_per_week, days, sort) on j.kid = k.name;
