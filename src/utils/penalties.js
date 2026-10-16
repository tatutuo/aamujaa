/**
 * Jäähylajien nimet.
 *
 * NHL palauttaa jäähystä vain `descKey`-tunnisteen ("delaying-game-puck-over-glass").
 * Ottelukortti näytti sen sellaisenaan väliviivat välilyönneiksi vaihtaen, eli
 * käytännössä englanniksi. Tunnisteet on kerätty oikeista otteluista; lisäksi
 * mukana on sääntökirjan harvinaisempia lajeja, jotta nekin näkyvät suomeksi.
 *
 * Suomennokset noudattavat suomalaista sääntökirjaa ja Liigan sanastoa
 * (poikittainen maila, huitominen, väkivaltaisuus, laitataklaus), ei
 * sanasanaista käännöstä.
 * Huom. rangaistusten suomenkieliset nimet poikkeavat englannista:
 * misconduct = käytösrangaistus (10 min), game misconduct = pelirangaistus,
 * match penalty = ottelurangaistus.
 */

const FI = {
    tripping: 'Kampitus',
    hooking: 'Koukkaaminen',
    roughing: 'Väkivaltaisuus',
    interference: 'Estäminen',
    holding: 'Kiinnipitäminen',
    slashing: 'Huitominen',
    'high-sticking': 'Korkea maila',
    'high-sticking-double-minor': 'Korkea maila (2+2)',
    fighting: 'Tappelu',
    'cross-checking': 'Poikittainen maila',
    boarding: 'Laitataklaus',
    charging: 'Ryntäys',
    elbowing: 'Kyynärpäätaklaus',
    kneeing: 'Polvitaklaus',
    clipping: 'Matala taklaus',
    'checking-from-behind': 'Selästä taklaaminen',
    'illegal-check-to-head': 'Taklaus päähän',
    spearing: 'Keihästäminen',
    'butt-ending': 'Päittäminen',
    'head-butting': 'Päällä puskeminen',
    'holding-the-stick': 'Mailasta kiinnipitäminen',
    'interference-goalkeeper': 'Maalivahdin estäminen',
    'too-many-men-on-the-ice': 'Liian monta pelaajaa kentällä',
    'delaying-game': 'Pelin viivyttäminen',
    'delaying-game-puck-over-glass': 'Pelin viivyttäminen (kiekko katsomoon)',
    'delaying-game-unsuccessful-challenge': 'Pelin viivyttäminen (hylätty haaste)',
    'delaying-game-face-off-violation': 'Pelin viivyttäminen (aloitusrikkomus)',
    'delaying-game-bench': 'Pelin viivyttäminen (penkki)',
    'delaying-game-smothering-puck': 'Pelin viivyttäminen (kiekon peittäminen)',
    'closing-hand-on-puck': 'Kiekon sulkeminen käteen',
    'throwing-equipment': 'Varusteen heittäminen',
    'broken-stick': 'Rikkinäisellä mailalla pelaaminen',
    'playing-without-a-helmet': 'Pelaaminen ilman kypärää',
    'goalie-leave-crease': 'Maalivahti poistui maalialueeltaan',
    'unsportsmanlike-conduct': 'Epäurheilijamainen käytös',
    embellishment: 'Filmaaminen',
    'roughing-removing-opponents-helmet': 'Väkivaltaisuus (vastustajan kypärän riisuminen)',
    instigator: 'Tappelun aloittaminen',
    'instigator-misconduct': 'Tappelun aloittaminen, käytösrangaistus',
    'abusive-language': 'Sopimaton kielenkäyttö',
    'abuse-of-officials': 'Tuomarin loukkaaminen',
    misconduct: 'Käytösrangaistus',
    'game-misconduct': 'Pelirangaistus',
    'match-penalty': 'Ottelurangaistus',
    bench: 'Penkkirangaistus',
    'ps-tripping-on-breakaway': 'Rangaistuslaukaus: kampitus läpiajossa',
    'ps-hooking-on-breakaway': 'Rangaistuslaukaus: koukkaaminen läpiajossa',
    'ps-slashing-on-breakaway': 'Rangaistuslaukaus: huitominen läpiajossa',
    'ps-holding-on-breakaway': 'Rangaistuslaukaus: kiinnipitäminen läpiajossa',
};

/** Englanniksi vain ne, joiden tunniste ei sellaisenaan luettavaksi kelpaa. */
const EN = {
    'delaying-game-puck-over-glass': 'Delay of game: puck over glass',
    'delaying-game-unsuccessful-challenge': 'Delay of game: failed challenge',
    'delaying-game-face-off-violation': 'Delay of game: face-off violation',
    'delaying-game-smothering-puck': 'Delay of game: smothering puck',
    'high-sticking-double-minor': 'High-sticking, double minor',
    'roughing-removing-opponents-helmet': "Roughing: removing opponent's helmet",
    'ps-tripping-on-breakaway': 'Penalty shot: tripping on breakaway',
    'ps-hooking-on-breakaway': 'Penalty shot: hooking on breakaway',
    'ps-slashing-on-breakaway': 'Penalty shot: slashing on breakaway',
    'ps-holding-on-breakaway': 'Penalty shot: holding on breakaway',
    'goalie-leave-crease': 'Goalie leaving the crease',
    'interference-goalkeeper': 'Goaltender interference',
};

/** Tuntematon tunniste näytetään siistittynä, ei tyhjänä. */
const humanize = (key) => {
    const words = key.replace(/-/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
};

export function penaltyName(descKey, isFinnish) {
    if (!descKey) return '';
    if (isFinnish) return FI[descKey] ?? humanize(descKey);
    return EN[descKey] ?? humanize(descKey);
}
