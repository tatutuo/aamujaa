# puckoodi 🏒

🔴 https://d4nyyy.fi/hockey/

puckoodi on mainokseton NHL-tilastosovellus: ottelut, kierroksen data,
odotetut maalit, kentälliset, kunto ja historia yhdessä paikassa. Nimi on
finglishiä: *puck* + *koodi*, eli kiekkokoodi, ja kaikille tuttu PUK-koodi.
Tehty puhtaasta intohimosta jääkiekkoon ja ohjelmointiin. Seuraaja
Aamujää-sovellukselle, joka toimi samassa osoitteessa.

## ✨ Ominaisuudet

**Ottelut**
- **Live-tulokset**: ottelut päivittyvät niin kauan kuin niitä on käynnissä
- **Kierroksen data**: koko ottelupäivä kaavioina; laukaukset ja odotetut maalit vs. maalit, maalit erittäin, ottelut vierekkäin, kärjet ja maalivirta
- **Ottelukortti**: tapahtumat, pelaajat, kentälliset, joukkuetilastot, laukauskartta, aloitukset ja poissaolot
- **Odotetut maalit (xG)**: oma malli, joka arvioi jokaisen laukauksen maalitodennäköisyyden (ks. alla)

**Tilastot**
- **Pistepörssi, maalivahdit ja joukkueet**: koko liiga lajiteltavina taulukkoina; juuri päättyneet ottelut lisätään pöytäkirjoista NHL:n noin kahden tunnin tilastoviiveen ajaksi
- **Pelaajakortti lähes reaaliajassa**: kausi, ura, viimeiset ottelut ja muotokäyrä, myös käynnissä oleva ottelu
- **Kunto**: viimeisen 7, 14 tai 30 päivän taso verrattuna kauteen, pelaajille ja joukkueille
- **Edistyneet tilastot ja luistelunopeudet**: Corsi, xG (MoneyPuck), NHL EDGE
- **Kentälliset**: ketjut ja parit laskettuna vaihtotiedoista; keskushyökkääjä aloituksista, laidat pelipaikasta ja laukaisukädestä

**Taulukot**
- Sarjataulukko (konferenssit, divisioonat, villi kortti selityksineen), otteluohjelma, pudotuspelit, loukkaantumiset, draft ja historia

**Omat**
- **Suosikit**: pelaajat ja joukkueet nostetaan esiin kaikkialla
- **Fantasy-joukkue**: 1 MV + 2 P + 3 H; pistelasku noudattaa Hockey GM:n (hockeygm.fi) taulukkoa, säännöt tiedostossa [`src/utils/fantasy.js`](src/utils/fantasy.js) ja testit tiedostossa [`test/fantasy.test.js`](test/fantasy.test.js)
- **Asennettava sovellus**: kotivalikkoon yhdellä napautuksella (Android, tietokone) tai ohjeilla (iPhone); toimii myös ilman verkkoa viimeksi ladatuilla tiedoilla

## 🛠️ Tekniikka

| Osa | Toteutus |
|-----|----------|
| Frontend | React 19, Vite, käsin kirjoitettu CSS, kaaviot omana SVG:nä |
| Backend | Node.js 20+, Express, ESM-moduulit |
| Tietokanta | SQLite (better-sqlite3), vain ennusteiden tallennukseen |
| Data | NHL:n julkiset rajapinnat (`api-web.nhle.com`, `api.nhle.com`), MoneyPuck, ESPN (loukkaantumiset) |

Backend toimii välityspalvelimena: se kiertää CORS-rajoitukset, välimuistittaa
vastaukset kaikille käyttäjille yhteisesti ja kokoaa monta ulkoista kutsua
yhdeksi vastaukseksi. NHL:lle lähtee sama määrä pyyntöjä käyttäjämäärästä
riippumatta.

## 🚀 Käynnistys

```bash
npm run install:all
```

Luo palvelimen asetukset:

```bash
cp server/.env.example server/.env
```

Käynnistä backend (portti 3000):

```bash
npm run server
```

Käynnistä frontend toisessa terminaalissa (portti 5173):

```bash
npm run dev
```

Vite ohjaa `/api`-pyynnöt backendille automaattisesti.

### Tuotantobuild

```bash
npm run build
npm run server:start
```

Backend tarjoilee `dist/`-kansion automaattisesti, joten tuotannossa riittää
yksi prosessi.

### Ikonit

Logo on tiedostossa `public/icon.svg`. Kaikki PNG-ikonit (myös Androidin
maskable-versio) luodaan siitä:

```bash
npm run icons
```

## 📁 Rakenne

```
├── index.html
├── public/               # logo ja ikonit, manifest, service worker
├── scripts/
│   └── generate-icons.js # PNG-ikonit logon SVG:stä
├── src/
│   ├── components/       # kortit, modaalit, kierroksen data (round/), ui-osat
│   ├── views/            # tilasto-, taulukko- ja historianäkymät
│   ├── hooks/ state/     # haku, asetukset, suosikit
│   ├── utils/            # api-asiakas, päivämäärät, värit, käännökset
│   └── styles/
└── server/
    ├── scripts/          # fit-xg.js (xG-malli), backtest, node-siivous.sh
    └── src/
        ├── index.js      # Express-sovellus
        ├── lib/          # välimuisti, NHL-asiakas, xG-malli, päivämäärät
        ├── routes/       # nhl, predictions, feedback
        ├── services/     # kooste-, tilasto-, kenttä- ja kierrospalvelut
        └── predictions/  # ennustemallit (oletuksena pois päältä)
```

## 🔌 Rajapinta (tärkeimmät)

| Reitti | Kuvaus |
|--------|--------|
| `GET /api/nhl/day?date&nations&favs` | Päivän kooste: ottelut, tulikuumat, seuratut pelaajat |
| `GET /api/nhl/round/:date` | Kierroksen data: joukkuetilastot, xG, pelaajat, maalit |
| `GET /api/nhl/stats/:category` | Pistepörssi, maalivahdit, joukkueet (tuoreet ottelut mukana) |
| `GET /api/nhl/player/:id` · `/player/:id/form` | Pelaajakortti ja muotokäyrä lähes reaaliajassa |
| `GET /api/nhl/game/:id/shots` | Laukaukset koordinaatteineen ja xG:ineen |
| `GET /api/nhl/game/:id/lines` · `/team/:abbrev/lines` | Kentälliset vaihtotiedoista |
| `GET /api/nhl/form?days` | Kunto: pelaajat, maalivahdit, joukkueet |
| `GET /api/nhl/standings` · `/schedule` · `/injuries` | Sarjataulukko, otteluohjelma, loukkaantumiset |
| `POST /api/palaute` | Palautelomake |
| `GET /api/health` | Tila, välimuisti ja muistinkulutus |

## 🎯 Odotetut maalit (xG)

Malli (`server/src/lib/xg.js`) on logistinen regressio, joka on sovitettu
kauden 2025–26 600 ottelun 51 000 torjumattomasta laukauksesta. Se huomioi
etäisyyden, kulman, laukaustyypin, paluukiekot, vauhtihyökkäykset sekä yli- ja
alivoiman.

Tarkkuus erillisillä testiotteluilla: AUC 0,74; 686 odotettua maalia vs. 678
toteutunutta. Ottelutasolla korrelaatio MoneyPuckin xG:hen on 0,88.

Uudelleensovitus (esim. kauden puolivälissä):

```bash
node server/scripts/fit-xg.js 600 20252026
```

## 🌐 Julkaisu webhotelliin

Frontend ja rajapinta julkaistaan yhtenä Node-sovelluksena. Vaiheittainen
ohje cPanelin Node.js-näkymälle on tiedostossa
[docs/webhotelli.md](docs/webhotelli.md).

## 📱 Google Play -julkaisu

Sovellus on asennettava PWA, joka paketoidaan Play Storeen TWA:na
(Trusted Web Activity). Vaiheet: [docs/play-store.md](docs/play-store.md).

## 📊 Ennusteet

Ottelu-, pelaaja- ja joukkue-ennusteiden koodi on mukana mutta oletuksena
pois päältä (`PREDICTIONS_ENABLED=false`), kunnes kaudesta on kertynyt
riittävästi dataa. Mallin kuvaus ja takautuva testaus:
`server/src/predictions/` ja `npm --prefix server run backtest`.

---

*puckoodi on epävirallinen, fanin tekemä sovellus. Se ei ole sidoksissa
National Hockey Leagueen (NHL). Ei mainoksia, ei seurantaa.*
