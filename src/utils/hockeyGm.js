/**
 * Hockey GM -jaksot (hockeygm.fi) GM-kalenteria varten.
 *
 * Jaksojen väliset päivät ovat Hockey GM:n vaihtoikkunoita eivätkä kuulu
 * mihinkään jaksoon. Päivitä päivämäärät joka kausi; pudotuspelijakso
 * lisätään, kun NHL julkaisee pudotuspelien aikataulun.
 */
export const GM_PERIODS = [
    { id: 1, start: '2026-09-29', end: '2026-11-01' },
    { id: 2, start: '2026-11-05', end: '2026-12-13' },
    { id: 3, start: '2026-12-17', end: '2027-01-24' },
    { id: 4, start: '2027-01-28', end: '2027-03-07' },
    { id: 5, start: '2027-03-11', end: '2027-04-10' },
    // { id: 6, playoffs: true, start: '2027-04-..', end: '2027-06-..' },
];

/** Käynnissä oleva jakso; vaihtoikkunassa seuraava, kauden jälkeen viimeinen. */
export function currentPeriod(today) {
    return GM_PERIODS.find((p) => today >= p.start && today <= p.end)
        ?? GM_PERIODS.find((p) => today < p.start)
        ?? GM_PERIODS.at(-1);
}
