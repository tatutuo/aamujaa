/**
 * NHL-joukkueiden perustiedot. Käytetään hakuun ja lyhenteiden validointiin.
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

const ABBREV_SET = new Set(NHL_TEAMS.map((t) => t.abbrev));

/**
 * Validoi joukkuelyhenteen ennen kuin se päätyy ulkoiseen URL-polkuun.
 * Vanha koodi liitti req.params.abbrev suoraan URL:iin ilman tarkistusta.
 */
export function isValidAbbrev(value) {
    return typeof value === 'string' && ABBREV_SET.has(value.toUpperCase());
}

/** Aksentit pois ja pienaakkosiksi, jotta "Montréal" ja "Montreal" täsmäävät. */
const normalizeName = (name) =>
    (name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const NAME_TO_ABBREV = new Map(NHL_TEAMS.map((t) => [normalizeName(t.name), t.abbrev]));

/**
 * Joukkueen koko nimi -> lyhenne.
 *
 * Tilastorajapinnan joukkueraportit palauttavat vain koko nimen
 * (`teamFullName`), joten lyhenne on johdettava siitä. Tarvitaan sekä
 * ennustemallissa että edistyneissä tilastoissa.
 */
export function abbrevFromName(teamFullName) {
    const normalized = normalizeName(teamFullName);
    if (NAME_TO_ABBREV.has(normalized)) return NAME_TO_ABBREV.get(normalized);

    // Joukkue on voinut vaihtaa nimeä kesken kauden (esim. Utah), jolloin
    // verrataan lempinimeen eli nimen viimeiseen sanaan.
    for (const [name, abbrev] of NAME_TO_ABBREV) {
        if (normalized.endsWith(name.split(' ').pop())) return abbrev;
    }
    return null;
}
