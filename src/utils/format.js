/**
 * Lukujen muotoilu taulukoihin.
 *
 * Suomeksi desimaalierotin on pilkku ("61,2 %"), englanniksi piste. Aiemmin
 * sovellus näytti kaikkialla pisteen, mikä näytti suomenkielisessä
 * käyttöliittymässä käännösvirheeltä.
 */

const formatters = new Map();

function numberFormat(language, decimals) {
    const key = `${language}:${decimals}`;
    if (!formatters.has(key)) {
        formatters.set(key, new Intl.NumberFormat(language === 'en' ? 'en-US' : 'fi-FI', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }));
    }
    return formatters.get(key);
}

const EMPTY = '–';

const missing = (v) => v === null || v === undefined || Number.isNaN(v);

/** Kokonaisluku. */
export const int = (v) => (missing(v) ? EMPTY : String(Math.round(v)));

/** Desimaaliluku kieliasun mukaan. */
export const dec = (v, decimals = 2, language = 'fi') =>
    (missing(v) ? EMPTY : numberFormat(language, decimals).format(v));

/** Osuus (0–1) prosentteina ilman %-merkkiä: 0.612 -> "61,2". */
export const pct = (v, decimals = 1, language = 'fi') =>
    (missing(v) ? EMPTY : numberFormat(language, decimals).format(v * 100));

/** Plusmiinus etumerkillä: 5 -> "+5", -3 -> "−3" (oikea miinusmerkki). */
export const signed = (v) => {
    if (missing(v)) return EMPTY;
    if (v > 0) return `+${v}`;
    if (v < 0) return `−${Math.abs(v)}`;
    return '0';
};

/** Peliaika sekunneista: 1379 -> "22:59". */
export const clock = (seconds) => {
    if (missing(seconds)) return EMPTY;
    const total = Math.round(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** Kausitunniste luettavaksi: "20252026" -> "2025–26". */
export const seasonLabel = (seasonId) => {
    const s = String(seasonId ?? '');
    return s.length === 8 ? `${s.slice(0, 4)}–${s.slice(6)}` : s;
};

/** Per 60 minuuttia: määrä / (peliaika per ottelu × ottelut / 3600). */
export const per60 = (count, toiPerGame, gp) => {
    if (missing(count) || !toiPerGame || !gp) return null;
    const hours = (toiPerGame * gp) / 3600;
    return hours > 0 ? count / hours : null;
};

/** Ikä täysinä vuosina syntymäajasta ("1997-07-26"). */
export const ageFrom = (birthDate, today = new Date()) => {
    if (!birthDate) return null;
    const born = new Date(`${birthDate}T12:00:00`);
    let age = today.getFullYear() - born.getFullYear();
    const hadBirthday = today.getMonth() > born.getMonth()
        || (today.getMonth() === born.getMonth() && today.getDate() >= born.getDate());
    if (!hadBirthday) age -= 1;
    return age;
};

/** Päivämäärä lyhyesti: "2026-06-14" -> "14.6." (fi) / "Jun 14" (en). */
export const shortDate = (iso, language = 'fi') => {
    if (!iso) return EMPTY;
    const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
    return language === 'en'
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : `${d.getDate()}.${d.getMonth() + 1}.`;
};

/** Syntymäaika luettavaksi: "1997-07-26" -> "26.7.1997". */
export const longDate = (iso, language = 'fi') => {
    if (!iso) return EMPTY;
    const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
    return d.toLocaleDateString(language === 'en' ? 'en-US' : 'fi-FI', { day: 'numeric', month: language === 'en' ? 'short' : 'numeric', year: 'numeric' });
};
