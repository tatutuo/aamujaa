/**
 * Päivämääräapurit.
 *
 * Korjaa vanhan version bugin: date.toISOString().split('T')[0] antaa UTC-päivän.
 * Suomessa (UTC+2/+3) se tarkoittaa, että joka ilta klo 22 jälkeen sovellus
 * pyysi jo seuraavan päivän otteluita — eli juuri silloin kun NHL-ottelut ovat
 * alkamassa ja käyttäjä katsoo sovellusta.
 */

export function toApiDate(date) {
    return date.toLocaleDateString('en-CA');
}

/** Kellonaika, jolloin etusivu siirtyy seuraavaan ottelukierrokseen. */
export const GAME_DAY_SWITCH_HOUR = 18;

const TIMEZONE = 'Europe/Helsinki';

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
 *
 * Aika luetaan Suomen vyöhykkeeltä eikä laitteen omasta kellosta: sovellus on
 * tehty suomalaiselle ottelukierrokselle, joten ulkomailla katsova näkee saman
 * kierroksen kuin kotona.
 */
export function getGameDayDate(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(now);

    const part = (type) => parts.find((p) => p.type === type)?.value;

    // Keskipäivä paikallista aikaa: näin päivämäärä ei karkaa naapuripäivään
    // kun Date muotoillaan myöhemmin laitteen omalla vyöhykkeellä.
    const date = new Date(`${part('year')}-${part('month')}-${part('day')}T12:00:00`);

    return Number(part('hour')) < GAME_DAY_SWITCH_HOUR ? addDays(date, -1) : date;
}

export function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

export function isSameDay(a, b) {
    return toApiDate(a) === toApiDate(b);
}

export function formatShort(date) {
    return `${date.getDate()}.${date.getMonth() + 1}.`;
}

export function formatLong(date, language = 'fi') {
    return date
        .toLocaleDateString(language === 'fi' ? 'fi-FI' : 'en-US', {
            weekday: 'short',
            day: 'numeric',
            month: 'long',
        })
        .toUpperCase();
}
