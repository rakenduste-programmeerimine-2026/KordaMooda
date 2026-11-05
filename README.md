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
npm run dev
```

Rakendus avaneb aadressil <http://localhost:3000>.

Muud käsud:

```bash
npm test        # järjekorra loogika testid
npm run lint
npm run build
```

## Teadaolev piirang

See on ainult frontend. Andmed on selle brauseri `localStorage`-is, seega kahes eri telefonis on kaks eraldi nimekirja. Kaks inimest saavad praegu sama nimekirja kasutada ainult ühes seadmes.

## Ülesehitus

- `src/lib/household.ts`: järjekorra loogika puhaste funktsioonidena
- `src/lib/useHousehold.ts`: andmete lugemine ja salvestamine `localStorage`-is
- `src/components/`: vaated
- `test/`: loogika testid
