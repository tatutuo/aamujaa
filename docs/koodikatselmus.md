# Koodikatselmus — Aamujää

Katselmoitu: alkuperäinen `backend/app.js` (1787 riviä) ja `aamujaa-react/`-frontend.
Päivämäärä: 8.8.2026

---

## Yhteenveto

Sovellus oli **toimiva ja ominaisuusrikas**, ja siinä oli aidosti hyviä ideoita —
erityisesti ennustemalli perusteluineen ja "tulikuumat"-laskenta ovat sellaisia,
joita ei useimmista harrastesovelluksista löydy.

Ongelmat eivät olleet logiikassa vaan **rakenteessa**. Kaikki asui yhdessä
tiedostossa, ulkoista rajapintaa kutsuttiin ilman välimuistia, ja kauden tunniste
oli kovakoodattu kymmeneen paikkaan. Nämä eivät haittaa kun sovellusta käyttää
yksi ihminen, mutta ne ovat juuri ne asiat jotka kaatuvat kun käyttäjiä tulee
lisää — tai kun kalenteri kääntyy lokakuuhun.

**Tuomio:** hyvä sovellus, joka oli kasvanut ulos rakenteestaan. Perusta oli
kunnossa, mutta se piti purkaa ja koota uudestaan ennen kuin päälle kannattaa
rakentaa mitään uutta.

---

## Kriittiset ongelmat (korjattu)

### 1. Kausi oli kovakoodattu

```js
const season = "20252026";   // toistui kymmenessä eri kohdassa
```

Sovellus olisi hajonnut hiljaisesti lokakuussa 2026: tilastot olisivat näyttäneet
tyhjää, eikä mikään olisi kertonut miksi. Ei virhettä, ei lokia — vain tyhjät listat.

**Korjaus:** `server/src/lib/season.js` laskee kauden päivämäärästä. Ennustemallit
lukevat kauden lisäksi suoraan sarjataulukon vastauksesta, koska kesällä
`/standings/now` palauttaa yhä päättyneen kauden.

### 2. Ei välimuistia — jokainen käyttäjä kuormitti NHL:n rajapintaa

Jokainen sivulataus meni suoraan läpi ulkoiseen rajapintaan. Otteluillan aikana
kymmenen samanaikaista käyttäjää tarkoitti satoja pyyntöjä minuutissa samaan dataan.
Se on hidasta ja hyvä tapa tulla estetyksi.

**Korjaus:** `server/src/lib/cache.js`. Muistivälimuisti reittikohtaisilla
elinajoilla (live 15 s, sarjataulukko 5 min, kokoonpanot 6 h) ja
*request coalescing* — sata samanaikaista pyyntöä johtaa yhteen ulospäin lähtevään
kutsuun. Jos ulkoinen rajapinta kaatuu, tarjoillaan vanhentunutta dataa
virhesivun sijaan.

### 3. Frontend teki kymmeniä pyyntöjä yhdellä sivulatauksella

```js
Promise.all(fetchedGames.map(g => Promise.all([
    fetch(`/api/nhl/boxscore/${g.id}`),
    fetch(`/api/nhl/game/${g.id}`)
])))
```

16 ottelun iltana **32 rinnakkaista pyyntöä** joka sivulatauksella — ja uudestaan
joka kerta kun jossain tehtiin maali. Mobiiliverkossa se on useita sekunteja
odotusta, ja iso osa haetusta datasta heitettiin heti pois.

**Korjaus:** uusi `/api/nhl/day`-reitti kokoaa kaiken palvelimella ja palauttaa
vain sen mitä käyttöliittymä näyttää. **Mitattu: 32 pyyntöä → 1.**

### 4. Päivämäärävirhe, joka osui juuri otteluaikaan

```js
const apiPvm = date.toISOString().split('T')[0];
```

`toISOString()` antaa **UTC-päivän**. Suomessa (UTC+3 kesällä) kello 21:00 jälkeen
sovellus pyysi jo seuraavan päivän otteluita — eli juuri silloin kun käyttäjät
avaavat sovelluksen katsoakseen illan pelejä.

**Korjaus:** `toLocaleDateString('en-CA')` antaa paikallisen päivän oikeassa
muodossa. Keskitetty tiedostoihin `src/utils/dates.js` ja `server/src/lib/dates.js`.

### 5. Suomalaispelaajat tunnistettiin nimilistalla

Koodissa oli **noin sata pelaajanimeä käsin kirjoitettuna**, ja niitä verrattiin
API:n nimiin aksentit poistaen ja "E Tolvanen" -tyyppisiä lyhenteitä arvaillen.

Tapa oli väärä kolmella tavalla: lista vanheni heti kun joku nousi liigaan,
nimivertailu antoi vääriä osumia, ja ylläpito oli käsityötä joka kausi.

**Korjaus:** kansallisuus haetaan NHL:n `bios`-rajapinnasta ja pelaajat
tunnistetaan **ID:llä**. ID ei koskaan muutu. Sata riviä kovakoodattua dataa
poistui, ja testiajossa löytyi pelaajia (mm. Kokko, Nyman) joita listalla ei ollut.

### 6. Tietoturva

| Ongelma | Korjaus |
|---------|---------|
| `/api/nhl/force-predictions` oli suojaamaton GET — kuka tahansa saattoi käynnistää raskaan laskennan rajattomasti | `POST` + `x-admin-token`; pois käytöstä jos tokenia ei ole |
| Palautelomake ilman rajoituksia — kuka tahansa saattoi lähettää loputtomasti viestejä omistajan Gmail-tilin kautta | Pituusrajat + 5 viestiä/tunti/IP |
| `req.params.abbrev` ja `?date=` liitettiin suoraan ulkoiseen URL-osoitteeseen | Kaikki syötteet validoidaan ennen käyttöä |
| Ei pyyntörajoitusta ollenkaan | 300 pyyntöä/min/IP + `helmet`-otsakkeet |
| Admin-salasana verrattiin selkokielisenä | Vieraskirja- ja admin-osuus poistettiin kokonaan — se ei kuulu Aamujäähän |

### 7. Ennusteita tehtiin, mutta niitä ei koskaan mitattu

Sovellus laski voittotodennäköisyyksiä joka päivä, mutta kukaan ei tarkistanut
osuivatko ne. Ilman mittaria mallia ei voi kehittää — eikä käyttäjä tiedä,
kannattaako lukuihin uskoa.

**Korjaus:** eilisen ennusteet tarkistetaan automaattisesti joka aamu.
Osumatarkkuus ja Brier-pisteet näytetään käyttöliittymässä, ja
`node scripts/backtest.js` ajaa takautuvan testin mitä tahansa aikaväliä vastaan.
Tulokset alla.

---

## Suorituskyky

| Mitattu | Ennen | Jälkeen |
|---------|-------|---------|
| Pyyntöjä etusivun latauksessa | ~32 | **1** |
| Joukkue-ennusteiden laskenta | yli 30 s (32 peräkkäistä hakua, 1 s uni välissä) | **1,1 s** |
| Otteluennusteet | haki kaikkien 32 joukkueen ohjelmat | **1,4 s** — vain otteluissa mukana olevat |
| Ikonit ja splash | 1,4 MB | **527 kB** |
| Live-päivitys | 30 s välein aina, myös taustalla ja kesällä | vain kun otteluita on käynnissä ja välilehti näkyvissä |

Vanha koodi valitsi joka kerta jommankumman ääripään: joko kaikki haut peräkkäin
sekunnin unien kanssa, tai kaikki kerralla `Promise.all`-kutsulla. Uusi
`mapWithConcurrency` on niiden väliltä (6 rinnakkain) — nopea ilman rate-limitiä.

---

## Muut korjatut asiat

**Modaalit ja Android-takaisinpainike.** Kuusi modaalia työnsi kukin oman
merkintänsä selaimen historiaan, eikä mikään siivonnut niitä. Modaalin päältä
avattu modaali vaati monta takaisin-painallusta ennen kuin mitään tapahtui.
Historiaa hallitaan nyt yhdessä paikassa.

**Pyyntöjen peruutus.** Yksikään haku ei käyttänyt `AbortController`ia. Nopeasti
päivää vaihtaessa vanha vastaus saattoi saapua uuden jälkeen ja ylikirjoittaa sen.
Kaikki haut peruutetaan nyt siivousfunktiossa.

**Virheiden käsittely.** Suuri osa hauista teki `.catch(() => {})` — virhe katosi
ja käyttäjä jäi tuijottamaan ikuista latausanimaatiota. Nyt virheet näytetään
ja mukana on "Yritä uudelleen" -painike.

**Kaksi totuutta samasta datasta.** Joukkuelista oli sekä backendissä että
`SearchModal.jsx`:ssä. Pelaajahaku meni suoraan NHL:n hakupalveluun selaimesta
ohi oman palvelimen — ilman välimuistia ja käyttäjän IP kolmannelle osapuolelle.

**Käytettävyys.** Alanavigaation painikkeilla ei ollut nimiä ruudunlukijalle.
Klikattavat joukkuemerkit olivat `div`-elementtejä, eivät nappeja. Sarjataulukossa
lyhenne näkyi kahteen kertaan (`CARCAR`). Kaikki korjattu.

**`alert()` modaalin päällä.** Fantasy-joukkueen rajat ilmoitettiin selaimen
`alert()`-ikkunalla, joka on Androidilla erityisen töksähtävä. Korvattu
sovelluksen sisäisellä ilmoituksella.

**Kuollutta koodia.** `/api/nhl/hot` laski tulikuumat palvelimella, mutta
frontend laski ne itse eikä kutsunut reittiä koskaan. Vieraskirja, avaruus- ja
dinosaurusreitit sekä `mockData.js` eivät liittyneet Aamujäähän.

---

## Mitä oli hyvää

Rehellisyyden nimissä — alkuperäisessä koodissa oli asioita, jotka säilytettiin
sellaisenaan tai lähes sellaisenaan:

- **Ennustemallin perustelut.** Jokainen otteluennuste kertoo *miksi*: kotietu,
  väsymys, muoto, maalivahtitilanne. Tämä on koko ominaisuuden paras puoli.
  Pelkkä prosenttiluku ilman perustetta ei kerro käyttäjälle mitään.
- **Laukaisuprosentin regressio kohti liigan keskiarvoa.** Tämä on tilastollisesti
  oikein tehty. Moni tekisi ennusteen pelaajan omalla laukaisuprosentilla, mikä
  johtaisi hölmöihin lukuihin kuumana käyvillä pelaajilla.
- **Pythagoraan odotusvoitot** joukkuevoiman mittarina — parempi ennustaja kuin
  pelkkä pistesaldo, jossa on paljon jatkoaikaonnea.
- **Ajastin ilman driftiä.** Aamupäivitys ajasti seuraavan ajon heti perään
  `setInterval`in sijaan. Tämä oli tehty oikein — kesäaikakin oli huomioitu.
- **Teksti-TV-tilastonäkymä.** Hauska idea, joka erottuu muista sovelluksista.

Kommenteista näkyi myös, että aiemmat bugit oli korjattu harkiten
(`🔧 FIX: turvallinen päivämäärä`, `🛑 TURVALUKKO`). Se on hyvä merkki.

---

## Ennustemalli: mitä muutettiin ja mitä se mitattavasti tuotti

Malli kirjoitettiin uudestaan. Vanhassa oli oikeita ideoita, mutta myös
rakenteellisia virheitä, joita ei voinut korjata säätämällä lukuja.

### Mitä oli pielessä

**Kertoimet kasautuivat.** "Viimeiset 10", "voittoputki" ja "kotimenestys"
kerrottiin peräkkäin, vaikka ne mittaavat suurelta osin samaa asiaa: onko
joukkue hyvä. Hyvä joukkue sai edun kolme kertaa peräkkäin.

**Ei kutistusta pieniin otoksiin.** Viiden ottelun 4,2 maalia per peli
kelpasi malliin sellaisenaan. Lokakuussa tämä tuotti villejä ennusteita.

**Maalipohjaisuus.** Malli rakentui tehtyihin maaleihin, jotka heittelevät
rajusti. Laukausmäärä vakiintuu paljon nopeammin.

**Monte Carlo -kohina.** 10 000 arvontaa toi noin puolen prosenttiyksikön
satunnaisvirheen, ja sama ottelu antoi eri luvut joka ajolla.

**Maalivahdin mittakaava väärä.** Torjuntaprosentin ero liigan keskiarvoon
kerrottiin vakiolla 8. Oikea mittakaava on kohdattujen laukausten määrä
(~29 per ottelu), joten maalivahdin vaikutus aliarvioitiin noin nelinkertaisesti.

**Jatkoaika ratkaistiin odotusmaalien suhteessa.** 3-on-3 ja voittolaukaukset
ovat paljon lähempänä kolikonheittoa kuin varsinainen peliaika.

### Mitä tilalle tuli

| Osa | Ratkaisu |
|-----|----------|
| Pienet otokset | Empiirinen Bayes -kutistus kohti liigan keskiarvoa |
| Perusta | Odotuslaukaukset, ei tehdyt maalit |
| Viimeistely | Maalintekoprosentti regressoidaan kohti keskiarvoa |
| Maalivahdit | Torjunta-% kutistetaan laukausmäärän mukaan, oikea mittakaava |
| Lopputulos | Analyyttinen tulosmatriisi, ei arvontaa — tarkka ja toistettava |
| Tasatilanteet | Kalibroitu korotus, joka vastaa NHL:n toteutunutta ~23 % jatkoaikaosuutta |
| Muoto | Vaikutus rajattu ±5 %:iin, koska kymmenen ottelun tulokset ovat pääosin kohinaa |
| Epävarmuus | Pelaajaennusteissa vaihteluväli, ei pelkkä piste-estimaatti |
| Lepopäivät | Kertoimet mitattu NHL:n datasta kolmelta kaudelta, ei arvattu |
| Kiekonhallinta | Corsi mukaan laukausvoimaan, painotettuna otoskoon mukaan |

Matematiikka on omassa moduulissaan (`src/predictions/math.js`) puhtaina
funktioina, ja sille on **28 testiä**. Testit eivät ole koristetta: ne
paljastivat kehityksen aikana kaksi aitoa virhettä — riippumattoman Poissonin
antaman liian pienen jatkoaikaosuuden sekä sen, että malli ennusti jatkoaikaa
jokaiseen otteluun.

### Mitattu tulos

Takautuva testaus **koko kaudelta 2025–26**, jossa jokaisen päivän ennuste
käyttää vain sitä päivää edeltävää dataa (ei tulevan tiedon vuotoa):

| Mittari | Malli | "Koti voittaa aina" | Kolikonheitto |
|---------|-------|---------------------|---------------|
| Otteluita | 1292 | 1292 | 1292 |
| Osumatarkkuus | **58,6 %** | 52,3 % | — |
| Brier-pisteet | **0,2397** | 0,2495 | 0,2500 |
| Logaritminen tappio | **0,6720** | 0,6922 | 0,6931 |

Luotettavuuskäyrä koko kaudelta — ennustettu vs. toteutunut kotivoitto-osuus:

| Ennustettu | n | Toteutui |
|-----------|---|----------|
| 35–45 % | 199 | 41,2 % |
| 45–55 % | 493 | 47,5 % |
| 55–65 % | 434 | 57,1 % |
| 65–100 % | 147 | 72,8 % |

Kalibrointi on hyvä: kun malli sanoo 60 %, kotijoukkue voittaa noin 57 %:ssa
tapauksista. Ennusteet ovat siis oikean suuruisia eivätkä vain oikeansuuntaisia.

**Tulkinta rehellisesti:** 6,3 prosenttiyksikön ero vertailukohtaan on 1292
ottelun otoksella selvästi merkitsevä (keskivirhe 1,4 pp). Se ei silti tarkoita
että ennusteilla rikastuisi — vedonvälittäjien kertoimet sisältävät saman tiedon
ja enemmänkin. Jääkiekko on suurten palloilulajien vaikeimmin ennustettava, ja
julkaistut NHL-mallit liikkuvat Brier-arvoissa 0,23–0,24.

**Varoitus lyhyistä jaksoista:** yksittäisiä kuukausia vertailemalla saa mitä
tahansa tuloksia. Kun kokeilin mitattujen lepokertoimien vaikutusta, tammikuu
parani (60,5 % → 62,9 %) ja marras–joulukuu heikkeni (56,3 % → 53,9 %) —
molemmat muutokset mahtuvat kohinaan, koska 200–450 ottelun otoksella
keskivirhe on 2–3 prosenttiyksikköä. Siksi kaikki mallipäätökset on tehty
koko kauden aineiston perusteella.

Aja itse: `npm --prefix server run backtest 2025-10-07 2026-04-16`

## Suositukset jatkoon

Tärkeysjärjestyksessä. Kausi alkaa lokakuussa, joten aikaa on.

### Ennen kauden alkua

1. **Julkaise Play Storeen.** Ohjeet: [play-store.md](play-store.md). Yleisin
   hylkäyssyy on puuttuva `assetlinks.json` — se on nyt dokumentoitu.
2. **Ota `.env` käyttöön palvelimella.** `ADMIN_TOKEN` on asetettava, muuten
   ennusteita ei voi ajaa käsin.
3. **Testaa kauden vaihtuminen.** Aja `npm run server` lokakuun alussa ja
   tarkista, että kausi vaihtuu oikein. Tämä on ainoa asia jota en pystynyt
   testaamaan aidosti, koska kausi ei ole vielä alkanut.
4. **Seuraa osumatarkkuutta.** Muutaman viikon jälkeen näet, osuuko malli.
   Alle 55 % on huono (kotijoukkue voittaa noin 55 % otteluista ilman mitään
   mallia), yli 60 % on hyvä.

### Kun sovellus on kaupassa

5. **Push-ilmoitukset suosikkien maaleista.** Tämä on ominaisuus, jonka takia
   sovellus asennetaan eikä vain käydä sivustolla. Vaatii Web Push -tuen
   palvelimelle.
6. **Jaettava ottelugrafiikka.** "Jaa tulos" -nappi, joka piirtää kuvan
   `canvas`-elementille. Ilmainen näkyvyys.
7. **URL-tila.** Nyt sovelluksen tilaa ei voi jakaa linkkinä eikä tiettyyn
   päivään voi siirtyä suoraan. `react-router` tai kevyt oma ratkaisu.

### Tekninen velka, joka ei kiirehdi

8. **Inline-tyylit CSS-luokiksi.** Komponenteissa on yhä paljon
   `style={{ ... }}`-lohkoja. Ne eivät noudata teemamuuttujia, joten vaalea teema
   on osittain rikki. Siirsin uudet komponentit CSS-luokkiin — loput voi tehdä
   komponentti kerrallaan.
9. **`PredictionModal.jsx` ja `GameModal.jsx` ovat yhä 400–500 riviä.** Ne
   kannattaa pilkkoa, mutta vasta kun niihin seuraavan kerran koskee.
10. **Testit.** Ennustemalleille kannattaisi kirjoittaa muutama testi:
    ne ovat puhtaita funktioita, joten testaus on helppoa. Aloita
    `simulate()`- ja `trueTalent()`-funktioista.
11. **TypeScript.** NHL:n rajapinnan vastaukset ovat syvästi sisäkkäisiä
    (`p.name?.default`, `t.teamAbbrev.default`), ja koodi on täynnä
    varmuuden vuoksi kirjoitettuja `??`-oletuksia. Tyypit poistaisivat
    kokonaisen bugiluokan. Iso urakka — tee vasta jos sovellus jää elämään.

### Mitä *en* suosittele

- **Älä palauta Liigaa** ennen kuin maksullinen tai vakaa rajapinta löytyy.
  Olit oikeassa: epävirallisesta rajapinnasta saatu data heitteli niin paljon,
  ettei siitä tullut hyvää. Puolivalmis ominaisuus syö uskottavuutta koko
  sovellukselta enemmän kuin puuttuva ominaisuus.
- **Älä lisää mainoksia.** "Ei mainoksia, ei seurantaa" on sovelluksen paras
  myyntivaltti kaupassa, jossa kaikki kilpailijat ovat täynnä mainoksia.
