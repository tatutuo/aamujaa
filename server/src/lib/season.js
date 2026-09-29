/**
 * Kauden tunniste (esim. "20252026") laskettuna päivämäärästä.
 *
 * Vanhassa app.js:ssä kausi oli kovakoodattu merkkijonona kymmeneen eri kohtaan,
 * jolloin sovellus hajoaa hiljaisesti aina lokakuussa. Tämä moduuli hoitaa asian
 * yhdestä paikasta.
 *
 * NHL-kausi alkaa lokakuussa ja päättyy kesäkuussa, joten kauden vaihtumisen
 * rajaksi on valittu 1.8. — sen jälkeen puhutaan jo uudesta kaudesta.
 */

const SEASON_ROLLOVER_MONTH = 8; // elokuu

export function getSeasonId(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const startYear = month >= SEASON_ROLLOVER_MONTH ? year : year - 1;
    return `${startYear}${startYear + 1}`;
}

export function getPreviousSeasonId(date = new Date()) {
    const current = getSeasonId(date);
    const startYear = Number(current.slice(0, 4)) - 1;
    return `${startYear}${startYear + 1}`;
}

/**
 * Runkosarjan pelimäärä. Käytetään ennusteissa "montako peliä on jäljellä".
 */
export const REGULAR_SEASON_GAMES = 82;
