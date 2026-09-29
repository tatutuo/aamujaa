# NHL:n rajapinnat — mitä on saatavilla

Kartoitettu 9.8.2026 koeajamalla jokainen polku. Merkintä ✅ = Aamujää käyttää
tätä jo, 🔵 = saatavilla mutta käyttämättä.

NHL:llä on kaksi erillistä rajapintaa, eikä kumpikaan ole virallisesti
dokumentoitu. Ne voivat muuttua ilman varoitusta, joten välimuisti ja
virheensieto ovat pakollisia — molemmat ovat jo paikallaan.

---

## 1. api-web.nhle.com — ottelut, pelaajat, joukkueet

| Polku | Tila | Sisältö |
|-------|------|---------|
| `/score/{pvm}` | ✅ | Päivän ottelut, tulokset ja **maalintekijät** |
| `/schedule/{pvm}` | ✅ | Otteluohjelma viikoittain |
| `/scoreboard/now` | 🔵 | Usean päivän tulostaulu kerralla |
| `/standings/{pvm}` | ✅ | Sarjataulukko **millä tahansa päivällä** |
| `/standings-season` | 🔵 | Kausien alku- ja loppupäivät, sääntömuutokset |
| `/gamecenter/{id}/landing` | ✅ | Ottelun tapahtumat ja kolme tähteä |
| `/gamecenter/{id}/boxscore` | ✅ | Kokoonpanot ja pelaajatilastot |
| `/gamecenter/{id}/play-by-play` | ⚠️ | **Kaikki tapahtumat koordinaatteineen** — haetaan mutta ei hyödynnetä |
| `/gamecenter/{id}/right-rail` | 🔵 | Tuomarit, ylimääräiset, päävalmentaja, laukaukset erittäin, keskinäiset kohtaamiset |
| `/wsc/game-story/{id}` | 🔵 | Ottelukertomus |
| `/player/{id}/landing` | ✅ | Pelaajakortti, ura, palkinnot, varaustiedot |
| `/player/{id}/game-log/{kausi}/{tyyppi}` | 🔵 | **82 ottelun loki pelaajaa kohti** |
| `/roster/{joukkue}/current` | ✅ | Nykyinen kokoonpano |
| `/roster/{joukkue}/{kausi}` | 🔵 | Minkä tahansa kauden kokoonpano |
| `/roster-season/{joukkue}` | 🔵 | Mitkä kaudet ovat saatavilla |
| `/club-schedule-season/{joukkue}/{kausi}` | ✅ | Joukkueen koko kauden ohjelma |
| `/club-schedule/{joukkue}/month/now` | 🔵 | Kuukausinäkymä |
| `/club-stats/{joukkue}/{kausi}/{tyyppi}` | 🔵 | **Koko joukkueen pelaajatilastot yhdellä kutsulla** |
| `/skater-stats-leaders/current` | 🔵 | Valmiit kärkilistat kuvineen ja logoineen |
| `/goalie-stats-leaders/current` | 🔵 | Maalivahtien kärkilistat |
| `/playoff-series/carousel/{kausi}` | 🔵 | Pudotuspelisarjat |
| `/playoff-bracket/{vuosi}` | 🔵 | **Pudotuspelikaavio** (15 sarjaa) |
| `/draft/rankings/now` | 🔵 | Varaustilaisuuden ennakkoluokitukset |
| `/network/tv-schedule/{pvm}` | 🔵 | TV-lähetykset |
| `/meta?players=&teams=` | 🔵 | Pelaajien ja joukkueiden perustiedot niputettuna |

**Ei olemassa:** `/draft/picks/{kausi}/all`, `/where-to-watch` (404).

---

## 2. api.nhle.com/stats/rest — tilastoraportit

**601 eri mittaria** 45 raportissa. Kysely on aina samanmuotoinen:

```
/stats/rest/en/{kategoria}/{raportti}?limit=-1&cayenneExp=seasonId=20252026 and gameTypeId=2
```

`cayenneExp` tukee myös `gameDate>="…"`, `nationalityCode='FIN'`,
`playerId in (…)` ja vertailuoperaattoreita.

### Kenttäpelaajat (19 raporttia, ~940 pelaajaa)

| Raportti | Tila | Mitä siitä saa |
|----------|------|----------------|
| `summary` | ✅ | Perustilastot |
| `bios` | ✅ | Kansallisuus, varaustiedot, syntymäpaikka |
| `realtime` | 🔵 | Taklaukset, blokit, riistot, menetykset, **ohilaukaukset tolppatyypeittäin** |
| `puckPossessions` | 🔵 | **Corsi (satPct), aloitusvyöhykkeet, on-ice-laukaisu-%** |
| `percentages` | 🔵 | **Corsi/Fenwick johdossa, tasan ja tappiolla** |
| `scoringRates` | 🔵 | **Pisteet per 60 min 5v5**, ensi- ja toissijaiset syötöt |
| `timeonice` | 🔵 | Peliaika tilanteittain, **vuorojen määrä ja pituus** |
| `powerplay` / `penaltykill` | 🔵 | Erikoistilannetuotto per 60 min |
| `faceoffpercentages` / `faceoffwins` | 🔵 | **Aloitukset vyöhykkeittäin** |
| `penalties` | 🔵 | Jäähyt tyypeittäin, **vedetyt jäähyt** |
| `shottype` | 🔵 | **Maalit ja osumaprosentit laukaustyypeittäin** |
| `goalsForAgainst` | 🔵 | Maaliero jäällä ollessa tilanteittain |
| `scoringpergame` | 🔵 | Kaikki per ottelu |
| `shootout` | 🔵 | Voittolaukaukset, myös uralta |
| `penaltyShots` | 🔵 | Rangaistuslaukaukset |
| `summaryshooting` | 🔵 | Corsi-erittelyt tilanteittain |

`timeonicecontinued` palauttaa virheen 500 — rikki NHL:n päässä.

### Maalivahdit (8 raporttia, ~98 vahtia)

| Raportti | Tila | Mitä siitä saa |
|----------|------|----------------|
| `summary` / `bios` | ✅ | Perustilastot |
| `advanced` | 🔵 | **Vakuuttavat ottelut (quality starts), keskeytetyt ottelut** |
| `daysrest` | 🔵 | **Torjunta-% lepopäivien mukaan (0–4+)** |
| `savesByStrength` | 🔵 | Torjunta-% tasa-, yli- ja alivoimalla |
| `startedVsRelieved` | 🔵 | Aloittajana vs. vaihdosta tulleena |
| `shootout` | 🔵 | Voittolaukaustorjunnat |
| `penaltyShots` | 🔵 | Rangaistuslaukaukset |

### Joukkueet (18 raporttia)

| Raportti | Tila | Mitä siitä saa |
|----------|------|----------------|
| `summary` | ✅ | Maalit, laukaukset, YV/AV — ennustemallin perusta |
| `percentages` | 🔵 | **Corsi/Fenwick, 5v5-torjunta- ja laukaisuprosentti** |
| `daysbetweengames` | 🔵 | **Tulokset lepopäivien mukaan — mitattu väsymysvaikutus** |
| `leadingtrailing` | 🔵 | Voittoprosentti johdossa/tappiolla erän jälkeen |
| `scoretrailfirst` | 🔵 | Miten käy kun tekee tai päästää ensimmäisen maalin |
| `goalsbyperiod` | 🔵 | **Maalit erittäin** |
| `goalsagainstbystrength` | 🔵 | Päästetyt tilanteittain (5v5, 5v4, tyhjä maali…) |
| `powerplaytime` / `penaltykilltime` | 🔵 | Erikoistilanteet 5v4, 5v3, 4v3 eriteltynä |
| `outshootoutshotby` | 🔵 | Tulokset laukausylivoiman mukaan |
| `shottype` | 🔵 | Laukaustyypit |
| `realtime` | 🔵 | Taklaukset, blokit, riistot |
| `faceoffpercentages` | 🔵 | Aloitukset vyöhykkeittäin |
| `penalties` / `powerplay` / `penaltykill` | 🔵 | Kurinalaisuus ja erikoistilanteet |
| `shootout` | 🔵 | Voittolaukauskilpailut |

`team/franchise` palauttaa virheen 500.

### Muut

| Polku | Sisältö |
|-------|---------|
| `/shiftcharts?cayenneExp=gameId={id}` | **766 vuoroa per ottelu** — kenttä­yhdistelmät ja peliaikajana |

---

## 3. Merkittävimmät löydöt

### Play-by-play sisältää koordinaatit

Testiottelussa **312 tapahtumaa, joista 257:llä x/y-koordinaatit**:

```json
{
  "typeDescKey": "shot-on-goal",
  "timeInPeriod": "02:58",
  "details": {
    "xCoord": -2, "yCoord": -22, "zoneCode": "N",
    "shotType": "wrist",
    "shootingPlayerId": 8478047,
    "goalieInNetId": 8481551
  }
}
```

Tapahtumatyypit: `faceoff`, `hit`, `giveaway`, `takeaway`, `blocked-shot`,
`missed-shot`, `shot-on-goal`, `goal`, `penalty`, `stoppage`.

Tämä riittää **laukauskarttaan ja lämpökarttaan** — ottelusta, pelaajasta tai
maalivahdista. Sovellus hakee tämän datan jo, mutta ei näytä siitä mitään.

### Jokaisella maalilla on videolinkki

```json
"highlightClipSharingUrl": "https://nhl.com/video/dal-buf-bourque-scores-goal-…"
```

Maalikooste on siis yhden napautuksen päässä ilman erillistä integraatiota.

### Pelaajan ottelulokí

`/player/{id}/game-log/{kausi}/2` palauttaa **82 ottelua** kenttinä
`goals, assists, points, plusMinus, shots, shifts, toi, opponentAbbrev,
homeRoadFlag, gameDate`. Tästä saa suoraan muotokäyrän, putket sekä
koti/vieras- ja vastustajajakaumat. Saatavilla 12 kaudelta taaksepäin.

### Ottelun taustatiedot

`right-rail` antaa tuomarit (Wes McCauley, Chris Rooney), linjatuomarit,
päävalmentajat, **ylimääräiset pelaajat**, laukaukset erittäin ja
keskinäisten kohtaamisten historian.

---

## 4. Mitä tämä tarkoittaa ennustemallille

Kolme raporttia parantaisi mallia mitattavasti:

**`team/percentages` → Corsi.** Laukaisuyritykset (satPct) ennustavat tulevaa
paremmin kuin maalille asti päässeet laukaukset, joita malli käyttää nyt.

**`team/daysbetweengames` → mitattu väsymys.** Malli käyttää nyt arvattuja
kertoimia (0,96 hyökkäykseen ja 1,05 puolustukseen, kun ottelut ovat
peräkkäisinä päivinä).
Tämä raportti kertoo **toteutuneet** maaliluvut lepopäivien mukaan, joten
kertoimet voi laskea datasta arvaamisen sijaan.

**`goalie/daysrest` ja `goalie/advanced`.** Torjunta-% lepopäivien mukaan
korvaisi nykyisen oletuksen siitä, että vaihtovahti pelaa jälkimmäisen
peräkkäisistä otteluista.
Vakuuttavien otteluiden osuus kertoo maalivahdin tasaisuudesta enemmän
kuin keskiarvo.

---

## 5. Käytännön huomiot

- **Kausi päättelyyn:** `/standings-season` kertoo tarkat päivät. Kaudelle
  2026–27: runkosarja alkaa 29.9.2026, päättyy 10.4.2027.
- **Historia:** tilastot ulottuvat 1917-luvulle asti, mutta edistyneet mittarit
  (Corsi, aloitusvyöhykkeet) alkavat kaudesta 2007–08.
- **Rajoitukset:** rajapinta ei vaadi avainta eikä dokumentoi rajojaan.
  Välimuisti ja rinnakkaisuuden rajoitus ovat siksi pakollisia — molemmat
  ovat jo käytössä (`lib/cache.js`, `mapWithConcurrency`).
- **Kielet:** monet kentät ovat `{ default, fi, sv, cs, … }` -muodossa.
  Suomenkielistä sisältöä löytyy nimien translitteroinneista.

---

## 6. Kolme löydöstä ottelukortin datasta

Nämä selvitettiin, koska sovelluksessa oli niistä kussakin näkyvä vika.

**Aloitukset eivät ole `landing`-vastauksessa.** Ottelukortti näytti aloituksissa
lähes aina nollaa, koska `boxscore`- ja `landing`-vastausten pelaajakohtaiset
`faceoffWinningPctg`-kentät ovat usein tyhjiä tai pyöristettyjä. Tarkat luvut
saa vain `play-by-play`-vastauksen `faceoff`-tapahtumista, joissa on
`winningPlayerId`, `losingPlayerId` ja `zoneCode`. Niistä lasketaan sekä
pelaajakohtainen voitto/tappio että vyöhykejakauma
(`services/shots.js` → `getGameFaceoffs`).

**Jäähydatassa ei ole pelaajan tunnistetta.** `summary.penalties[].penalties[]`
sisältää vain `committedByPlayer` (etu- ja sukunimi sekä `sweaterNumber`),
`teamAbbrev`, `drawnBy` ja `descKey` — ei `playerId`-kenttää missään muodossa.
Siksi jäähypelaajan nimeä ei päässyt napauttamaan. Ratkaisu: pelinumero on
joukkueen sisällä yksikäsitteinen, joten tunniste haetaan boxscoren
kokoonpanosta parilla *joukkue + pelinumero*. Tämä on luotettavampi kuin
nimivertailu, joka kaatui aksentteihin (esim. Ljubushkin/Lyubushkin).

**Loukkaantumisia ei julkaista lainkaan.** NHL:n avoimessa rajapinnassa ei ole
loukkaantumisraporttia missään muodossa. Lähin saatavilla oleva tieto on
`landing`-vastauksen `scratches`, eli ottelusta ulkona olleet pelaajat — mutta
se ei erottele loukkaantumista, terveenä penkittämistä tai lepovuoroa.
Sovellus näyttää siksi ylimääräiset sellaisenaan ja sanoo suoraan, ettei
loukkaantumistietoa ole. Oikea loukkaantumisdata vaatisi maksullisen lähteen.
