/**
 * Kaudet selaimen puolella. Sama sääntö kuin palvelimella
 * (server/src/lib/season.js): kausi vaihtuu 1.8.
 */
const ROLLOVER_MONTH = 8;

export function currentSeasonId(date = new Date()) {
    const year = date.getFullYear();
    const start = date.getMonth() + 1 >= ROLLOVER_MONTH ? year : year - 1;
    return `${start}${start + 1}`;
}

/** Kuluva ja edelliset kaudet uusimmasta vanhimpaan. */
export function recentSeasons(count = 10, date = new Date()) {
    const start = Number(currentSeasonId(date).slice(0, 4));
    return Array.from({ length: count }, (_, i) => `${start - i}${start - i + 1}`);
}
