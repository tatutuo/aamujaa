# Aamujää 🏒

🔴 https://d4nyyy.fi/hockey/

Aamujää on mainokseton NHL-sovellus: ottelut, tilastot, suosikkipelaajat ja
tilastolliset ennusteet yhdessä näkymässä. Tehty puhtaasta intohimosta
jääkiekkoon ja ohjelmointiin.

## ✨ Ominaisuudet

- **Live-tulokset** — ottelut päivittyvät automaattisesti niin kauan kuin niitä on käynnissä
- **Suosikit** — omat pelaajat ja joukkueet nostetaan esiin kaikkialla sovelluksessa
- **Tulikuumat** — illan parhaat suoritukset laskettuna ottelukohtaisesta datasta
- **Suomalaiset jäällä** — kansallisuus haetaan NHL:n rajapinnasta, ei käsin ylläpidetystä nimilistasta
- **Kristallipallo** — tilastollinen ennustemalli pelaajille, joukkueille ja yksittäisille otteluille, sekä toteutunut osumatarkkuus
- **Teksti-TV-tilastot** — pistepörssi, maalit, syötöt, jäähyt, plus/miinus ja peliaika
- **Otteluruudukko** — kenellä on eniten pelejä valitulla aikavälillä (fantasy-suunnitteluun)
- **Fantasy-joukkue** — kokoa 1 MV + 2 P + 3 H ja seuraa illan pisteitä. Pistelasku
  noudattaa Hockey GM:n (hockeygm.fi) virallista taulukkoa; säännöt ovat
  luettavassa muodossa tiedostossa [`src/utils/fantasy.js`](src/utils/fantasy.js)
  ja testattu tiedostossa [`test/fantasy.test.js`](test/fantasy.test.js)
- **Laukauskartta** — jokaisen ottelun laukaukset kaukalokartalla, tuloksen ja laukaustyypin mukaan
- **Maalikoosteet** — napauta maalintekijää ja katso maali
- **Muotokäyrä** — pelaajan pisteet otteluittain, putket ja koti/vieras-jakauma
- **Edistyneet tilastot** — Corsi, aloitusvyöhykkeet, tuotto per 60 min, maalivahtien vakuuttavat ottelut
- **Offline-tuki** — viimeksi ladatut tiedot näkyvät myös ilman verkkoa

## 🛠️ Tekniikka

| Osa | Toteutus |
|-----|----------|
| Frontend | React 19, Vite 7, käsin kirjoitettu CSS |
| Backend | Node.js 20+, Express, ESM-moduulit |
| Tietokanta | SQLite (better-sqlite3) — vain ennusteiden tallennukseen |
| Data | NHL:n julkiset rajapinnat (`api-web.nhle.com`, `api.nhle.com`) |

Backend toimii välityspalvelimena: se kiertää CORS-rajoitukset, välimuistittaa
vastaukset ja kokoaa monta ulkoista kutsua yhdeksi vastaukseksi, jotta selain
tekee mahdollisimman vähän työtä.

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

Backend tarjoilee `dist/`-kansion automaattisesti, jos se on olemassa — eli
tuotannossa riittää yksi prosessi.

## 📁 Rakenne

```
aamujaa/
├── index.html
├── vite.config.js
├── public/               # ikonit, manifest, service worker
├── scripts/
│   └── generate-icons.js # luo maskable-ikonin ja pienemmät koot
├── src/
│   ├── components/       # näkymät ja modaalit
│   ├── hooks/            # useModal, useFetchWhenOpen
│   ├── utils/            # api-asiakas, päivämäärät, joukkuevärit, käännökset
│   └── styles/
└── server/
    ├── .env.example
    └── src/
        ├── index.js      # Express-sovellus
        ├── config.js
        ├── lib/          # välimuisti, NHL-asiakas, tietokanta, päivämäärät
        ├── routes/       # nhl, predictions, feedback
        ├── services/     # ottelupäivän kooste, kansallisuudet
        └── predictions/  # pelaaja-, joukkue- ja ottelumallit
```

## 🔌 Rajapinta

| Reitti | Kuvaus |
|--------|--------|
| `GET /api/nhl/day?date&region` | Päivän kooste: ottelut, tulikuumat, seurattavat pelaajat |
| `GET /api/nhl/score?date` | Raakadata päivän tuloksista |
| `GET /api/nhl/game/:id` | Ottelun tiedot |
| `GET /api/nhl/boxscore/:id` | Ottelun kokoonpanot ja tilastot |
| `GET /api/nhl/standings` | Sarjataulukko konferensseittain |
| `GET /api/nhl/schedule?startDate&days` | Otteluruudukko joukkueittain |
| `GET /api/nhl/leaders?region&sort&limit` | Kärkitilastot |
| `GET /api/nhl/game/:id/shots` | Laukauskartta koordinaatteineen ja maalivideoineen |
| `GET /api/nhl/game/:id/faceoffs` | Aloitukset pelaajittain ja vyöhykkeittäin |
| `GET /api/nhl/game/:id/extras` | Tuomarit, valmentajat, ylimääräiset, erätilastot, kausisarja |
| `GET /api/nhl/game/:id/fantasy` | Fantasy-pisteytyksen tapahtumat: maalityypit, jäähyt, aloitukset, tähdet |
| `GET /api/nhl/player/:id/form` | Pelaajan ottelukohtainen loki ja muototunnusluvut |
| `GET /api/nhl/advanced/:category/:view` | Edistyneet tilastot (Corsi, per 60, vyöhykkeet) |
| `GET /api/nhl/player/:id` | Pelaajakortti |
| `GET /api/nhl/players?ids=1,2,3` | Monta pelaajaa kerralla |
| `GET /api/nhl/team/:abbrev` · `/roster/:abbrev` | Joukkueen ohjelma ja kokoonpano |
| `GET /api/nhl/search?q` | Pelaaja- ja joukkuehaku |
| `GET /api/nhl/predictions?date` | Päivän ennusteet |
| `GET /api/nhl/predictions/accuracy?days` | Mallin toteutunut osumatarkkuus |
| `POST /api/palaute` | Palautelomake |
| `GET /api/health` | Tila ja välimuistitilastot |

Admin-reitit (`POST /api/nhl/predictions/run` ja `/score`) vaativat
`x-admin-token`-otsakkeen, joka vastaa `.env`-tiedoston `ADMIN_TOKEN`-arvoa.
Jos arvo puuttuu, reitit ovat kokonaan pois käytöstä.

## 🌐 Julkaisu webhotelliin

Frontend ja rajapinta julkaistaan yhtenä Node-sovelluksena: palvelin tarjoilee
`dist/`-kansion automaattisesti jos se on olemassa. Vaiheittainen ohje cPanelin
Node.js-näkymälle on tiedostossa [docs/webhotelli.md](docs/webhotelli.md).

## 📱 Google Play -julkaisu

Sovellus on asennettava PWA, joka paketoidaan Play Storeen TWA:na
(Trusted Web Activity). Vaiheet on kuvattu tiedostossa
[docs/play-store.md](docs/play-store.md).

## 📊 Ennustemalli

Ennusteet lasketaan kerran vuorokaudessa klo 09:00 Suomen aikaa ja tallennetaan
tietokantaan, joten kaikki käyttäjät näkevät saman ennusteen koko päivän ajan.

- **Ottelut** — odotuslaukaukset joukkueiden laukausvoimista, muunnettuna maaleiksi regressoidulla maalintekoprosentilla ja vastustajan maalivahtitasolla. Lopputulosjakauma lasketaan analyyttisesti, ei arpomalla.
- **Pelaajat** — kauden vauhti kutistettuna kohti liigan keskiarvoa, painotettuna viimeisen 21 päivän muodolla ja korjattuna iällä, ylivoimavastuulla ja peliaikatrendillä. Mukana vaihteluväli, ei pelkkä piste-estimaatti.
- **Joukkueet** — voimaluku Pythagoraan odotusvoitoista, pisteprosentista ja viimeisestä kymmenestä.

Kaikki tunnusluvut kutistetaan otoskoon mukaan kohti liigan keskiarvoa, joten
malli ei usko kymmenen ottelun kuumaa jaksoa pysyväksi tasoksi.

Jokainen otteluennuste kertoo myös perustelut sille, miksi ennuste on mitä on.

### Mitattu tarkkuus

Takautuva testaus, jossa jokaisen päivän ennuste käyttää vain sitä päivää
edeltävää dataa:

Koko kausi 2025–26, 1292 ottelua:

| Mittari | Malli | "Koti voittaa aina" |
|---------|-------|---------------------|
| Osumatarkkuus | **58,6 %** | 52,3 % |
| Brier-pisteet | **0,2397** | 0,2495 |
| Logaritminen tappio | **0,6720** | 0,6922 |

Kalibrointi on hyvä: kun malli sanoo 60 %, kotijoukkue voittaa noin 57 %:ssa
tapauksista. Toteutunut tarkkuus näkyy myös sovelluksessa, eikä sitä kaunistella.

```bash
npm --prefix server run backtest 2025-10-07 2026-04-16
```

Matematiikka on eristetty moduuliin `server/src/predictions/math.js` puhtaina
funktioina, ja sille on 28 testiä:

```bash
npm --prefix server test
```

---

*Aamujää on epävirallinen, fanin tekemä sovellus. Se ei ole sidoksissa
National Hockey Leagueen (NHL). Ei mainoksia, ei seurantaa.*
