# Rewards Chart

A game-style chores and pocket-money app for Tommy and Louie.

- **Kids' iPad:** pick a player, tick off morning quests, log bonus jobs, and watch the dollar cards tick over. It also shows the leave-for-school countdown (with a speed bonus) and today's tech time.
- **Parents' phones:** approve bonus jobs, give or take away money, tech time or stars (with a reason), edit each child's jobs, set pocket money, mark pay day, and change the PIN.
- Everything stays in sync between the iPad and your phones.

It's a web app built with React. The data lives in [Supabase](https://supabase.com) (free plan), and the app is hosted for free on [Vercel](https://vercel.com).

---

## How the game works

| Thing | How it works | Change it in |
|---|---|---|
| Morning quests | Each child has their own list. Each one ticked is worth stars (10 by default). | Parent → Jobs |
| Bonus jobs | Kids tap them on the iPad, then a parent approves. Each one is worth stars plus 10 min tech time, and can be done up to 3× a week. | Parent → Jobs |
| Pocket money | $1 for every 30 stars, up to each child's weekly amount. The week runs Monday to Sunday and is paid Sunday. | Parent → Settings |
| Dollar cards | One card per dollar. Earned dollars get a tick. The next dollar shows its star progress. Dollars taken away are marked TAKEN. | — |
| Tech time | A daily allowance (30 min), plus minutes from bonus jobs approved today, minus anything taken away. It shows as locked until the morning quests are done. | Parent → Settings |
| School countdown | Counts down to leave time (8:15am) on school days. Finish every quest 15+ minutes early for +20 bonus stars. | Parent → Settings |
| Give / take away | Parents can add or remove pocket money (50c steps), tech time (5 min steps) or stars, with a reason the kids can see. | Parent → Give / take |
| Levels & streaks | Every 150 stars ever earned is a new level. A streak is the number of days in a row with every quest done. | — |

---

## Set it up (about 15 minutes, once)

### 1. Database — done ✓

The database already lives in your Supabase project **Kids Apps**. It has the tables, the security rules, Tommy and Louie with their jobs, and the starting PIN 1234. The app is already pointed at it in `.env.production`.

To rebuild it from scratch in another project, run [`supabase/schema.sql`](supabase/schema.sql) and then [`supabase/seed.sql`](supabase/seed.sql) in that project's SQL Editor.

### 2. Create the logins

1. In Supabase, open the **Kids Apps** project and go to **Authentication** → **Users** → **Add user** → **Create new user**. Tick **Auto Confirm User** each time.
   - One user for each parent, using your real emails.
   - One user for the kids' iPad, for example `ipad@yourfamily.app` with a strong password.
2. Link each login to its role. Either ask Claude, giving the three emails, or open [`supabase/add-logins.sql`](supabase/add-logins.sql), change the example emails, paste it into the SQL Editor and click **Run**.

### 3. Put the app online (Vercel)

1. Go to [vercel.com](https://vercel.com), sign in with GitHub, and click **Add New → Project**. Import `healthyfoodcrew/kids-apps`.
2. Set **Root Directory** to `rewards-chart`. The framework should show **Vite**. You don't need to add any environment variables.
3. Click **Deploy**. You'll get a web address like `https://kids-apps-xxxx.vercel.app`.

After this, every change pushed to GitHub updates the app automatically.

### 4. Set up the kids' iPad

1. Open the web address in **Safari** and sign in with the **iPad login**.
2. Tap **Share** → **Add to Home Screen**. The app gets its own icon and opens full screen.
3. Open it from the home screen.
4. Lock the iPad to the app with **Guided Access**:
   1. Go to **Settings → Accessibility → Guided Access**, turn it on and set a passcode.
   2. Open the app and triple-click the top (or Home) button, then tap **Start**.
   3. To leave Guided Access, triple-click again and enter the passcode.

### 5. Set up your phones

1. Open the same web address on your phone and sign in with **your own parent login**.
2. Add it to your home screen the same way.

You land on Family HQ.

### 6. Change the PIN

The starting parent PIN is **1234**. On your phone, go to **Settings → Parent PIN** and change it. The **Parents** button on the iPad asks for this PIN, and it opens parent mode for 15 minutes. After 5 wrong tries the PIN locks for 5 minutes.

---

## Security, in short

- Every device has to sign in. Without a login nobody can see or change anything.
- The kids' iPad can tick quests, log bonus jobs, and undo a bonus job that hasn't been approved yet. It can't approve jobs, change money or jobs, or change settings unless the PIN is entered.
- The number of stars each job is worth always comes from the job itself. A device can't award itself extra stars, and the weekly limit on bonus jobs is enforced by the database.
- The PIN is stored scrambled (hashed) in a table nothing can read directly. Only a parent login can change it.

---

## For developers

```bash
cd rewards-chart
cp .env.production .env.local   # same Supabase project for local testing
npm install
npm run dev                  # http://localhost:5173
npm test                     # game-maths tests
npm run build                # production build in dist/
```

- `src/lib/calc.ts` holds all the game maths: stars, money, tech time, speed bonus, streaks and the countdown. It's covered by `calc.test.ts`.
- `src/lib/store.tsx` handles sign-in, loading data, live sync and every save.
- `src/kid/` holds the iPad screens and `src/parent/` holds the parent screens.
- `supabase/schema.sql` holds the tables, triggers and security rules. It's safe to run again after changes.
