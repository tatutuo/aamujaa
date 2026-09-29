import { config } from '../config.js';

/**
 * Päivämäärä muodossa YYYY-MM-DD Suomen aikavyöhykkeellä.
 *
 * HUOM: älä käytä toISOString().split('T')[0] — se antaa UTC-päivän, joka on
 * Suomessa väärä joka ilta klo 02:00 jälkeen (kesäaikaan klo 03:00).
 */
export function toDateString(date = new Date()) {
    return date.toLocaleDateString('en-CA', { timeZone: config.timezone });
}

export function addDays(dateString, days) {
    const d = new Date(`${dateString}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validoi käyttäjän antaman päivämäärän ennen kuin se päätyy ulkoiseen URL:iin.
 * Ilman tätä /api/nhl/score?date=../../jotain päätyisi sellaisenaan NHL:n API-polkuun.
 */
export function isValidDateString(value) {
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
    const d = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Kellonaika tunteina Suomen aikaa (0–23).
 *
 * Palvelin voi olla UTC-vyöhykkeellä, joten tuntia ei voi lukea koneen
 * omasta kellosta — muuten ottelukierros vaihtuisi väärään aikaan.
 */
function helsinkiHour(now) {
    return Number(new Intl.DateTimeFormat('en-GB', {
        timeZone: config.timezone,
        hour: '2-digit',
        hourCycle: 'h23',
    }).format(now));
}

/** Kellonaika, jolloin etusivu siirtyy seuraavaan ottelukierrokseen. */
export const GAME_DAY_SWITCH_HOUR = 18;

/**
 * "Aamujää-päivä": NHL merkitsee ottelut Pohjois-Amerikan päivämäärällä, joten
 * Suomessa yöllä klo 02–06 katsotut ottelut ovat edellisen vuorokauden
 * kierros. Sama kierros halutaan nähdä vielä seuraavana päivänä — aamulla,
 * töissä ja iltapäivällä.
 *
 * Kierros vaihtuu vasta klo 18 Suomen aikaa, jolloin illalla näkyy jo tulevan
 * yön ohjelma. Aiemmin tässä vähennettiin 12 tuntia, jolloin vaihto tapahtui
 * jo keskipäivällä ja iltapäivällä katsoja näki tyhjän tulevan päivän yön
 * tulosten sijaan.
 */
export function getAamujaaDate(now = new Date()) {
    const today = toDateString(now);
    return helsinkiHour(now) < GAME_DAY_SWITCH_HOUR ? addDays(today, -1) : today;
}
