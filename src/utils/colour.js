/**
 * Korostusväri suosikkijoukkueen väreistä.
 *
 * Joukkueiden virallinen pääväri on usein tummansininen (TOR #00205B,
 * WPG #041E42), joka katoaisi grafiittia vasten kokonaan. Siksi väriä ei
 * käytetä sellaisenaan: sävy ja kylläisyys säilyvät, mutta vaaleutta
 * nostetaan (tummassa teemassa) tai lasketaan (vaaleassa) kunnes väri on
 * luettava. Näin Leafs-fani saa sinisen ja Canes-fani punaisen, ja molemmat
 * ovat luettavia.
 *
 * Kaikki funktiot ovat puhtaita, jotta ne voi testata ilman selainta.
 */

/** Pienin hyväksytty kontrasti korostuksen ja korttipinnan välillä (WCAG AA). */
export const MIN_CONTRAST = 4.5;

/** Korttipinnat, joita vasten luettavuus mitataan (sama kuin tokens.css). */
const CARD_SURFACE = { dark: '#25292e', light: '#ffffff' };

/** Oletuskorostus, kun suosikkia ei ole tai sen väreistä ei saa kelvollista. */
export const DEFAULT_ACCENT = {
    dark: { accent: '#7cc8f5', accentStrong: '#3fa9e6', accentSoft: 'rgba(124, 200, 245, 0.15)', accentText: '#a5dafa', onAccent: '#0b1b27' },
    light: { accent: '#0971aa', accentStrong: '#0a6ea6', accentSoft: 'rgba(9, 113, 170, 0.11)', accentText: '#0a6ea6', onAccent: '#ffffff' },
};

export function hexToRgb(hex) {
    let h = String(hex).replace('#', '').trim();
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }) {
    const part = (v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
    return `#${part(r)}${part(g)}${part(b)}`;
}

export function rgbToHsl({ r, g, b }) {
    const [R, G, B] = [r / 255, g / 255, b / 255];
    const max = Math.max(R, G, B);
    const min = Math.min(R, G, B);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    return { h: h / 6, s, l };
}

export function hslToRgb({ h, s, l }) {
    if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (t) => {
        let x = t;
        if (x < 0) x += 1;
        if (x > 1) x -= 1;
        if (x < 1 / 6) return p + (q - p) * 6 * x;
        if (x < 1 / 2) return q;
        if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
        return p;
    };
    return { r: channel(h + 1 / 3) * 255, g: channel(h) * 255, b: channel(h - 1 / 3) * 255 };
}

/** Suhteellinen luminanssi (WCAG 2.x). */
export function luminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    const lin = (v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

/**
 * Siirtää värin vaaleutta askelittain kohti luettavaa. Sävy ja kylläisyys
 * pysyvät, joten joukkueen tunnistettava väri säilyy.
 */
export function ensureContrast(hex, surface, target = MIN_CONTRAST, direction = 'lighten') {
    const hsl = rgbToHsl(hexToRgb(hex));
    let colour = hex;
    for (let i = 0; i < 40 && contrast(colour, surface) < target; i += 1) {
        hsl.l = direction === 'lighten' ? Math.min(0.92, hsl.l + 0.02) : Math.max(0.08, hsl.l - 0.02);
        colour = rgbToHex(hslToRgb(hsl));
    }
    return contrast(colour, surface) >= target ? colour : null;
}

/**
 * Onko väri tarpeeksi kylläinen toimiakseen korostuksena? Musta, valkoinen
 * ja harmaat (LAK:n musta, TOR:n valkoinen) eivät kerro mitään joukkueesta,
 * vaikka ne olisivat luettavia.
 */
export function isVivid(hex) {
    const { s, l } = rgbToHsl(hexToRgb(hex));
    return s >= 0.35 && l > 0.06 && l < 0.94;
}

/** Heksaväri läpinäkyvyydellä, esim. taustahehkua varten. */
export function withAlpha(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Korostuksen muuttujat joukkueen väreistä.
 *
 * @param {string[]|undefined} teamColours [pääväri, toissijainen väri]
 * @param {'dark'|'light'} theme
 * @returns {{accent, accentStrong, accentSoft, accentText, onAccent}}
 */
export function accentFromTeam(teamColours, theme = 'dark') {
    const fallback = DEFAULT_ACCENT[theme] ?? DEFAULT_ACCENT.dark;
    if (!Array.isArray(teamColours)) return fallback;

    const surface = CARD_SURFACE[theme] ?? CARD_SURFACE.dark;
    const direction = theme === 'light' ? 'darken' : 'lighten';

    // Pääväri ensin; jos se on harmaa/musta/valkoinen, toissijainen.
    const base = teamColours.find((c) => typeof c === 'string' && c.startsWith('#') && isVivid(c));
    if (!base) return fallback;

    const accent = ensureContrast(base, surface, MIN_CONTRAST, direction);
    if (!accent) return fallback;

    // Tekstikäyttöön vielä selvästi luettavampi sävy (7:1), esim. linkit ja
    // taulukon lajiteltu sarake pienellä fontilla.
    const accentText = ensureContrast(accent, surface, 7, direction) ?? accent;

    // Voimakkaampi versio täytetyille painikkeille: toiseen suuntaan kuin tekstisävy.
    const accentStrong = ensureContrast(base, surface, 3, direction) ?? accent;

    // Täytetyn korostuspinnan päällä teksti on joko tumma tai valkoinen sen
    // mukaan, kumpi erottuu paremmin.
    const onAccent = contrast('#0b1b27', accent) >= contrast('#ffffff', accent) ? '#0b1b27' : '#ffffff';

    return {
        accent,
        accentStrong,
        accentSoft: withAlpha(accent, theme === 'light' ? 0.11 : 0.15),
        accentText,
        onAccent,
    };
}
