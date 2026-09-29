/**
 * Pelaajanimien lyhentäminen kapeisiin listoihin.
 *
 * Tilastolistoissa nimisarake jää kapeaksi, kun oikealla on kolme lukua
 * otsikoineen. Kokonaiset nimet katkesivat kesken ("Scott Wed…"), mikä on
 * pahempi kuin lyhenne: katkaistusta nimestä ei tunnista pelaajaa.
 */

/** Etunimen alkukirjaimet, yhdysnimet mukaan lukien: Ukko-Pekka -> U-P. */
const initials = (firstName) =>
    firstName
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase())
        .join('-');

/**
 * "Scott Wedgewood" -> "S. Wedgewood", "Ukko-Pekka Luukkonen" -> "U-P. Luukkonen".
 * Sukunimi säilyy aina kokonaan, koska se on se osa jolla pelaaja tunnistetaan.
 */
export function shortenPlayerName(name) {
    const value = String(name ?? '').trim();
    if (!value) return '';

    const parts = value.split(/\s+/);
    if (parts.length < 2) return value;

    const surname = parts.slice(1).join(' ');
    return `${initials(parts[0])}. ${surname}`;
}
