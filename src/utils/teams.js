/**
 * NHL-joukkueet selaimen puolella: lyhenne, nimi, konferenssi ja divisioona.
 *
 * Sama luettelo kuin palvelimen server/src/lib/teams.js. Pidetään erillään,
 * koska selain ja palvelin käännetään eri paketeiksi; muutos tehdään
 * molempiin.
 */
export const NHL_TEAMS = [
    { abbrev: 'ANA', name: 'Anaheim Ducks', conference: 'Western', division: 'Pacific' },
    { abbrev: 'BOS', name: 'Boston Bruins', conference: 'Eastern', division: 'Atlantic' },
    { abbrev: 'BUF', name: 'Buffalo Sabres', conference: 'Eastern', division: 'Atlantic' },
    { abbrev: 'CAR', name: 'Carolina Hurricanes', conference: 'Eastern', division: 'Metropolitan' },
    { abbrev: 'CBJ', name: 'Columbus Blue Jackets', conference: 'Eastern', division: 'Metropolitan' },
    { abbrev: 'CGY', name: 'Calgary Flames', conference: 'Western', division: 'Pacific' },
    { abbrev: 'CHI', name: 'Chicago Blackhawks', conference: 'Western', division: 'Central' },
    { abbrev: 'COL', name: 'Colorado Avalanche', conference: 'Western', division: 'Central' },
    { abbrev: 'DAL', name: 'Dallas Stars', conference: 'Western', division: 'Central' },
    { abbrev: 'DET', name: 'Detroit Red Wings', conference: 'Eastern', division: 'Atlantic' },
    { abbrev: 'EDM', name: 'Edmonton Oilers', conference: 'Western', division: 'Pacific' },
    { abbrev: 'FLA', name: 'Florida Panthers', conference: 'Eastern', division: 'Atlantic' },
    { abbrev: 'LAK', name: 'Los Angeles Kings', conference: 'Western', division: 'Pacific' },
    { abbrev: 'MIN', name: 'Minnesota Wild', conference: 'Western', division: 'Central' },
    { abbrev: 'MTL', name: 'Montréal Canadiens', conference: 'Eastern', division: 'Atlantic' },
    { abbrev: 'NJD', name: 'New Jersey Devils', conference: 'Eastern', division: 'Metropolitan' },
    { abbrev: 'NSH', name: 'Nashville Predators', conference: 'Western', division: 'Central' },
    { abbrev: 'NYI', name: 'New York Islanders', conference: 'Eastern', division: 'Metropolitan' },
    { abbrev: 'NYR', name: 'New York Rangers', conference: 'Eastern', division: 'Metropolitan' },
    { abbrev: 'OTT', name: 'Ottawa Senators', conference: 'Eastern', division: 'Atlantic' },
    { abbrev: 'PHI', name: 'Philadelphia Flyers', conference: 'Eastern', division: 'Metropolitan' },
    { abbrev: 'PIT', name: 'Pittsburgh Penguins', conference: 'Eastern', division: 'Metropolitan' },
    { abbrev: 'SEA', name: 'Seattle Kraken', conference: 'Western', division: 'Pacific' },
    { abbrev: 'SJS', name: 'San Jose Sharks', conference: 'Western', division: 'Pacific' },
    { abbrev: 'STL', name: 'St. Louis Blues', conference: 'Western', division: 'Central' },
    { abbrev: 'TBL', name: 'Tampa Bay Lightning', conference: 'Eastern', division: 'Atlantic' },
    { abbrev: 'TOR', name: 'Toronto Maple Leafs', conference: 'Eastern', division: 'Atlantic' },
    { abbrev: 'UTA', name: 'Utah Mammoth', conference: 'Western', division: 'Central' },
    { abbrev: 'VAN', name: 'Vancouver Canucks', conference: 'Western', division: 'Pacific' },
    { abbrev: 'VGK', name: 'Vegas Golden Knights', conference: 'Western', division: 'Pacific' },
    { abbrev: 'WPG', name: 'Winnipeg Jets', conference: 'Western', division: 'Central' },
    { abbrev: 'WSH', name: 'Washington Capitals', conference: 'Eastern', division: 'Metropolitan' },
];

/** Lyhenteet aakkosjärjestyksessä (esim. korostusvärin valintaan). */
export const NHL_TEAM_ABBREVS = NHL_TEAMS.map((t) => t.abbrev).sort();

const BY_ABBREV = new Map(NHL_TEAMS.map((t) => [t.abbrev, t]));

/** Joukkueen tiedot lyhenteellä, tai null. */
export function teamByAbbrev(abbrev) {
    return BY_ABBREV.get(String(abbrev ?? '').toUpperCase()) ?? null;
}

/**
 * Lempinimet ilman kaupunkia ("Maple Leafs", "Golden Knights"). Kovakoodattu,
 * koska kaupungin ja lempinimen rajaa ei voi päätellä nimestä luotettavasti
 * (Vegas Golden Knights, St. Louis Blues, Utah Mammoth).
 */
const NICKNAMES = {
    ANA: 'Ducks', BOS: 'Bruins', BUF: 'Sabres', CAR: 'Hurricanes', CBJ: 'Blue Jackets',
    CGY: 'Flames', CHI: 'Blackhawks', COL: 'Avalanche', DAL: 'Stars', DET: 'Red Wings',
    EDM: 'Oilers', FLA: 'Panthers', LAK: 'Kings', MIN: 'Wild', MTL: 'Canadiens',
    NJD: 'Devils', NSH: 'Predators', NYI: 'Islanders', NYR: 'Rangers', OTT: 'Senators',
    PHI: 'Flyers', PIT: 'Penguins', SEA: 'Kraken', SJS: 'Sharks', STL: 'Blues',
    TBL: 'Lightning', TOR: 'Maple Leafs', UTA: 'Mammoth', VAN: 'Canucks', VGK: 'Golden Knights',
    WPG: 'Jets', WSH: 'Capitals',
};

export const teamNickname = (abbrev) => NICKNAMES[String(abbrev ?? '').toUpperCase()] ?? abbrev ?? '';
