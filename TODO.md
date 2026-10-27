# TODO

## Ennusteet (koodi valmiina, tuotannossa `PREDICTIONS_ENABLED=false`)

- [ ] Otteluennusteet etusivulle, kun joukkueilla on noin 15–20 ottelua (marraskuun puoliväli).
      Takautuva testi oli heikko kauden alussa ja hyvä loppukaudella.
- [ ] Kausiennuste joulun jälkeen. Parannukset: edellisen kauden lähtötaso, MoneyPuckin
      ottelukohtainen xG (tai oma xG-malli), tuoreimpien otteluiden painotus, loukkaantumiset,
      sovitetut parametrit, vertailu vedonlyönnin kertoimiin, koko kauden simulointi.

## Hakukoneet

- [ ] #-osoitteet tavallisiksi osoitteiksi (`/hockey/tilastot/pisteporssi`) ja oma otsikko
      jokaiselle näkymälle, jotta Google indeksoi näkymät erikseen. Vanhat #-linkit ja
      manifestin pikakuvakkeet ohjataan uusiin. Sen jälkeen näkymät myös `sitemap.xml`:ään.

## GM-kalenteri (Taulukot → Otteluohjelma)

Tehty 16.10.2026 (`src/views/schedule/GmCalendar.jsx`, jaksot `src/utils/hockeyGm.js`).

- [ ] Play Off -jakso `GM_PERIODS`-listaan, kun NHL julkaisee pudotuspelien päivät
- [ ] Jaksojen päivämäärät uusiksi ensi kaudelle

## xG-mallin parannus (MoneyPuckin tasolle)

Nykyinen malli (`server/src/lib/xg.js`) on lähellä MoneyPuckia, mutta erottelee
ottelut hieman heikommin. Vertailu 16.10.2026, viime kauden testiottelut
(214 joukkue-ottelua):

| | Oma | MoneyPuck |
|---|---|---|
| Korrelaatio MoneyPuckiin | 0,88 | – |
| Korrelaatio maaleihin | 0,37 | 0,43 |
| RMSE maaleihin | 1,49 | 1,48 |

**Lisättävät piirteet** (kaikki saa samasta NHL:n play-by-play-datasta, ei lisäkuluja):

- [ ] Edellisen tapahtuman sijainti ja etäisyys laukaisupaikasta
- [ ] Aika edellisestä tapahtumasta ja siitä laskettu kiekon nopeus (etäisyys / aika)
- [ ] Edellisen tapahtuman tyyppi (aloitus, taklaus, riisto, menetys, laukaus...)
- [ ] Paluukiekon kulman muutos (poikittainen syöttö maalin edessä on vaarallisin)
- [ ] Laukojan kätisyys suhteessa laitaan (off-wing)
- [ ] Ottelutilanne (johto/tappio) ja kotietu, jos testi osoittaa niistä hyötyä

**Työtapa:**

1. Lisää piirteet `shotFeatures`-funktioon (`server/src/lib/xg.js`) ja nimet `FEATURE_NAMES`-listaan.
2. Sovita: `XG_CACHE=<polku> node scripts/fit-xg.js 600 20252026`
   (välimuisti säästää uusintakierroksilla NHL:n rajapintaa; ilman sitä haku kestää muutaman minuutin).
3. Vertaa testiotteluilla MoneyPuckiin samalla tavalla kuin 16.10.
   (joukkue-ottelutaso, MoneyPuckin `careers/gameByGame/regular/teams/{TEAM}.csv`, `situation=all`).
4. Ota käyttöön vain, jos testiotoksen log loss ja korrelaatio maaleihin paranevat.
5. Päivitä kertoimet ja tarkkuusluvut `xg.js`:n `MODEL`-kommenttiin.

**Lisäksi:** sovita malli uudelleen kuluvan kauden datalla, kun otteluita on kertynyt tarpeeksi (noin joulu).
