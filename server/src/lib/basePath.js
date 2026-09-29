/**
 * Asennuksen alipolun tunnistus.
 *
 * Sovellus voi olla asennettu verkkotunnuksen juureen (d4nyyy.fi) tai
 * alipolkuun (d4nyyy.fi/hockey). Webhotellien Node-tuki — Passenger, cPanel ja
 * vastaavat — välittää sovellukselle pyynnön joko alipolun kanssa tai ilman
 * sitä, ja käytäntö vaihtelee palvelimen mukaan.
 *
 * Väärä oletus ei näy selkeänä virheenä: selain pyytää
 * `/hockey/assets/index.css`, palvelin ei löydä sitä, SPA-varareitti palauttaa
 * `index.html`:n koodilla 200, ja konsoliin tulee pelkkä valitus väärästä
 * MIME-tyypistä. Todellinen syy jää piiloon.
 *
 * Siksi etuliitettä ei arvata eikä jätetä ympäristömuuttujan varaan: jos polun
 * ensimmäinen osa ei ole `api` eikä mikään frontendin juuritiedosto, se on
 * asennuksen alipolku ja karsitaan.
 */

/**
 * Polun ensimmäinen osa ilman kyselymerkkijonoa.
 * '/hockey/assets/x.js' -> 'hockey', '/' -> ''.
 */
function firstSegment(url) {
    return url.split(/[?#]/)[0].split('/')[1] ?? '';
}

/**
 * Karsii asennuksen alipolun pyynnön polusta.
 *
 * @param {string} url            Pyynnön polku, esim. '/hockey/api/health'
 * @param {Set<string>} distEntries  Frontendin juuritiedostot ('assets', 'index.html', …)
 * @param {string} [basePath]     Pakotettu alipolku (BASE_PATH). Tyhjä = tunnista itse.
 * @returns {string}              Polku ilman alipolkua
 */
export function stripBasePath(url, distEntries, basePath = '') {
    if (basePath) {
        if (url === basePath) return '/';
        if (url.startsWith(`${basePath}/`)) return url.slice(basePath.length);
        // Palvelin karsi alipolun jo itse — polku on valmiiksi oikein.
        return url;
    }

    const first = firstSegment(url);
    if (!first || first === 'api' || distEntries.has(first)) return url;

    return url.slice(1 + first.length) || '/';
}
