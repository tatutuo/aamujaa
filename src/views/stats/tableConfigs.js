import { int, dec, pct, signed, clock, per60 } from '../../utils/format';
import { isForward } from '../../utils/positions';
import { teamByAbbrev } from '../../utils/teams';

/**
 * Tilastotaulukoiden sarakeryhmät.
 *
 * Kerralla näkyy korkeintaan viisi lukusaraketta: niin paljon mahtuu
 * puhelimen leveydelle (375 px) ilman sivuttaisvieritystä, joka rikkoisi
 * kiinteän otsikkorivin. Loput tilastot ovat omissa ryhmissään, joita
 * vaihdetaan valitsimella.
 *
 * Otsikot ovat kaksikielisiä olioita, jotka näkymä muuntaa valitulle kielelle.
 * Lyhenteet noudattavat kotimaisia tilastoja (O, M, S, P, JM, YV, AV).
 */

// Apu: sarake, jonka muotoilu saa kielen parametrina.
const col = (key, label, title, extra = {}) => ({ key, label, title, ...extra });

// --- Kenttäpelaajat ---------------------------------------------------------

const skaterPer60 = (field) => (row) => per60(row[field], row.toi, row.gp);

export const SKATER_GROUPS = [
    {
        id: 'basic',
        label: { fi: 'Perus', en: 'Basic' },
        columns: [
            col('gp', { fi: 'O', en: 'GP' }, { fi: 'Ottelut', en: 'Games played' }, { format: int }),
            col('goals', { fi: 'M', en: 'G' }, { fi: 'Maalit', en: 'Goals' }, { format: int }),
            col('assists', { fi: 'S', en: 'A' }, { fi: 'Syötöt', en: 'Assists' }, { format: int }),
            col('points', { fi: 'P', en: 'P' }, { fi: 'Pisteet', en: 'Points' }, { format: int }),
            col('plusMinus', { fi: '+/−', en: '+/−' }, { fi: 'Plusmiinus', en: 'Plus-minus' }, { format: signed }),
        ],
    },
    {
        id: 'special',
        label: { fi: 'Erikoistilanteet', en: 'Special teams' },
        columns: [
            col('ppGoals', { fi: 'YVM', en: 'PPG' }, { fi: 'Ylivoimamaalit', en: 'Power-play goals' }, { format: int }),
            col('ppPoints', { fi: 'YVP', en: 'PPP' }, { fi: 'Ylivoimapisteet', en: 'Power-play points' }, { format: int }),
            col('shGoals', { fi: 'AVM', en: 'SHG' }, { fi: 'Alivoimamaalit', en: 'Shorthanded goals' }, { format: int }),
            col('gwg', { fi: 'VM', en: 'GWG' }, { fi: 'Voittomaalit', en: 'Game-winning goals' }, { format: int }),
            col('otGoals', { fi: 'JAM', en: 'OTG' }, { fi: 'Jatkoaikamaalit', en: 'Overtime goals' }, { format: int }),
        ],
    },
    {
        id: 'shots',
        label: { fi: 'Laukaukset', en: 'Shots' },
        columns: [
            col('shots', { fi: 'L', en: 'S' }, { fi: 'Laukaukset maalia kohti', en: 'Shots on goal' }, { format: int }),
            col('shootingPct', { fi: 'L%', en: 'S%' }, { fi: 'Laukaisuprosentti', en: 'Shooting percentage' }, { format: (v, _r, l) => pct(v, 1, l), rate: true }),
            col('shotAttempts', { fi: 'YR', en: 'ATT' }, { fi: 'Laukaisuyritykset', en: 'Shot attempts' }, { format: int }),
            col('missedShots', { fi: 'Ohi', en: 'Miss' }, { fi: 'Ohi menneet', en: 'Missed shots' }, { format: int }),
            col('posts', { fi: 'Rima', en: 'Iron' }, { fi: 'Tolppaan tai rimaan', en: 'Posts and crossbars' }, { format: int }),
        ],
    },
    {
        id: 'physical',
        label: { fi: 'Fyysiset', en: 'Physical' },
        columns: [
            col('hits', { fi: 'Takl', en: 'Hits' }, { fi: 'Taklaukset', en: 'Hits' }, { format: int }),
            col('blocks', { fi: 'Blok', en: 'Blk' }, { fi: 'Blokatut laukaukset', en: 'Blocked shots' }, { format: int }),
            col('takeaways', { fi: 'Riist', en: 'TK' }, { fi: 'Riistot', en: 'Takeaways' }, { format: int }),
            col('giveaways', { fi: 'Men', en: 'GV' }, { fi: 'Menetykset', en: 'Giveaways' }, { format: int, lowerIsBetter: true }),
            col('pim', { fi: 'JM', en: 'PIM' }, { fi: 'Jäähyminuutit', en: 'Penalty minutes' }, { format: int }),
        ],
    },
    {
        id: 'rates',
        label: { fi: 'Tehokkuus', en: 'Rates' },
        columns: [
            col('pointsPerGame', { fi: 'P/O', en: 'P/GP' }, { fi: 'Pisteet per ottelu', en: 'Points per game' }, { format: (v, _r, l) => dec(v, 2, l), rate: true }),
            col('p60', { fi: 'P/60', en: 'P/60' }, { fi: 'Pisteet 60 minuutissa', en: 'Points per 60 minutes' }, { value: skaterPer60('points'), format: (v, _r, l) => dec(v, 2, l), rate: true }),
            col('g60', { fi: 'M/60', en: 'G/60' }, { fi: 'Maalit 60 minuutissa', en: 'Goals per 60 minutes' }, { value: skaterPer60('goals'), format: (v, _r, l) => dec(v, 2, l), rate: true }),
            col('toi', { fi: 'Aika', en: 'TOI' }, { fi: 'Peliaika per ottelu', en: 'Time on ice per game' }, { format: clock, width: '52px' }),
            col('faceoffPct', { fi: 'Al%', en: 'FO%' }, { fi: 'Aloitusvoitot (vähintään 50 aloitusta)', en: 'Faceoff win % (min. 50 faceoffs)' }, { format: (v, _r, l) => pct(v, 1, l), rate: true }),
        ],
    },
];

export const SKATER_FILTERS = [
    { value: 'all', label: { fi: 'Kaikki', en: 'All' } },
    { value: 'F', label: { fi: 'Hyökkääjät', en: 'Forwards' }, test: (r) => isForward(r.pos) },
    { value: 'D', label: { fi: 'Puolustajat', en: 'Defence' }, test: (r) => r.pos === 'D' },
    { value: 'rookie', label: { fi: 'Tulokkaat', en: 'Rookies' }, test: (r) => r.rookie },
];

// --- Maalivahdit -----------------------------------------------------------

export const GOALIE_GROUPS = [
    {
        id: 'basic',
        label: { fi: 'Perus', en: 'Basic' },
        columns: [
            col('gp', { fi: 'O', en: 'GP' }, { fi: 'Ottelut', en: 'Games played' }, { format: int }),
            col('wins', { fi: 'V', en: 'W' }, { fi: 'Voitot', en: 'Wins' }, { format: int }),
            col('savePct', { fi: 'T%', en: 'SV%' }, { fi: 'Torjuntaprosentti', en: 'Save percentage' }, { format: (v, _r, l) => pct(v, 1, l), rate: true }),
            col('gaa', { fi: 'PÄM', en: 'GAA' }, { fi: 'Päästetyt maalit per ottelu', en: 'Goals against average' }, { format: (v, _r, l) => dec(v, 2, l), rate: true, lowerIsBetter: true }),
            col('shutouts', { fi: 'NP', en: 'SO' }, { fi: 'Nollapelit', en: 'Shutouts' }, { format: int }),
        ],
    },
    {
        id: 'record',
        label: { fi: 'Tulokset', en: 'Record' },
        columns: [
            col('gs', { fi: 'Al', en: 'GS' }, { fi: 'Aloitukset', en: 'Games started' }, { format: int }),
            col('wins', { fi: 'V', en: 'W' }, { fi: 'Voitot', en: 'Wins' }, { format: int }),
            col('losses', { fi: 'H', en: 'L' }, { fi: 'Häviöt', en: 'Losses' }, { format: int, lowerIsBetter: true }),
            col('otLosses', { fi: 'JAH', en: 'OTL' }, { fi: 'Jatkoaikahäviöt', en: 'Overtime losses' }, { format: int, lowerIsBetter: true }),
            col('winPct', { fi: 'V%', en: 'W%' }, { fi: 'Voittoprosentti aloituksista', en: 'Win % of starts' }, { value: (r) => (r.gs ? r.wins / r.gs : null), format: (v, _r, l) => pct(v, 1, l), rate: true }),
        ],
    },
    {
        id: 'workload',
        label: { fi: 'Työmäärä', en: 'Workload' },
        columns: [
            col('saves', { fi: 'Torj', en: 'SV' }, { fi: 'Torjunnat', en: 'Saves' }, { format: int }),
            col('shotsAgainst', { fi: 'LV', en: 'SA' }, { fi: 'Laukaukset vastaan', en: 'Shots against' }, { format: int }),
            col('goalsAgainst', { fi: 'PM', en: 'GA' }, { fi: 'Päästetyt maalit', en: 'Goals against' }, { format: int }),
            col('sa60', { fi: 'LV/60', en: 'SA/60' }, { fi: 'Laukaukset vastaan 60 minuutissa', en: 'Shots against per 60' }, { value: (r) => (r.toiTotal ? (r.shotsAgainst / r.toiTotal) * 3600 : null), format: (v, _r, l) => dec(v, 1, l), rate: true, width: '50px' }),
            col('toiPerGame', { fi: 'Aika', en: 'TOI' }, { fi: 'Peliaika per ottelu', en: 'Time on ice per game' }, { value: (r) => (r.gp ? r.toiTotal / r.gp : null), format: clock, width: '52px' }),
        ],
    },
];

export const GOALIE_FILTERS = [
    { value: 'all', label: { fi: 'Kaikki', en: 'All' } },
    { value: 'rookie', label: { fi: 'Tulokkaat', en: 'Rookies' }, test: (r) => r.rookie },
];

// --- Joukkueet -------------------------------------------------------------

export const TEAM_GROUPS = [
    {
        id: 'basic',
        label: { fi: 'Perus', en: 'Basic' },
        columns: [
            col('gp', { fi: 'O', en: 'GP' }, { fi: 'Ottelut', en: 'Games played' }, { format: int }),
            col('wins', { fi: 'V', en: 'W' }, { fi: 'Voitot', en: 'Wins' }, { format: int }),
            col('losses', { fi: 'H', en: 'L' }, { fi: 'Häviöt', en: 'Losses' }, { format: int, lowerIsBetter: true }),
            col('otLosses', { fi: 'JAH', en: 'OTL' }, { fi: 'Jatkoaikahäviöt', en: 'Overtime losses' }, { format: int, lowerIsBetter: true }),
            col('points', { fi: 'P', en: 'PTS' }, { fi: 'Pisteet', en: 'Points' }, { format: int }),
        ],
    },
    {
        id: 'goals',
        label: { fi: 'Maalit', en: 'Goals' },
        columns: [
            col('goalsFor', { fi: 'TM', en: 'GF' }, { fi: 'Tehdyt maalit', en: 'Goals for' }, { format: int }),
            col('goalsAgainst', { fi: 'PM', en: 'GA' }, { fi: 'Päästetyt maalit', en: 'Goals against' }, { format: int, lowerIsBetter: true }),
            col('goalDiff', { fi: 'ME', en: 'DIFF' }, { fi: 'Maaliero', en: 'Goal differential' }, { format: signed }),
            col('gfPerGame', { fi: 'TM/O', en: 'GF/GP' }, { fi: 'Tehdyt maalit per ottelu', en: 'Goals for per game' }, { format: (v, _r, l) => dec(v, 2, l), width: '50px' }),
            col('gaPerGame', { fi: 'PM/O', en: 'GA/GP' }, { fi: 'Päästetyt maalit per ottelu', en: 'Goals against per game' }, { format: (v, _r, l) => dec(v, 2, l), lowerIsBetter: true, width: '50px' }),
        ],
    },
    {
        id: 'special',
        label: { fi: 'Erikoistilanteet', en: 'Special teams' },
        columns: [
            col('ppPct', { fi: 'YV%', en: 'PP%' }, { fi: 'Ylivoimaprosentti', en: 'Power-play percentage' }, { format: (v, _r, l) => pct(v, 1, l) }),
            col('pkPct', { fi: 'AV%', en: 'PK%' }, { fi: 'Alivoimaprosentti', en: 'Penalty-kill percentage' }, { format: (v, _r, l) => pct(v, 1, l) }),
            col('faceoffPct', { fi: 'Al%', en: 'FO%' }, { fi: 'Aloitusvoitot', en: 'Faceoff win percentage' }, { format: (v, _r, l) => pct(v, 1, l) }),
            col('shotsForPerGame', { fi: 'L/O', en: 'SF/GP' }, { fi: 'Laukaukset per ottelu', en: 'Shots for per game' }, { format: (v, _r, l) => dec(v, 1, l) }),
            col('shotsAgainstPerGame', { fi: 'LV/O', en: 'SA/GP' }, { fi: 'Laukaukset vastaan per ottelu', en: 'Shots against per game' }, { format: (v, _r, l) => dec(v, 1, l), lowerIsBetter: true }),
        ],
    },
    {
        id: 'play',
        label: { fi: 'Pelitapa', en: 'Play style' },
        columns: [
            col('corsiPct', { fi: 'CF%', en: 'CF%' }, { fi: 'Corsi: osuus laukaisuyrityksistä 5v5', en: 'Corsi: share of 5v5 shot attempts' }, { format: (v, _r, l) => pct(v, 1, l) }),
            col('hits', { fi: 'Takl', en: 'Hits' }, { fi: 'Taklaukset', en: 'Hits' }, { format: int }),
            col('blocks', { fi: 'Blok', en: 'Blk' }, { fi: 'Blokatut laukaukset', en: 'Blocked shots' }, { format: int }),
            col('takeaways', { fi: 'Riist', en: 'TK' }, { fi: 'Riistot', en: 'Takeaways' }, { format: int }),
            col('giveaways', { fi: 'Men', en: 'GV' }, { fi: 'Menetykset', en: 'Giveaways' }, { format: int, lowerIsBetter: true }),
        ],
    },
];

export const TEAM_FILTERS = [
    { value: 'all', label: { fi: 'Liiga', en: 'League' } },
    { value: 'Eastern', label: { fi: 'Itä', en: 'East' }, test: (r) => teamByAbbrev(r.team)?.conference === 'Eastern' },
    { value: 'Western', label: { fi: 'Länsi', en: 'West' }, test: (r) => teamByAbbrev(r.team)?.conference === 'Western' },
];
