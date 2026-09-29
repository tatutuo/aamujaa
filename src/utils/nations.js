/**
 * Kansallisuudet suodattimiin: NHL:n maakoodi -> nimi monikossa ("Suomalaiset").
 *
 * NHL käyttää sekä tilastoissa että kokoonpanoissa ISO-koodeja (DEU, CHE,
 * DNK, SVN) eikä olympiakoodeja (GER, SUI, DEN, SLO). Vanhat koodit
 * muunnetaan `normaliseNation`-funktiolla.
 */
export const NATION_NAMES = {
    FIN: { fi: 'Suomalaiset', en: 'Finns', country: { fi: 'Suomi', en: 'Finland' } },
    SWE: { fi: 'Ruotsalaiset', en: 'Swedes', country: { fi: 'Ruotsi', en: 'Sweden' } },
    CZE: { fi: 'Tšekit', en: 'Czechs', country: { fi: 'Tšekki', en: 'Czechia' } },
    SVK: { fi: 'Slovakit', en: 'Slovaks', country: { fi: 'Slovakia', en: 'Slovakia' } },
    CHE: { fi: 'Sveitsiläiset', en: 'Swiss', country: { fi: 'Sveitsi', en: 'Switzerland' } },
    DEU: { fi: 'Saksalaiset', en: 'Germans', country: { fi: 'Saksa', en: 'Germany' } },
    DNK: { fi: 'Tanskalaiset', en: 'Danes', country: { fi: 'Tanska', en: 'Denmark' } },
    LVA: { fi: 'Latvialaiset', en: 'Latvians', country: { fi: 'Latvia', en: 'Latvia' } },
    AUT: { fi: 'Itävaltalaiset', en: 'Austrians', country: { fi: 'Itävalta', en: 'Austria' } },
    NOR: { fi: 'Norjalaiset', en: 'Norwegians', country: { fi: 'Norja', en: 'Norway' } },
    SVN: { fi: 'Slovenialaiset', en: 'Slovenians', country: { fi: 'Slovenia', en: 'Slovenia' } },
    FRA: { fi: 'Ranskalaiset', en: 'French', country: { fi: 'Ranska', en: 'France' } },
    BLR: { fi: 'Valkovenäläiset', en: 'Belarusians', country: { fi: 'Valko-Venäjä', en: 'Belarus' } },
    USA: { fi: 'Amerikkalaiset', en: 'Americans', country: { fi: 'Yhdysvallat', en: 'United States' } },
    CAN: { fi: 'Kanadalaiset', en: 'Canadians', country: { fi: 'Kanada', en: 'Canada' } },
    RUS: { fi: 'Venäläiset', en: 'Russians', country: { fi: 'Venäjä', en: 'Russia' } },
};

/** Olympiakoodit ISO-koodeiksi (vanhat asetukset ja muut lähteet). */
const LEGACY_CODES = { GER: 'DEU', SUI: 'CHE', DEN: 'DNK', SLO: 'SVN', LAT: 'LVA' };

export const normaliseNation = (code) => LEGACY_CODES[code] ?? code;

export function nationPlural(code, language = 'fi') {
    return NATION_NAMES[normaliseNation(code)]?.[language === 'en' ? 'en' : 'fi'] ?? code;
}

/**
 * NHL käyttää maakoodeina sekaisin IOC- ja ISO-koodeja (DEN ja DNK, SUI ja
 * CHE). Listan ulkopuoliset maat nimetään selaimen omalla maaluettelolla,
 * joka tarvitsee kaksikirjaimisen ISO-koodin.
 */
const ISO2 = {
    DNK: 'DK', DEU: 'DE', CHE: 'CH', LAT: 'LV', SVN: 'SI', BLR: 'BY', KAZ: 'KZ', UKR: 'UA',
    FRA: 'FR', GBR: 'GB', AUS: 'AU', NLD: 'NL', POL: 'PL', JPN: 'JP', KOR: 'KR', ITA: 'IT',
    BRA: 'BR', JAM: 'JM', NGA: 'NG', ZAF: 'ZA', KOS: 'XK', HUN: 'HU', LTU: 'LT', EST: 'EE',
    BEL: 'BE', CHN: 'CN', TWN: 'TW', ROU: 'RO', HRV: 'HR', SRB: 'RS', BGR: 'BG', ISR: 'IL',
    MEX: 'MX', ARG: 'AR', VEN: 'VE', IRL: 'IE', ESP: 'ES', PRT: 'PT', GRC: 'GR', TUR: 'TR',
    EGY: 'EG', LBN: 'LB', HTI: 'HT', TZA: 'TZ', KEN: 'KE', GHA: 'GH', IND: 'IN', PHL: 'PH',
    NZL: 'NZ', ISL: 'IS', SCO: 'GB', ENG: 'GB', BRN: 'BN',
};

const displayNames = new Map();
function regionName(iso2, language) {
    try {
        if (!displayNames.has(language)) {
            displayNames.set(language, new Intl.DisplayNames([language === 'en' ? 'en' : 'fi'], { type: 'region' }));
        }
        return displayNames.get(language).of(iso2);
    } catch {
        return null;
    }
}

export function countryName(code, language = 'fi') {
    const lang = language === 'en' ? 'en' : 'fi';
    const key = normaliseNation(code);
    if (NATION_NAMES[key]) return NATION_NAMES[key].country[lang];
    const iso2 = ISO2[code];
    return (iso2 && regionName(iso2, lang)) || code;
}
