/**
 * Jäähylajien nimet.
 *
 * NHL palauttaa jäähystä vain `descKey`-tunnisteen ("delaying-game-puck-over-glass").
 * Ottelukortti näytti sen sellaisenaan väliviivat välilyönneiksi vaihtaen, eli
 * käytännössä englanniksi. Nämä on kerätty 120 ottelun aineistosta, joten
 * mukana ovat kaikki lajit jotka oikeasti esiintyvät — ei arvauksia.
 *
 * Suomennokset noudattavat kotimaista kiekkosanastoa (kampitus, koukkaaminen,
 * estäminen), ei sanasanaista käännöstä englannista.
 */

const FI = {
    tripping: 'Kampitus',
    hooking: 'Koukkaaminen',
    roughing: 'Kovaotteinen peli',
    interference: 'Estäminen',
    holding: 'Kiinnipitäminen',
    slashing: 'Mailalla lyöminen',
    'high-sticking': 'Korkea maila',
    fighting: 'Tappelu',
    'cross-checking': 'Ristitaklaus',
    'delaying-game-puck-over-glass': 'Pelin viivyttäminen: kiekko katsomoon',
    'too-many-men-on-the-ice': 'Liikaa pelaajia jäällä',
    'holding-the-stick': 'Mailasta kiinni pitäminen',
    'delaying-game-unsuccessful-challenge': 'Pelin viivyttäminen: hylätty haaste',
    misconduct: 'Pelirangaistus',
    'unsportsmanlike-conduct': 'Epäurheilijamainen käytös',
    boarding: 'Laitataklaus',
    'interference-goalkeeper': 'Maalivahdin estäminen',
    'high-sticking-double-minor': 'Korkea maila, kaksoispieni',
    'roughing-removing-opponents-helmet': 'Vastustajan kypärän riisuminen',
    instigator: 'Tappelun aloittaja',
    'instigator-misconduct': 'Tappelun aloittaja, pelirangaistus',
    'delaying-game-face-off-violation': 'Aloitusrikkomus',
    embellishment: 'Näytteleminen',
    elbowing: 'Kyynärpäätaklaus',
    'delaying-game': 'Pelin viivyttäminen',
    'goalie-leave-crease': 'Maalivahti poistui alueeltaan',
    'game-misconduct': 'Ottelurangaistus',
    'illegal-check-to-head': 'Taklaus päähän',
    'abuse-of-officials': 'Tuomarin arvostelu',
    'closing-hand-on-puck': 'Kiekon sulkeminen käteen',
    bench: 'Penkkirangaistus',
    'delaying-game-bench': 'Pelin viivyttäminen, penkki',
    'ps-tripping-on-breakaway': 'Rangaistuslaukaus: kampitus läpiajossa',
    'playing-without-a-helmet': 'Pelaaminen ilman kypärää',
    'abusive-language': 'Sopimaton kielenkäyttö',
};

/** Englanniksi vain ne, joiden tunniste ei sellaisenaan luettavaksi kelpaa. */
const EN = {
    'delaying-game-puck-over-glass': 'Delay of game: puck over glass',
    'delaying-game-unsuccessful-challenge': 'Delay of game: failed challenge',
    'delaying-game-face-off-violation': 'Delay of game: face-off violation',
    'high-sticking-double-minor': 'High-sticking, double minor',
    'roughing-removing-opponents-helmet': "Roughing: removing opponent's helmet",
    'ps-tripping-on-breakaway': 'Penalty shot: tripping on breakaway',
    'goalie-leave-crease': 'Goalie leaving the crease',
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
