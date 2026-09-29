/** Pelipaikat suomeksi kuten kotimaisissa tilastoissa. */
const POSITIONS = {
    fi: { C: 'KH', L: 'VL', R: 'OL', D: 'P', G: 'MV' },
    en: { C: 'C', L: 'LW', R: 'RW', D: 'D', G: 'G' },
};

export const positionLabel = (code, language = 'fi') =>
    POSITIONS[language === 'en' ? 'en' : 'fi'][code] ?? code ?? '';

export const isForward = (code) => code === 'C' || code === 'L' || code === 'R';

/** Pelipaikka kokonaisena kortin alaotsikkoon. */
const POSITION_NAMES = {
    fi: { C: 'Keskushyökkääjä', L: 'Vasen laitahyökkääjä', R: 'Oikea laitahyökkääjä', D: 'Puolustaja', G: 'Maalivahti' },
    en: { C: 'Centre', L: 'Left wing', R: 'Right wing', D: 'Defence', G: 'Goalie' },
};

export const positionName = (code, language = 'fi') =>
    POSITION_NAMES[language === 'en' ? 'en' : 'fi'][code] ?? code ?? '';

/** Laukaisu- tai kopituskäsi: "laukoo vasemmalta" / "kopittaa oikealla". */
export const handedness = (code, isGoalie, language = 'fi') => {
    if (code !== 'L' && code !== 'R') return null;
    if (language === 'en') return isGoalie ? `catches ${code === 'L' ? 'left' : 'right'}` : `shoots ${code === 'L' ? 'left' : 'right'}`;
    if (isGoalie) return code === 'L' ? 'kopittaa vasemmalla' : 'kopittaa oikealla';
    return code === 'L' ? 'laukoo vasemmalta' : 'laukoo oikealta';
};
