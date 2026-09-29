/**
 * Joukkueiden viralliset värit muodossa [taustaväri, reunaväri].
 *
 * Omassa tiedostossaan komponentin sijaan, jotta Viten fast refresh toimii
 * (komponenttitiedosto saa viedä vain komponentteja) ja jotta värejä voi
 * käyttää muuallakin ilman riippuvuutta TeamBadgeen.
 */
export const teamColors = {
    ANA: ['#F47A38', '#000000'], BOS: ['#FFB81C', '#000000'], BUF: ['#002654', '#FCB514'],
    CAR: ['#CE1126', '#000000'], CBJ: ['#002654', '#CE1126'], CGY: ['#C8102E', '#F1BE48'],
    CHI: ['#CF0A2C', '#000000'], COL: ['#6F263D', '#236192'], DAL: ['#006847', '#8F8F8C'],
    DET: ['#CE1126', '#FFFFFF'], EDM: ['#FF4C00', '#00205B'], FLA: ['#C8102E', '#041E42'],
    LAK: ['#111111', '#A2AAAD'], MIN: ['#154734', '#A6192E'], MTL: ['#AF1E2D', '#192168'],
    NJD: ['#CE1126', '#000000'], NSH: ['#FFB81C', '#041E42'], NYI: ['#00539B', '#F47A38'],
    NYR: ['#0038A8', '#CE1126'], OTT: ['#C52032', '#000000'], PHI: ['#F74902', '#000000'],
    PIT: ['#FCB514', '#000000'], SEA: ['#001628', '#99D9D9'], SJS: ['#006D75', '#EA7200'],
    STL: ['#002F87', '#FCB514'], TBL: ['#002868', '#FFFFFF'], TOR: ['#00205B', '#FFFFFF'],
    UTA: ['#01265B', '#71C5E8'], VAN: ['#00205B', '#00843D'], VGK: ['#B4975A', '#333F48'],
    WPG: ['#041E42', '#004C97'], WSH: ['#041E42', '#C8102E'],
};

export const DEFAULT_TEAM_COLORS = ['#444', 'transparent'];
