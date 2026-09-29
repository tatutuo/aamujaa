# Aamujään julkaisu webhotelliin (cPanel / Node.js-sovellus)

Ohje on kirjoitettu sille Node.js-hallintanäkymälle, joka hotellissasi on:
*Node.js version · Application mode · Application root · Application URL ·
Application startup file · Environment variables*.

Sovellus julkaistaan **yhtenä Node-sovelluksena**. Palvelin tarjoilee sekä
rajapinnan että valmiiksi käännetyn frontendin, joten erillistä staattista
sivustoa ei tarvita — `server/src/index.js` jakaa `dist/`-kansion automaattisesti
jos se on olemassa.

---

## 1. Käännä frontend omalla koneella

Hotellissa ei kannata ajaa Viten käännöstä; tee se paikallisesti.

```bash
npm run build
```

Ei ympäristömuuttujia. Sovelluksen polku (`/hockey/`) on `vite.config.js`:ssä,
ja sekä selain että palvelin johtavat rajapinnan osoitteen siitä. Jos julkaiset
joskus toiseen polkuun, muuta se `vite.config.js`:n `base`-arvoon — muualle ei
tarvitse koskea.

Tulos syntyy `dist/`-kansioon. Tarkista että siellä on `index.html` ja
`assets/`-kansio.

## 2. Vie tiedostot palvelimelle

Luo hotelliin kansio `/home/dnyyyfi/aamujaa` ja vie sinne **kaksi** kansiota:

```
/home/dnyyyfi/aamujaa/
├── dist/        ← kohdasta 1
└── server/      ← koko server-kansio ilman node_modulesia
```

`server/node_modules` **jätetään pois** — se asennetaan palvelimella (kohta 5).
Myöskään `server/.env` ei kannata viedä: ympäristömuuttujat annetaan
hallintapaneelissa, jolloin ne eivät päädy tiedostoon.

Polkujen on oltava juuri tässä suhteessa, koska palvelin etsii frontendin
polusta `server/src/../../dist`.

## 3. Luo sovellus paneelissa

**CREATE APPLICATION** ja kentät näin:

| Kenttä | Arvo |
|---|---|
| Node.js version | **20.20.2** |
| Application mode | **Production** |
| Application root | `/home/dnyyyfi/aamujaa/server` |
| Application URL | `d4nyyy.fi` + `hockey` |
| Application startup file | `src/index.js` |

Application root osoittaa `server`-kansioon eikä projektin juureen, koska
paneeli etsii `package.json`-tiedoston sieltä. Palvelimen `engines`-kenttä on
`>=20`, joten 20.20.2 kelpaa.

## 4. Ympäristömuuttujat

Lisää **ADD VARIABLE** -painikkeella:

| Muuttuja | Arvo | Selitys |
|---|---|---|
| `CORS_ORIGINS` | `https://d4nyyy.fi` | Rajaa rajapinnan omaan sivustoon |
| `ADMIN_TOKEN` | *pitkä satunnainen merkkijono* | Suojaa ennusteiden ajoreitit. Jos tyhjä, ne ovat kokonaan pois käytöstä |
| `PREDICTIONS_ENABLED` | `true` | Ennusteiden automaattiajo |

Palautelomake tarvitsee lisäksi `EMAIL_USER`, `EMAIL_PASS` ja `EMAIL_RECEIVER`
(Gmaililla sovellussalasana, ei tilin salasanaa). Ilman niitä lomake on pois
käytöstä, mutta muu sovellus toimii.

**Älä aseta `PORT`-muuttujaa.** Hotelli antaa portin itse, ja palvelin lukee sen
`process.env.PORT`-arvosta.

## 5. Asenna riippuvuudet

Paina paneelin **Run NPM Install** -painiketta.

Yksi riippuvuuksista, `better-sqlite3`, on natiivimoduuli. Se lataa yleensä
valmiin binäärin Node 20:lle eikä vaadi kääntämistä. Jos asennus silti kaatuu
`node-gyp`-virheeseen, hotellista puuttuvat käännöstyökalut — ota silloin
yhteyttä tukeen tai kysy erikseen, miten ennustetietokanta korvataan.

Tietokanta syntyy itsestään polkuun `server/data/aamujaa.db`, joten kansiolla
pitää olla kirjoitusoikeus. Se on kotihakemistossasi, joten oikeudet ovat
kunnossa oletuksena.

## 6. Käynnistä ja testaa

Käynnistä sovellus paneelista ja testaa **tässä järjestyksessä**:

```bash
curl https://d4nyyy.fi/hockey/api/health
```

Oikea vastaus on JSONia:

```json
{"status":"ok","season":"20262027","uptime":12,"cache":{...}}
```

Kun terveystarkistus vastaa JSONia, avaa selaimessa:

```
https://d4nyyy.fi/hockey/
```

### Alipolku hoituu itsestään

Webhotellit välittävät sovellukselle pyynnön joko alipolun kanssa
(`/hockey/api/health`) tai ilman sitä (`/api/health`), ja käytäntö vaihtelee
palvelimen mukaan. Palvelin tunnistaa tilanteen itse eikä asetusta tarvita:
jos polun ensimmäinen osa ei ole `api` eikä mikään frontendin tiedosto, se on
asennuksen alipolku ja karsitaan.

Jos jokin erikoistapaus vaatii silti pakottamista, `BASE_PATH`-ympäristö-
muuttuja ohittaa tunnistuksen (`BASE_PATH=/hockey`). Sitä ei normaalisti
tarvita.

### Jos selain valittaa MIME-tyypistä

Virhe *"Refused to apply style … MIME type ('text/html')"* tarkoittaa aina
samaa: palvelin ei löytänyt tiedostoa ja palautti sen tilalle `index.html`:n.
Yleisin syy on että `dist/`-kansio puuttuu palvelimelta tai on väärässä
paikassa — sen pitää olla `server/`-kansion **rinnalla**, ei sisällä.

Tarkista suoraan:

```bash
curl -I https://d4nyyy.fi/hockey/manifest.webmanifest
```

`Content-Type` on oikein `application/manifest+json`. Jos se on `text/html`,
tiedostoa ei löydy. Puuttuvat tiedostot vastaavat nykyään 404:llä eivätkä
HTML:llä, joten syy näkyy suoraan verkkovälilehdellä.

## 7. Ennusteiden ajastus jaetulla palvelimella

Palvelin ajaa ennusteet klo 9.00 Suomen aikaa omalla ajastimellaan. Jaetuissa
webhotelleissa Node-sovellus kuitenkin **pysäytetään usein, kun liikennettä ei
ole** — silloin ajastin ei laukea eivätkä ennusteet päivity.

Varmin tapa on hotellin oma cron, joka herättää sovelluksen ja pyytää ajon:

```bash
curl -s -X POST -H "x-admin-token: SINUN_ADMIN_TOKEN" https://d4nyyy.fi/hockey/api/nhl/predictions/run
```

Aseta se cronissa aikaan `0 9 * * *`. Vaihda `SINUN_ADMIN_TOKEN` kohdassa 4
asettamaasi arvoon.

## 8. Päivittäminen myöhemmin

1. `npm run build` omalla koneella
2. Korvaa palvelimen `dist/` uudella
3. Jos `server/`-koodi muuttui, korvaa sekin ja aja **Run NPM Install**
   uudelleen vain jos riippuvuudet muuttuivat
4. Paina paneelista **Restart** (nuolikuvake sovelluksen rivillä)

Selaimet pitävät `assets/`-tiedostot pitkään välimuistissa, mutta se on
turvallista: Vite lisää tiedostonimiin sisältöhajautteen, joten uusi versio saa
uudet nimet.

---

## Vaihtoehto: pelkkä backend omaksi sovelluksekseen

Jos haluat jättää frontendin sinne missä se nyt on ja pystyttää vain
rajapinnan, muuttuu kolme asiaa:

1. Vie palvelimelle **vain** `server/`-kansio, esimerkiksi polkuun
   `/home/dnyyyfi/aamujaa-api`. Ilman `dist/`-kansiota palvelin ei tarjoile
   frontendiä lainkaan, vaan pelkän rajapinnan.
2. Application URL: `d4nyyy.fi` + `aamujaa-api`, Application root
   `/home/dnyyyfi/aamujaa-api`.
3. Kerro frontendille että rajapinta on eri paikassa kuin se itse. Tämä on
   ainoa tilanne jossa `VITE_API_URL` on tarpeen — Windowsissa se asetetaan
   erillisellä rivillä, ei komennon eteen:

   PowerShell:
   ```powershell
   $env:VITE_API_URL = '/aamujaa-api'; npm run build
   ```

   Git Bash tai Linux:
   ```bash
   VITE_API_URL=/aamujaa-api npm run build
   ```

Terveystarkistus on silloin `https://d4nyyy.fi/aamujaa-api/api/health`.

Yhden sovelluksen malli on silti suositeltavampi: frontend ja rajapiste ovat
samassa originissa, jolloin CORS-asetuksilla ei ole merkitystä eikä
päivittäessä tarvitse muistaa kahta paikkaa.

---

## Yhteenveto asetuksista

```
Node.js version           20.20.2
Application mode          Production
Application root          /home/dnyyyfi/aamujaa/server
Application URL           d4nyyy.fi/hockey
Application startup file  src/index.js

CORS_ORIGINS              https://d4nyyy.fi
ADMIN_TOKEN               <satunnainen>
PREDICTIONS_ENABLED       true
```

Alipolkua ei tarvitse kertoa palvelimelle — se tunnistaa sen itse.
