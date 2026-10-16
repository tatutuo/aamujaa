import { teamColors, DEFAULT_TEAM_COLORS } from './teamColors';

/**
 * Joukkueiden värit kaavioihin.
 *
 * Virallinen pääväri ei sellaisenaan aina toimi: Buffalon tummansininen ja
 * Los Angelesin musta katoavat tummaan taustaan, ja Detroitin valkoinen
 * vaaleaan. Kaaviossa käytetään siksi väriä, joka erottuu kummastakin
 * teemasta: pääväri, sen puuttuessa toinen väri, tai vaalennettu pääväri.
 * Vastakkaisille joukkueille varmistetaan lisäksi, etteivät värit ole
 * liian lähellä toisiaan (esim. kaksi punaista joukkuetta).
 */

const rgb = (hex) => {
    const n = parseInt(String(hex).replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = ([r, g, b]) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

function luminance(hex) {
    const channel = (c) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const [r, g, b] = rgb(hex);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

const usable = (hex) => {
    const l = luminance(hex);
    return l >= 0.035 && l <= 0.55;
};

/** Sekoitus kohti keskiharmaata: tumma väri vaalenee, säilyttää sävynsä. */
const lift = (hex, amount = 0.45) => {
    const [r, g, b] = rgb(hex);
    const [tr, tg, tb] = [150, 160, 172];
    return toHex([r + (tr - r) * amount, g + (tg - g) * amount, b + (tb - b) * amount]);
};

const distance = (a, b) => {
    const [r1, g1, b1] = rgb(a);
    const [r2, g2, b2] = rgb(b);
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
};

/**
 * Tummapohjaisten joukkueiden kaaviovärit käsin: virallinen pääväri on
 * niin tumma, ettei se erotu, ja toinen väri veisi joukkueelta sen
 * tunnistettavan sävyn (Vancouver ei ole vihreä eikä Minnesota punainen).
 * Nämä ovat pääväristä vaalennettuja, samansävyisiä värejä.
 */
const CHART_COLORS = {
    BUF: '#2f64c4', CBJ: '#3a5fae', COL: '#8c2f52', LAK: '#9aa3a8', MIN: '#2f8a5b',
    SEA: '#4da3a6', STL: '#2f5fd0', TBL: '#3366c2', TOR: '#2d64cc', UTA: '#5aa9db',
    VAN: '#2a5bb8', WPG: '#3d6fbf', WSH: '#c8102e', FLA: '#c8102e', NYR: '#2a5bd0',
    DAL: '#14875a',
};

/** Yhden joukkueen kaavioväri. */
export function chartColor(abbrev) {
    if (CHART_COLORS[abbrev]) return CHART_COLORS[abbrev];
    const [primary, secondary] = teamColors[abbrev] ?? DEFAULT_TEAM_COLORS;
    if (usable(primary)) return primary;
    if (usable(secondary)) return secondary;
    return lift(primary);
}

/** Kahden vastakkaisen joukkueen värit niin, että ne erottuvat toisistaan. */
export function pairColors(away, home) {
    const a = chartColor(away);
    let h = chartColor(home);
    if (distance(a, h) < 90) {
        // Kaksi samansävyistä (esim. TOR–TBL): kotijoukkueelle sen toinen
        // väri, jos se erottuu, muuten neutraali harmaa.
        const [, secondary] = teamColors[home] ?? DEFAULT_TEAM_COLORS;
        h = usable(secondary) && distance(a, secondary) >= 90 ? secondary : '#9aa4b0';
    }
    return { away: a, home: h };
}
