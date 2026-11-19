# KordaMööda

Rakendus koos elavatele paaridele ja korterikaaslastele, kes jagavad kodutöid. Avamisel on kohe näha, kelle kord iga töö on.

**Avalik aadress:** <https://kordamooda.vercel.app>

## Probleem

- **Kasutaja:** inimene, kes elab koos elukaaslasega ja jagab temaga kodutöid. Ta on meie päris kontakt (nimi ja kontakt on õpetajal eraldi).
- **Probleem:** kodutööde jagamist on raske meeles pidada ja üle vaadata.
- **Praegune lahendus:** kodutööd ja järjekord on paberil. Seda pole telefonis näha ja seda peab käsitsi uuendama.

## Ulatus

Üks põhiline kasutajateekond: loo kodu → lisa tööd → näe, kelle kord on → märgi tehtuks.
Kontosid pole: seade seotakse koduga anonüümse sessiooniga ja kaaslane liitub kutsekoodiga.
Välja jäävad: kaaslase lisamine hiljem (#47), töö täpsustus ja kalender (#48).

## Põhifunktsioonid

1. Kodutööde lisamine (prügi, nõud, koristamine, pesu või oma töö).
2. Automaatne järjekord, mis näitab iga töö juures, kelle kord see on.
3. Töö märkimine tehtuks, mille järel järjekord liigub edasi.

## Edukriteerium

Kasutaja ja tema elukaaslane lisavad oma kodutööd ning näevad rakenduse avamisel 10 sekundi jooksul, kelle kord iga töö on.

## Käivitamine

Vajalik on Node.js 22.18 või uuem.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Rakendus avaneb aadressil <http://localhost:3000>.

### Supabase

Andmebaas on Supabase'is. Skeem on migratsioonidena kaustas `supabase/migrations/`. Supabase CLI tuleb `npm install`-iga kaasa (`npx supabase ...`).

Vali üks kahest:

- **Ühine dev-projekt** (lihtsam): `.env.example`-is on projekti URL juba olemas. Võti `NEXT_PUBLIC_SUPABASE_ANON_KEY` on Supabase'i lehel Project Settings → API Keys (publishable või anon võti). Kirjuta see faili `.env.local`.
- **Lokaalne Supabase** (vajab Dockerit): `npx supabase start` käivitab andmebaasi ja rakendab migratsioonid. Käsk näitab lõpus URL-i ja anon võtit, need lähevad faili `.env.local`. `npx supabase db reset` loob skeemi nullist uuesti.

Uus skeemimuudatus: `npx supabase migration new <nimi>`, kirjuta SQL loodud faili ja rakenda see (`npx supabase db reset` lokaalselt, `npx supabase db push` ühisele projektile).

`.env.local` on `.gitignore`-is. Ära pane võtmeid reposse.

Pärast iga skeemimuudatust genereeri TypeScripti tüübid uuesti:

```bash
npm run db:types          # lokaalsest Supabase'ist (vajab Dockerit)
npm run db:types:remote   # ühisest projektist (vajab `npx supabase login`)
```

Koodis kasuta Supabase'i ainult nende failide kaudu:

- `src/lib/supabase/server.ts`: server actionites ja serverikomponentides. Loo igas päringus uus klient.
- `src/lib/supabase/client.ts`: brauseris, ainult realtime'i jaoks (#13).
- `src/proxy.ts`: värskendab igal päringul sessiooni. Ilma `.env.local`-ita jäetakse see vahele ja rakendus töötab mockiga.

### Reaalajas uuendused

Kui üks telefon muudab kodu, näeb teine seda ilma värskendamata (`src/lib/useHouseholdRealtime.ts`). Telefon jälgib Supabase Realtime'iga ainult oma kodu rida. Iga töö või liikme muutus uuendab väljal `households.changed_at`, ja selle peale laeb telefon kodu serverist uuesti. Sündmuses endas tööde andmeid pole, seega kehtib alati RLS. Põhjused on kirjas migratsioonis `20261117220000_realtime.sql`.

### Sisselogimine (kontosid pole)

Kodu loomisel või sellega liitumisel saab seade **anonüümse Supabase'i kasutaja**. Tabel `household_users` seob selle kasutaja koduga. Lihtsalt rakenduse avamine kedagi ei loo, seega robotid ja külastajad ei täida `auth.users` tabelit.

- **Kui brauser kustutab küpsised** (privaatne aken, "Kustuta sirvimisandmed" või teine brauser), kaob seadme sessioon ja rakendus näitab StartScreen'i. Kodu ja tööd jäävad alles. Liitu uuesti kutsekoodiga, mille saad kaaslase telefonist (Menüü → Kutsu kaaslane).
- **Kui kõik seadmed kaotavad sessiooni**, pääseb koju ainult kutsekoodiga. Kui ka kood on kadunud, ei pääse koju enam keegi. See on kontodeta lahenduse hind.
- **"Lahku kodust"** eemaldab ainult selle seadme seose. Kodu jääb teistele alles.
- **Kui kodust lahkub viimane seade**, jääb kodu 30 päevaks alles ja sinna saab kutsekoodiga tagasi liituda. Pärast seda kustutatakse kodu koos töödega (#19).

Sisselogimise testid on `test/db/session.test.ts` (käivitub koos teistega: `npm run test:db:api`, vt "Andmebaasi testid").

Rakenduses on ainult anon-võti, seega RLS kehtib alati. `service_role` võtit rakendus ei kasuta ja see ei tohi `.env.local`-isse sattuda.

### Muud käsud

```bash
npm test        # järjekorra loogika testid
npm run lint
npm run build
```

### Andmebaasi testid

Testid jooksevad lokaalse Supabase'i vastu, seega on vaja Dockerit ja `npx supabase start`-i.

```bash
npm run test:db       # pgTAP: RLS ja mark_done/undo_done (supabase/tests/database/)
npm run test:db:api   # Node päris API kaudu: samaaegsed vajutused ja sisselogimine (test/db/)
```

`test:db` käivitab iga faili transaktsioonis, mis lõpus tagasi keeratakse. Andmebaasi ei jää midagi maha.

`test:db:api` vajab `.env.local`-is lokaalse Supabase'i URL-i ja anon-võtit ning `SUPABASE_DB_URL`-i (vt `.env.example`). Kui need puuduvad, jäetakse test vahele. Testid loovad ise testkodud ja anonüümsed kasutajad ning kustutavad need lõpus.

## Avaldamine (Vercel)

Rakendus on Vercelis projektina `kordamooda` (Maiko konto). Production-aadress on <https://kordamooda.vercel.app> ja regioon on Stockholm.

- **Keskkonnamuutujad** on Vercelis (Production ja Preview): `NEXT_PUBLIC_SUPABASE_URL` ja `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Uus muutuja lisatakse käsuga `npx vercel env add <NIMI> production` (ja `preview`).
- **Deploy:** Vercel pole veel GitHubi repoga ühendatud, sest organisatsiooni repo ühendamiseks on vaja organisatsiooni omaniku luba. Seni teeb deploy Maiko käsitsi `main`-ist: `npx vercel deploy --prod`. Pärast ühendamist läheb iga `main`-i push automaatselt üles ja iga PR saab oma preview-lingi.
- `.vercelignore` jätab `.env*` failid välja, nii et kohalikud saladused Vercelisse ei satu.
- Supabase'i Authis pole lubatud URL-e vaja seadistada, sest anonüümne sisselogimine ei kasuta e-posti ega OAuthi suunamisi. Kui need kunagi lisanduvad, tuleb Verceli domeen lisada Supabase'is: Authentication → URL Configuration.

## Töövoog

1. Võta värske `main` ja tee issue jaoks haru:
   ```bash
   git checkout main && git pull
   git checkout -b 16-ci   # <issue nr>-<lühike nimi>
   ```
2. Commiti väikeste tükkidena, sõnum eesti keeles ja viitega issuele (`Refs #16`). Enne pushi käivita `npm test`, `npm run lint` ja `npm run build`.
3. Ava PR `main`-i vastu. Kirjelduses `Closes #<nr>`, siis sulgub issue mergimisel ise.
4. **CI** (`.github/workflows/ci.yml`) käivitub igal PR-il ja `main`-i pushil:
   - *Lint, testid ja build*: `npm ci`, `npm run lint`, `npm test`, `npm run build`
   - *Andmebaasi testid*: käivitab Dockeris lokaalse Supabase'i kõigi migratsioonidega, siis `npm run test:db` (pgTAP) ja `npm run test:db:api`
5. **Ülevaatus**: teine tiimiliige vaatab PR-i üle ja kiidab heaks.
6. **Merge**: `main` on kaitstud. PR-i saab mergida alles siis, kui mõlemad CI tööd on rohelised ja üks tiimiliige on heaks kiitnud. Otse `main`-i pushida ei saa.

Täpsemad tiimi reeglid on failis [AGENTS.md](AGENTS.md).

## Teadaolev piirang

Kontosid pole: kui brauser kustutab küpsised, tuleb kutsekoodiga uuesti liituda (vt "Sisselogimine").

Ilma `.env.local`-ita töötavad server actionid mälus hoitava mockiga (`src/lib/mock-store.ts`). Andmed kaovad siis serveri taaskäivitamisel. Supabase'iga töötab kõik, kui `.env.local` on täidetud.

## Ülesehitus

- `src/lib/household.ts`: järjekorra loogika puhaste funktsioonidena
- `src/lib/actions.ts`: server actionid, ainus koht, kust frontend andmeid loeb ja muudab (leping, #7)
- `src/lib/mock-store.ts`: mälus hoitav andmebaas, kui Supabase pole seadistatud
- `src/lib/supabase/`: Supabase'i kliendid, sessioon (`session.ts`), kodud (`households.ts`) ja tööd (`chores.ts`)
- `src/components/`: vaated
- `test/`: loogika testid, `test/db/`: andmebaasi testid üle API
- `supabase/`: Supabase CLI seadistus, migratsioonid ja pgTAP testid (`supabase/tests/`)

## Projekti seis (Projekt 1)

Kursuse nõuded on failis [SPEC.md](SPEC.md). Kasutajatesti tulemused on failis [FEEDBACK.md](FEEDBACK.md).

### Tehtud

- [x] Kolm põhifunktsiooni: töö lisamine, automaatne järjekord, tehtuks märkimine (koos tagasivõtmisega)
- [x] Läbiv tee: kasutajaliides → server actionid (`src/lib/actions.ts`) → Supabase
- [x] Edukriteerium: Android-telefonis avakuva ikoonist „kelle kord“ nägemiseni alla 5 s (nõue 10 s), vt #21
- [x] Sisendite valideerimine kliendis ja serveris (`src/lib/household.ts`), RLS igal tabelil, turvaülevaatus (#19)
- [x] Saladused gitist väljas, `.env.example` ilma võtmeteta
- [x] Testid ja CI igal PR-il (vt „Testid ja tulemused“)
- [x] Avaldatud aadressil <https://kordamooda.vercel.app>
- [x] Kasutajatest päris kontaktiga, tagasiside salvestatud ja kokku võetud ([FEEDBACK.md](FEEDBACK.md))
- [x] Parandused tagasiside põhjal: avakuva vihje ei sega enam tööde lisamist, nupp „Valmis“ on nüüd „Tagasi“ (#49)

### Tegemata

- [ ] Kaaslase lisamine olemasolevasse koju: kontakti jaoks kõige olulisem puudus (#47)
- [ ] Töö täpsustus ja kalender: uued funktsioonid, jäävad mahust välja (#48)
- [ ] Testimine iPhone'is ja Safaris (avakuva küpsised, 7 päeva piirang) (#21)
- [ ] Kontakt proovis ainult arvutis. Telefonis ja parandatud versiooni pole kontaktiga veel uuesti proovitud.
- [ ] Vercel pole GitHubiga ühendatud. Deploy tehakse käsitsi.

### Testid ja tulemused

| Mis | Käsk | Tulemus |
|---|---|---|
| Järjekorra loogika, mock, turvapäised | `npm test` | 30/30 läbib |
| RLS, „Tehtud“/tagasivõtmine, liitumine, pehme kustutamine (pgTAP) | `npm run test:db` | läbib CI-s |
| Samaaegsed vajutused, sessioon, realtime päris API kaudu | `npm run test:db:api` | läbib CI-s |
| Lint ja build | `npm run lint`, `npm run build` | läbib CI-s |
| Käsitsi telefonis (Android + arvuti, production) | vt #21 | kodu loomine, liitumine, realtime, avakuva: ✅ |

### Kes mida tegi

Rollid ja tööjärjekord on #22-s. Iga töö on tehtud issue ja PR-iga, mille vaatas üle teine tiimiliige.

| Inimene | Roll | Peamised tööd |
|---|---|---|
| Mirko Aadva (`Aadva`) | Andmebaas ja kvaliteet | Supabase'i seadistus ja skeem, RLS (#3), aatomiline „Tehtud“ (#4), andmebaasi testid (#17), CI (#16) |
| Maiko Nigul (`maiko-nigul`) | Backend ja turvalisus | API leping (#7), Supabase'i klient (#5), anonüümne sisselogimine (#6), server actionid (#8–#10), Vercel (#18), realtime andmebaas (#13), turvaülevaatus (#19) |
| Glen Paas (`GlenPaas32`) | Frontend ja UX | Kasutajaliides, server actionite kasutamine (#11), liitumisvaade (#12), olekud (#14), realtime vaates (#13), PWA (#20), vanade andmete üleviimine (#15) |
