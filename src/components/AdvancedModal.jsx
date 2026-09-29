import React, { useState } from 'react';
import Sheet from './Sheet';
import TeamBadge from './TeamBadge';
import { api } from '../utils/api';
import { shortenPlayerName } from '../utils/names';
import { useFetchWhenOpen } from '../hooks/useModal';

/**
 * Edistyneet tilastot.
 *
 * NHL:n tilastorajapinnassa on yli 600 mittaria. Tähän on valittu ne, jotka
 * kertovat jotain mitä perustilastot eivät kerro, ja jokaisen kohdalla on
 * selitetty mitä luku tarkoittaa — pelkkä "SAT% 0,591" ei auta ketään.
 */

const VIEWS = {
    fi: [
        { category: 'skater', view: 'possession', label: 'Kiekonhallinta',
          hint: 'Corsi = kaikki laukausyritykset jäällä ollessa. Yli 50 % tarkoittaa, että joukkue hallitsee kiekkoa pelaajan ollessa jäällä.' },
        { category: 'skater', view: 'scoring', label: 'Tuotto per 60 min',
          hint: 'Pisteet suhteutettuna peliaikaan. Paljastaa tehokkuuden pelaajilta, jotka eivät saa suurta jääaikaa.' },
        { category: 'skater', view: 'physical', label: 'Fyysinen peli',
          hint: 'Taklaukset, blokit, riistot ja menetykset — myös per 60 minuuttia.' },
        { category: 'skater', view: 'icetime', label: 'Peliaika',
          hint: 'Jääaika tilanteittain sekä vuorojen määrä ja pituus.' },
        { category: 'skater', view: 'shots', label: 'Laukaustyypit',
          hint: 'Mistä laukaustyypistä maalit syntyvät.' },
        { category: 'skater', view: 'discipline', label: 'Kurinalaisuus',
          hint: 'Otetut jäähyt ja jäähyt, joissa pelaaja oli rikkeen kohteena. Vastustajan rikkeisiin ajaminen on aliarvostettu taito.' },
        { category: 'goalie', view: 'advanced', label: 'Maalivahdit',
          hint: 'Vakuuttava ottelu = torjuntaprosentti vähintään liigan keskitasoa. Kertoo tasaisuudesta enemmän kuin keskiarvo.' },
        { category: 'goalie', view: 'rest', label: 'MV ja lepo',
          hint: 'Torjuntaprosentti lepopäivien mukaan. Näkyykö väsymys, kun ottelut ovat peräkkäisinä päivinä?' },
        { category: 'team', view: 'possession', label: 'Joukkueet',
          hint: 'PDO = laukaisu- ja torjuntaprosentin summa. Kaukana 100:sta oleva luku palautuu yleensä keskiarvoon.' },
        { category: 'team', view: 'situational', label: 'Tilannepeli',
          hint: 'Miten käy kun joukkue tekee tai päästää ensimmäisen maalin.' },
    ],
    en: [
        { category: 'skater', view: 'possession', label: 'Possession', hint: 'Corsi: all shot attempts while on ice. Over 50% means the team controls the puck with this player out there.' },
        { category: 'skater', view: 'scoring', label: 'Rate per 60', hint: 'Points relative to ice time. Reveals efficiency in players with limited minutes.' },
        { category: 'skater', view: 'physical', label: 'Physical', hint: 'Hits, blocks, takeaways and giveaways, also per 60 minutes.' },
        { category: 'skater', view: 'icetime', label: 'Ice time', hint: 'Ice time by situation plus shift count and length.' },
        { category: 'skater', view: 'shots', label: 'Shot types', hint: 'Which shot types produce goals.' },
        { category: 'skater', view: 'discipline', label: 'Discipline', hint: 'Penalties taken and drawn. Drawing penalties is an underrated skill.' },
        { category: 'goalie', view: 'advanced', label: 'Goalies', hint: 'Quality start: save percentage at or above league average. Tells more about consistency than the average.' },
        { category: 'goalie', view: 'rest', label: 'Goalies & rest', hint: 'Save percentage by days of rest. Does back-to-back fatigue show?' },
        { category: 'team', view: 'possession', label: 'Teams', hint: 'PDO: shooting plus save percentage. Values far from 100 usually regress.' },
        { category: 'team', view: 'situational', label: 'Situational', hint: 'What happens when a team scores or concedes first.' },
    ],
};

/** Mittarien luettavat nimet. */
const LABELS = {
    corsiPct: 'Corsi %', fenwickPct: 'Fenwick %',
    offensiveZoneStartPct: 'Hyökkäysaloitukset', defensiveZoneStartPct: 'Puolustusaloitukset',
    onIceShootingPct: 'Laukaisu-% jäällä', toi5v5: 'Peliaika 5v5', shotsPer60: 'Laukauksia/60',
    pointsPer60: 'Pisteet/60', goalsPer60: 'Maalit/60', assistsPer60: 'Syötöt/60',
    primaryAssists: '1. syötöt', shootingPct: 'Laukaisu-%', corsiRelative: 'Corsi vs. joukkue',
    hits: 'Taklaukset', hitsPer60: 'Taklaukset/60', blocks: 'Blokit', blocksPer60: 'Blokit/60',
    takeaways: 'Riistot', giveaways: 'Menetykset', takeawaysPer60: 'Riistot/60', giveawaysPer60: 'Menetykset/60',
    toiPerGame: 'Peliaika', ppToiPerGame: 'YV-aika', shToiPerGame: 'AV-aika', evToiPerGame: 'Tasakenttä',
    shiftsPerGame: 'Vuoroja', toiPerShift: 'Vuoron pituus',
    wrist: 'Ranne', snap: 'Veto', slap: 'Lämäri', backhand: 'Rystu', tipIn: 'Ohjaus',
    deflected: 'Kimpoama', wrapAround: 'Kiepautus',
    taken: 'Otetut', drawn: 'Kohteena', net: 'Netto', pim: 'Jäähyminuutit', majors: 'Isot', minors: 'Pienet',
    qualityStarts: 'Vakuuttavia', qualityStartPct: 'Osuus', completeGames: 'Täydet ottelut',
    gaa: 'PÄM', savePct: 'Torjunta-%', shotsAgainstPer60: 'Laukauksia vastaan/60', regulationWins: 'Varsinaiset voitot',
    savePctB2B: 'Peräkkäin', savePct1Day: '1 lepopäivä', savePct2Days: '2 lepopäivää',
    savePct3Days: '3 lepopäivää', gamesB2B: 'Peräkkäisiä',
    evenStrength: 'Tasakenttä', shortHanded: 'Alivoima', powerPlay: 'Ylivoima', evenShots: 'Laukauksia 5v5',
    shootingPct5v5: 'Laukaisu-% 5v5', savePct5v5: 'Torjunta-% 5v5', pdo: 'PDO',
    winPctScoringFirst: 'W% johdossa', winPctTrailingFirst: 'W% tappiolla',
    winsScoringFirst: 'W:t johdossa', lossesTrailingFirst: 'T:t tappiolla',
};

/**
 * Sarakeotsikot silloin kun koko nimi ei mahdu.
 *
 * Otsikko näytetään vain kerran taulukon yläreunassa, joten se saa olla
 * lyhenne — merkitys selviää yläpuolen selitteestä. Vain pisimmät nimet ovat
 * täällä; muut tulevat LABELS-taulukosta sellaisenaan.
 */
const COLUMN_LABELS = {
    // "Vakuuttavia" on yksi pitkä sana, joka ei taitu sarakkeeseen. Yläpuolen
    // selite kertoo mitä vakuuttava ottelu tarkoittaa, joten tässä riittää
    // määrä ja osuus.
    qualityStarts: 'Määrä',
    offensiveZoneStartPct: 'Hyökk. %',
    defensiveZoneStartPct: 'Puol. %',
    onIceShootingPct: 'Lauk-% jäällä',
    corsiRelative: 'Corsi rel.',
    takeawaysPer60: 'Riistot/60',
    giveawaysPer60: 'Menet./60',
    hitsPer60: 'Takl./60',
    toiPerShift: 'Vuoron pit.',
    evToiPerGame: 'Tasakenttä',
    pim: 'Jäähymin.',
    completeGames: 'Täydet',
    shotsAgainstPer60: 'Lauk. vast./60',
    regulationWins: 'Vars. voitot',
    savePct1Day: '1 lepop.',
    savePct2Days: '2 lepop.',
    savePct3Days: '3 lepop.',
    gamesB2B: 'Peräkk.',
    shootingPct5v5: 'Lauk-% 5v5',
    savePct5v5: 'Torj-% 5v5',
    evenShots: 'Lauk. 5v5',
};

const columnLabel = (metric) => COLUMN_LABELS[metric] ?? LABELS[metric] ?? metric;

/** Prosenttiosuudet näytetään prosentteina, ajat minuutteina. */
function formatValue(metric, value) {
    if (value === null || value === undefined) return '—';

    if (/Pct$|^corsiPct$|^fenwickPct$|^pdo$/.test(metric) || metric.endsWith('Pct')) {
        return `${(value * 100).toFixed(1)} %`;
    }
    if (metric.startsWith('savePct') || metric === 'shootingPct' || metric === 'evenStrength'
        || metric === 'shortHanded' || metric === 'powerPlay') {
        return value.toFixed(3);
    }
    if (metric.includes('Toi') || metric === 'toi5v5' || metric === 'toiPerShift') {
        // Rajapinta antaa sekunteja.
        const minutes = Math.floor(value / 60);
        const seconds = Math.round(value % 60);
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(2);
}

const AdvancedModal = ({ isOpen, onClose, onPlayerClick, language = 'fi', zIndex = 99000 }) => {
    const views = VIEWS[language] ?? VIEWS.fi;
    const [active, setActive] = useState(0);
    const current = views[Math.min(active, views.length - 1)];

    const { data, isLoading, error } = useFetchWhenOpen(
        isOpen,
        (signal) => api.advanced(current.category, current.view, { limit: 40 }, { signal }),
        [current.category, current.view],
    );

    const fi = language === 'fi';
    const isTeamView = current.category === 'team';
    // Kolme lukua on kapean ruudun raja: enemmän ei mahdu luettavasti.
    const metrics = (data?.metrics ?? []).slice(0, 3);
    const season = data?.season
        ? `${String(data.season).slice(0, 4)}–${String(data.season).slice(6)}`
        : '';

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            zIndex={zIndex}
            size="full"
            title={fi ? 'Edistyneet tilastot' : 'Advanced stats'}
            subtitle={season ? `${fi ? 'Kausi' : 'Season'} ${season}${data?.isPreviousSeason ? (fi ? ' · edellinen' : ' · previous') : ''}` : undefined}
        >
            <div className="adv">
                <div className="adv-views">
                    {views.map((v, i) => (
                        <button
                            key={`${v.category}-${v.view}`}
                            type="button"
                            className={`adv-view ${i === active ? 'active' : ''}`}
                            onClick={() => setActive(i)}
                            aria-pressed={i === active}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>

                <p className="adv-hint">{current.hint}</p>

                {isLoading ? (
                    <div className="loading">{fi ? 'Ladataan…' : 'Loading…'}</div>
                ) : error ? (
                    <div className="error-state"><p>{error}</p></div>
                ) : (
                    <div
                        className="adv-table"
                        /* Otsikko- ja datarivit jakavat saman sarakemäärän. */
                        style={{ '--adv-metrics': metrics.length }}
                    >
                        <div className="adv-head">
                            <span className="adv-rank">#</span>
                            <span className="adv-name">
                                {isTeamView
                                    ? (fi ? 'Joukkue' : 'Team')
                                    : (fi ? 'Pelaaja' : 'Player')}
                            </span>
                            {metrics.map((m) => (
                                <span key={m} className="adv-col">{columnLabel(m)}</span>
                            ))}
                        </div>

                        {(data?.entries ?? []).map((entry, i) => (
                            <button
                                key={entry.id ?? entry.name ?? i}
                                type="button"
                                className="adv-row"
                                onClick={() => entry.id && onPlayerClick?.(entry.id)}
                                disabled={!entry.id}
                            >
                                <span className="adv-rank">{i + 1}</span>

                                <span className="adv-name">
                                    {/* Väri ja lyhenne samassa merkissä: erillinen
                                        väripallo ja tekstilyhenne veivät yhdessä
                                        yli puolet nimisarakkeesta. */}
                                    {entry.team && (
                                        <TeamBadge abbrev={entry.team} size={18} className="adv-badge" />
                                    )}

                                    {/* Joukkuenäkymissä merkki riittää: koko nimi
                                        toistaisi saman tiedon ja veisi tilan luvuilta. */}
                                    {!isTeamView && (
                                        <span className="adv-person">{shortenPlayerName(entry.name)}</span>
                                    )}
                                </span>

                                {metrics.map((m) => (
                                    <span key={m} className="adv-cell">{formatValue(m, entry[m])}</span>
                                ))}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </Sheet>
    );
};

export default AdvancedModal;
