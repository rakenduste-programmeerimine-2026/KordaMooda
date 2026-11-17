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

### Muud käsud

```bash
npm test        # järjekorra loogika testid
npm run lint
npm run build
```

## Teadaolev piirang

Frontend kasutab server actioneid (`src/lib/actions.ts`), aga need töötavad veel mock-andmetega dev-serveri mälus. Andmed kaovad serveri taaskäivitamisel. Supabase'iga ühendatakse need #8, #9 ja #10 käigus.

## Ülesehitus

- `src/lib/household.ts`: järjekorra loogika puhaste funktsioonidena
- `src/lib/actions.ts`: server actionid, ainus koht, kust frontend andmeid loeb ja muudab (leping, #7)
- `src/lib/mock-store.ts`: mälus hoitav ajutine andmebaas, kuni Supabase on ühendatud
- `src/components/`: vaated
- `test/`: loogika testid
- `supabase/`: Supabase CLI seadistus ja andmebaasi migratsioonid
