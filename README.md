# KordaMööda

Rakendus koos elavatele paaridele ja korterikaaslastele, kes jagavad kodutöid. Avamisel on kohe näha, kelle kord iga töö on.

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

### Sisselogimine (kontosid pole)

Kodu loomisel või sellega liitumisel saab seade **anonüümse Supabase'i kasutaja**. Tabel `household_users` seob selle kasutaja koduga. Lihtsalt rakenduse avamine kedagi ei loo, seega robotid ja külastajad ei täida `auth.users` tabelit.

- **Kui brauser kustutab küpsised** (privaatne aken, "Kustuta sirvimisandmed" või teine brauser), kaob seadme sessioon ja rakendus näitab StartScreen'i. Kodu ja tööd jäävad alles. Liitu uuesti kutsekoodiga, mille saad kaaslase telefonist (Menüü → Kutsu kaaslane).
- **Kui kõik seadmed kaotavad sessiooni**, ei pääse koju enam keegi ligi. See on kontodeta lahenduse hind.
- **"Lahku kodust"** eemaldab ainult selle seadme seose. Kodu jääb teistele alles.

Integratsioonitestid ühise projekti vastu (loovad anonüümseid kasutajaid): `npm run test:integration`.

Rakenduses on ainult anon-võti, seega RLS kehtib alati. `service_role` võtit rakendus ei kasuta ja see ei tohi `.env.local`-isse sattuda.

### Muud käsud

```bash
npm test        # järjekorra loogika testid
npm run lint
npm run build
```

## Teadaolev piirang

Rakendus kasutab veel brauseri `localStorage`-it. Andmebaasi skeem on olemas, aga frontend pole sellega veel ühendatud (#5, #11).

## Ülesehitus

- `src/lib/household.ts`: järjekorra loogika puhaste funktsioonidena
- `src/lib/useHousehold.ts`: andmete lugemine ja salvestamine `localStorage`-is
- `src/components/`: vaated
- `test/`: loogika testid
- `supabase/`: Supabase CLI seadistus ja andmebaasi migratsioonid
