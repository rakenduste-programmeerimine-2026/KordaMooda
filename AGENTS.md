<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# KordaMööda: tiimi tööreeglid

Need reeglid kehtivad nii inimestele kui ka AI-agentidele (Claude Code jt). Igaühel on oma sessioon ja agendid ei näe teineteise vestlusi. **Kõik, mida teised peavad teadma, kirjuta repo faili või issue kommentaari.**

## Tiim

| Inimene | GitHub | Roll |
|---|---|---|
| Mirko Aadva | `Aadva` | andmebaas (Supabase), testid ja kvaliteet |
| Maiko Nigul | `maiko-nigul` | backend (server actionid) ja turvalisus |
| Glen Paas | `GlenPaas32` | frontend ja UX |

Repo: `rakenduste-programmeerimine-2026/KordaMooda`. Tööjärjekord on kinnitatud issues **#22**.

## Enne töö alustamist

1. Loe issue koos kommentaaridega: `gh issue view <nr> --comments`.
2. Vaata issue alguses rida **"⏳ Ootab"**. Kui mõni seal nimetatud issue on veel lahti, **ära alusta**. Ütle seda kasutajale ja paku midagi muud.
3. Milestone (Samm 1–4) ei ole värav. Issue võib alata kohe, kui tema enda "Ootab" issued on suletud.
4. Võta tööle värske `main`:
   ```bash
   git checkout main && git pull
   git checkout -b <issue-nr>-<lühike-nimi>   # nt 5-supabase-klient
   ```

## Jagatud issued (mitu inimest)

- **Üks haru kõigile**: esimene teeb selle ja pushib kohe, teised teevad `git fetch && git checkout <haru>`.
- **Töö jagatakse failide järgi.** Kes mis faili teeb, kirjuta issue kommentaari. **Ära muuda faili, mis on teise inimese omaks märgitud.** Kui seal on midagi vaja muuta, kirjuta issue kommentaari.
- Enne iga pushi: `git pull --rebase`. Commiti väikeste tükkidena.
- Otsused (nimed, kuju, miks nii) kirjuta issue kommentaari, et ka teise inimese agent neid näeks.

## Commitid ja PR-id

- Commiti sõnum eesti keeles ja viitega issuele, nt `Refs #3`.
- PR-i kirjeldusse `Closes #<nr>`, et issue sulguks mergimisel ise. Sulgemine on teistele märk, et nad võivad jätkata.
- Ülevaataja on teine tiimiliige (jagatud issue puhul see, kes seda osa ei kirjutanud). **Oma PR-i ära mergi ilma heakskiiduta.**
- Enne PR-i peavad läbima: `npm test`, `npm run lint`, `npm run build`.
- Ära commiti `package-lock.json` muudatusi, kui sa pakette ei lisanud ega eemaldanud.
- **Saladused ei lähe kunagi gitti**: `.env.local`, Supabase'i `service_role` võti, paroolid. Uus muutuja lisatakse `.env.example`-sse ilma väärtuseta.

## Koodi kokkulepped

- **Frontend loeb ja muudab andmeid ainult `src/lib/actions.ts` kaudu** (leping, #7). Actionite signatuuri muutmine vajab Maiko ja Gleni kokkulepet.
- Iga action tagastab `Result<T>` (`src/lib/result.ts`). Kasutajale näidatavad vead on eesti keeles ja tulevad `HouseholdError`-ist.
- Valideerimine on `src/lib/household.ts`-is ja kasutatakse nii kliendis kui ka serveris. Ära kopeeri reegleid uude kohta.
- **Kodu id võetakse alati sessioonist, mitte kliendi saadetud andmetest.** Iga action kontrollib kasutaja ise üle.
- Andmebaasi muudatused tehakse **ainult migratsioonidena**: `npx supabase migration new <nimi>`, failid kaustas `supabase/migrations/`. Ära muuda skeemi Supabase'i veebiliideses käsitsi. Juba mergitud migratsiooni ei muudeta, vaid tehakse uus.
- Uus tabel → RLS sisse samas migratsioonis.
- UI tekstid on eesti keeles.
