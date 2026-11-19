# Projekt 1: kasutajatest ja tagasiside

**Rakendus:** KordaMööda
**Kontakt:** koos elukaaslasega elav inimene, kes jagab kodutöid (nimi ja kontakt on õpetajal eraldi)
**Kuidas testiti:** kontakt proovis rakendust **arvutis**, mitte telefonis
**Salvestus:** video on olemas. Piiratud ligipääsuga link on jagatud ainult õpetajaga, mitte selles repos.

## Algne probleem ja edukriteerium

- **Probleem:** elukaaslasega on keeruline kodutöid jagada. Praegu kasutatakse selleks paberit.
- **Edukriteerium:** kasutaja ja tema elukaaslane lisavad oma kodutööd ning näevad rakenduse avamisel 10 sekundi jooksul, kelle kord iga töö on.

## Kontakti vastused

| Küsimus | Vastus |
|---|---|
| Mis probleemi lootsid rakendusega lahendada? | Lihtsam tööde jagamine elukaaslasega, ilma paberita. |
| Kas said kokkulepitud ülesande tehtud? Kus vajasid abi? | Eraldi ei vastatud. Vastuste järgi tekitas alguses segadust tööde lisamine (vt allpool). |
| Kas see lahendab probleemi täielikult, osaliselt või veel mitte? | **Osaliselt.** Töid ei saa täpsustada, näiteks toidu tellimisel võiks saada lisada täpsustuse. |
| Kas sa tegelikult kasutaksid seda? | **Jah**, sest see töötab nii telefonis kui ka arvutis ja on palju mugavam kui paber. |
| Mis oli kõige kasulikum, segasem või mis puudus? | Alguses tekitas segadust tööde lisamine: ekraanile tuli „Pane KordaMööda avakuvale“ ja kontakt arvas, et tööd lisatakse sealt. Režiimis „Eemalda töid“ on lisaks „Valmis“ nupp, mis tundus ebavajalik ja segane. |
| Kas tasub edasi arendada? Mida muuta esimesena? | **Jah.** Soovis kalendrit, kuhu saab panna kuupäevaga tegevusi ja märkida, kes need tegema peab. Hiljem ei saa kodusse kaaslasi juurde lisada, see tuleb teha kohe alguses. |
| Kui hästi vastas tulemus algsele kokkuleppele? | Rakendus teeb ära kokkulepitud asjad, aga proovides selgus, et lisafunktsioone oleks vaja. |

## Mida kontakt kinnitas

- Põhiprobleem on lahendatud: tööd ja järjekord on digitaalselt nähtavad ja see on mugavam kui paber.
- Kontakt kasutaks rakendust ja peab seda edasiarendamist väärt.
- Kokkulepitud põhifunktsioonid töötavad.

## Mis ei töötanud või puudus

1. **Avakuva vihje segab esimest kasutust.** Vihje (`InstallHint`) tuleb ette enne, kui kasutaja on aru saanud, kuidas tööd lisada, ja jätab mulje, et seal on töö lisamise koht.
2. **„Eemalda töid“ režiimi „Valmis“ nupp** (`Home.tsx`, „Valikud“ ↔ „Valmis“) on segane.
3. **Kaaslasi ei saa hiljem lisada.** Liikmed määratakse ainult kodu loomisel (`createHousehold`). Liikme lisamiseks pole actionit. Kutsekood seob ainult uue seadme olemasoleva liikmega.
4. **Töid ei saa täpsustada.** Tööl on ainult nimi, kirjelduse või märkme välja pole.
5. **Kalender ja kuupäevad puuduvad.** See on uus suurem funktsioon ja jääb projekti mahust välja (max 3 põhifunktsiooni).

## Mida muutsime

Punktid 1 ja 2 (`src/components/Home.tsx`):

- **Avakuva vihje** tuleb nüüd ette alles siis, kui mõni töö on vähemalt korra tehtuks märgitud. Esimest tööd lisades ja kohe pärast seda ei ole vihjet enam ees ning „Lisa töö“ on ainus asi, mida teha.
- Eemaldamisrežiimi päisenupp **„Valmis“ on nüüd „Tagasi“**. „Valmis“ meenutas töö tehtuks märkimist, aga nupp tegelikult ainult viib tagasi tavavaatesse.

Kontakt ei ole parandusi veel uuesti proovinud. _Täita, kui proovib: kas läks paremaks._

## Mis jäi pooleli

| Mis | Järeltöö | Miks jäi |
|---|---|---|
| Kaaslase lisamine olemasolevasse koju (punkt 3) | #47 | Vajab migratsiooni, uut actionit (lepingu muutus), kasutajaliidest ja teste. Projekti 1 ajasse ei mahtunud. Kontakti jaoks kõige olulisem järgmine samm. |
| Töö täpsustus/märkus (punkt 4) | #48 | Uus põhifunktsioon, jääb mahust (max 3 põhifunktsiooni) välja. |
| Kalender kuupäevadega (punkt 5) | #48 | Suur uus funktsioon, jääb mahust välja. |
| Testimine telefonis ja iPhone'is | #21 | Kontakt proovis ainult arvutis. |

## Testimise piirangud

- Kontakt testis ainult arvutis. Telefonis, iPhone'i avakuval ja reaalajas kahe seadmega jäi kontaktiga testimata (vt #21).
- Küsimusele „Kas said ülesande tehtud?“ eraldi vastust ei ole.
