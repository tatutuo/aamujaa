# Google Play -julkaisu (TWA)

Aamujää julkaistaan Play Storeen **Trusted Web Activity** -paketoinnilla: Android-sovellus
on ohut kuori, joka avaa saman sivuston koko ruudulle ilman selaimen osoiterivia.

Yleisin syy hylkäykseen on, että sovellus näyttää arvioijalle selaimen osoiterivin
("ei toimi täysruudussa") tai verkkovirhesivun. Molemmat estetään alla olevilla vaiheilla.

## 1. Edellytykset (nämä ovat nyt kunnossa)

| Vaatimus | Tila |
|----------|------|
| HTTPS-yhteys | ✅ d4nyyy.fi |
| `manifest.webmanifest` linkitettynä HTML:ään | ✅ |
| `name`, `short_name`, `start_url`, `scope` | ✅ |
| `display: standalone` | ✅ |
| 512×512 ikoni, `purpose: any` | ✅ |
| 512×512 ikoni, `purpose: maskable` | ✅ `npm run icons` |
| Service worker, joka vastaa offline-tilassa | ✅ `public/sw.js` |
| Android-takaisinpainike ei sulje sovellusta modaalista | ✅ hoidettu App.jsx:ssä |

Tarkista ennen paketointia Chromen DevToolsin **Lighthouse → PWA** -raportti.
Sen pitää mennä läpi ennen kuin jatkat.

## 2. Paketointi

Helpoin tapa on [PWABuilder](https://www.pwabuilder.com/):

1. Syötä osoite `https://d4nyyy.fi/hockey/`
2. Valitse **Package for stores → Android**
3. Ota käyttöön **Signing key: create new** ja **lataa avain talteen**

Vaihtoehtoisesti komentoriviltä:

```bash
npx @bubblewrap/cli init --manifest https://d4nyyy.fi/hockey/manifest.webmanifest
npx @bubblewrap/cli build
```

> ⚠️ Ota allekirjitusavaimesta (`.keystore` / `.jks`) varmuuskopio ja talleta salasana.
> Jos avain katoaa, samaa sovellusta ei voi enää päivittää Play Storessa.

## 3. Digital Asset Links — tämä on se vaihe joka useimmiten unohtuu

Ilman tätä tiedostoa Android **ei luota** sovellukseen ja näyttää selaimen
osoiterivin. Sovellus näyttää silloin nettisivulta, ja Play arvioi sen usein
riittämättömäksi.

Paketoija antaa sovelluksen SHA-256-sormenjäljen. Julkaise se osoitteessa:

```
https://d4nyyy.fi/.well-known/assetlinks.json
```

Huomaa: tiedosto tulee **verkkotunnuksen juureen**, ei `/hockey/`-polkuun.

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "fi.d4nyyy.aamujaa",
      "sha256_cert_fingerprints": ["TÄHÄN_SORMENJÄLKI_PAKETOIJALTA"]
    }
  }
]
```

Tiedosto on tarjoiltava `Content-Type: application/json` -otsakkeella ilman
uudelleenohjausta. Tarkista onnistuminen:

```bash
curl -i https://d4nyyy.fi/.well-known/assetlinks.json
```

Kun sovellus on Play Storessa, käytä **Play-konsolin omaa allekirjoitusavainta**
(App Signing) — sen sormenjälki löytyy kohdasta *Julkaisu → Sovelluksen eheys*.
Jos käytät väärää sormenjälkeä, osoiterivi jää näkyviin.

## 4. Kauppasivun materiaalit

Play vaatii nämä ennen julkaisua:

- Sovelluskuvake 512×512 PNG
- Esittelykuva 1024×500 PNG
- Vähintään 2 kuvakaappausta puhelimen näytöltä (min. 320 px lyhyempi sivu)
- Lyhyt kuvaus (max 80 merkkiä)
- Pitkä kuvaus (max 4000 merkkiä)
- **Tietosuojakäytäntö julkisessa URL-osoitteessa** — pakollinen kaikille sovelluksille

Tietosuojakäytännön voi pitää lyhyenä, koska sovellus ei kerää mitään:
suosikit ja fantasy-joukkue tallentuvat vain laitteen omaan selainmuistiin,
eikä palvelin tallenna käyttäjätietoja.

## 5. Tietoturvalomake (Data safety)

Vastaa Play-konsolin lomakkeeseen:

- Kerätäänkö tietoja? **Ei**
- Jaetaanko tietoja kolmansille? **Ei**
- Salataanko siirto? **Kyllä (HTTPS)**

Jos otat myöhemmin käyttöön analytiikkaa tai push-ilmoituksia, tämä lomake on
päivitettävä — väärä vastaus on peruste sovelluksen poistolle.

## 6. Sisältö ja tekijänoikeudet

Play hylkää sovelluksia, jotka näyttävät käyttävän liigan virallista brändiä
ilman lupaa. Aamujää on tämän suhteen turvallisella puolella:

- Joukkueiden logoja ei käytetä — `TeamBadge` piirtää lyhenteen joukkueen väreissä
- NHL-sanaa ei käytetä sovelluksen nimessä eikä ikonissa
- Kuvauksessa on mainittava selvästi, että sovellus on epävirallinen

Lisää kauppasivun kuvauksen loppuun:

> Aamujää on epävirallinen, fanin tekemä sovellus eikä ole sidoksissa National
> Hockey Leagueen (NHL). Kaikki tavaramerkit kuuluvat omistajilleen.

## 7. Julkaisua ennen

- [ ] Testaa sovellus oikealla Android-laitteella (sisäinen testaus)
- [ ] Varmista ettei osoiterivi näy → assetlinks toimii
- [ ] Katkaise verkko ja tarkista, ettei näy selaimen virhesivua
- [ ] Testaa takaisin-painike modaalin päältä
- [ ] Tarkista, että sovellus toimii myös kesällä ilman otteluita (tyhjät tilat)

Viimeinen kohta on tärkeä juuri nyt: kausi alkaa vasta lokakuussa, joten arvioija
näkee sovelluksen ilman yhtään ottelua. Tyhjien tilojen pitää näyttää harkituilta
eikä rikkinäisiltä — tilastonäkymä näyttää nyt edellisen kauden luvut ja kertoo
sen selvästi.
