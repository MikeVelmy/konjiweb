# Konji — web

Anonymous, faceless matchmaking, as a deployable web app. Same product as the
native build in `../app`, same backend schema, hostable on any static host.

Built per `../Konjiplan.md`, styled per `../konji-visual-direction-v2.html`.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

With no `.env` present it runs on an **in-memory mock backend** stored in
`localStorage`. Every screen works end to end: seeded users answer your pairing
requests on a delay, reply to messages, and respond to reveal requests. Nothing
leaves the browser, so a deployed demo is safe to share before any real backend
exists.

```bash
npm test           # 21 tests: the P0 rules + a render smoke pass
npm run typecheck
npm run build      # → dist/
```

## Deploying

The build is a static SPA. Any of these work with no config beyond what is
already committed:

| Host | What to do |
|---|---|
| **Netlify** | Connect the repo, or `npx netlify deploy --prod --dir=dist`. `netlify.toml` is committed. |
| **Vercel** | Import the repo, or `npx vercel --prod`. `vercel.json` is committed. |
| **Cloudflare Pages** | Build command `npm run build`, output directory `dist`. Uses `public/_redirects`. |
| **GitHub Pages** | Works, but set `base` in `vite.config.ts` if served from a subpath. |

**The SPA fallback is not optional.** Konji uses client-side routing, so the
server has no file at `/requests` or `/chat/abc`. Without a rewrite rule those
URLs return 404 on refresh or when someone shares a link — the app would only
work if you always entered through `/`. That rule is what `public/_redirects`,
`netlify.toml`, and `vercel.json` all exist to provide; keep whichever matches
your host.

## Going live on Supabase

1. Create a project at supabase.com.
2. In **Authentication → Providers**, enable **Anonymous sign-ins**.
3. Run `supabase/migrations/0001_init.sql` in the SQL editor.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — locally in `.env`, and
   in your host's environment-variable settings for the deployed site.
5. In **Authentication → URL Configuration**, add your deployed origin so the
   browser client is allowed to talk to the project.

`VITE_`-prefixed variables are embedded in the JS bundle and publicly readable.
That is correct for the anon key, which is designed to be public — row-level
security is what protects the data. Never put a service role key in one.

The **Me** tab shows which backend is live, so it is never ambiguous.

## How the privacy guarantee is enforced

Identical to the native build, because it is the same database:

- **A chat cannot exist before mutual consent.** The `messages` policies require
  the pairing to be `accepted`, and only the receiver can move a request out of
  `pending`.
- **A face cannot be read before mutual reveal.** `profile_photos` and its
  storage objects are readable only when both `user_a_accepted` and
  `user_b_accepted` are true. Writes go through `respond_to_reveal()`, which
  records the caller's own consent and cannot write the other side's.

The mock backend mirrors both rules, so behaviour does not change between
backends. `src/rules.test.ts` asserts them.

## Relationship to `../app`

These are separate deployables, not a monorepo. Five files are byte-identical
and should be copied across whenever either side changes:

```
src/domain/avatar.ts       src/data/types.ts
src/domain/countries.ts    src/data/repository.ts
src/theme/tokens.ts
```

Three files differ on purpose:

- `src/data/storage.ts` — localStorage instead of AsyncStorage (web only).
- `src/data/supabase/client.ts` — `VITE_` env vars, and `detectSessionInUrl` is
  on, since a browser has a URL to parse an auth callback out of.
- `src/data/supabase/supabaseRepository.ts` — photo upload reads an object URL
  from a file input rather than a native file URI.

Everything under `src/components`, `src/screens`, and `src/styles` is a genuine
rewrite: React Native primitives and StyleSheet objects became DOM elements and
CSS.

## Responsive notes

Mobile is the base case with no media query — the app is phone-shaped and that
is the primary experience. Above 560px the same UI is centred in a column with a
visible edge rather than stretching a one-handed layout across a monitor.

Verified: no horizontal scroll at 360/390/768/1024/1440, all tap targets ≥44px,
body and input text ≥16px (smaller triggers iOS focus auto-zoom), nothing
depends on `:hover`, safe-area insets respected on the tab bar and composer, and
`prefers-reduced-motion` disables the reel spin.

## Known gaps

Same as the native build, plus one web-specific item:

- **No push notifications.** Requests and reveals surface in-app only. Web push
  is a separate piece of work.
- **The GPS toggle** stores the preference but the draw filters by country only.
- **Paid custom usernames** are stubbed in the UI.
- **No moderation console.** Reports land in a `reports` table with `open`
  status and nothing reads that queue yet.
- **Photos are not verified.** A reveal shows whatever was uploaded.
