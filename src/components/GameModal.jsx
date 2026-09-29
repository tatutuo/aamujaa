import React, { useState, useMemo } from 'react';
import { translations } from '../utils/translations';
import TeamBadge from './TeamBadge';
import Sheet from './Sheet';
import ShotMap from './ShotMap';
import { api } from '../utils/api';
import { penaltyName } from '../utils/penalties';
import { useFetchWhenOpen } from '../hooks/useModal';

/**
 * Ottelunäkymä — sovelluksen eniten käytetty osa.
 *
 * Korjatut asiat:
 *
 *   - Näkymä ei enää pompi välilehteä vaihdettaessa. Aiemmin jokainen välilehti
 *     määritteli oman korkeutensa, joten "Tilastot" jäi puoliväliin ruutua kun
 *     "Kokoonpanot" täytti sen. Sisältöalueella on nyt kiinteä vähimmäiskorkeus.
 *
 *   - Jäähyn saaneen pelaajan nimeä voi napauttaa. Ennen vain maalintekijät
 *     olivat klikattavia, vaikka jäähypelaajan tunniste on datassa mukana.
 *
 *   - Aloitukset näkyvät tarkkoina lukemina (9/15) eivätkä pelkkänä
 *     prosenttina, joka oli laitahyökkääjillä aina nolla.
 *
 *   - Mukana tuomarit, päävalmentajat, ylimääräiset pelaajat, laukaukset
 *     erittäin ja keskinäiset kohtaamiset — kaikki oli rajapinnassa valmiina
 *     mutta jäi käyttämättä.
 */

/*
 * Välilehtien nimet kirjoitetaan tässä eikä oteta käännöstiedostosta:
 * siellä ne ovat vanhaa perua SUURAAKKOSIN, jolloin rivi näytti sekavalta
 * ("TAPAHTUMAT · Laukaukset · TILASTOT").
 */
const TABS = (fi) => [
    { id: 'events', label: fi ? 'Tapahtumat' : 'Events' },
    { id: 'shots', label: fi ? 'Laukaukset' : 'Shots' },
    { id: 'stats', label: fi ? 'Tilastot' : 'Stats' },
    { id: 'faceoffs', label: fi ? 'Aloitukset' : 'Faceoffs' },
    { id: 'rosters', label: fi ? 'Kokoonpanot' : 'Rosters' },
    { id: 'info', label: fi ? 'Tiedot' : 'Info' },
];

/** Joukkuetilastojen luettavat nimet. */
const STAT_LABELS = {
    sog: { fi: 'Laukaukset', en: 'Shots on goal' },
    faceoffWinningPctg: { fi: 'Aloitukset', en: 'Faceoffs' },
    faceoffWins: { fi: 'Aloitusvoitot', en: 'Faceoff wins' },
    powerPlay: { fi: 'Ylivoima', en: 'Power play' },
    powerPlayPctg: { fi: 'Ylivoima-%', en: 'Power play %' },
    pim: { fi: 'Jäähyminuutit', en: 'Penalty minutes' },
    hits: { fi: 'Taklaukset', en: 'Hits' },
    blockedShots: { fi: 'Blokit', en: 'Blocked shots' },
    giveaways: { fi: 'Menetykset', en: 'Giveaways' },
    takeaways: { fi: 'Riistot', en: 'Takeaways' },
};

const formatStat = (category, value) => {
    if (value === null || value === undefined) return '—';
    if (category.endsWith('Pctg')) return `${(value * 100).toFixed(1)} %`;
    return String(value);
};

const GameModal = ({ isOpen, onClose, gameData, onTeamClick, onPlayerClick, language, zIndex = 99000 }) => {
    const t = translations[language] || translations.fi;
    const fi = language === 'fi';
    const [activeView, setActiveView] = useState('events');

    const gameId = gameData?.id;

    const { data, isLoading } = useFetchWhenOpen(
        isOpen && Boolean(gameData),
        (signal) => Promise.all([
            api.game(gameId, { signal }),
            api.boxscore(gameId, { signal }),
        ]).then(([details, box]) => ({ details, box })),
        [gameId],
    );

    // Raskaammat lisäosat haetaan vasta kun niitä katsotaan.
    const { data: shotData, isLoading: shotsLoading } = useFetchWhenOpen(
        isOpen && Boolean(gameId) && activeView === 'shots',
        (signal) => api.gameShots(gameId, { signal }),
        [gameId, activeView],
    );

    const { data: faceoffs, isLoading: faceoffsLoading } = useFetchWhenOpen(
        isOpen && Boolean(gameId) && activeView === 'faceoffs',
        (signal) => api.gameFaceoffs(gameId, { signal }),
        [gameId, activeView],
    );

    const { data: extras, isLoading: extrasLoading } = useFetchWhenOpen(
        isOpen && Boolean(gameId) && (activeView === 'stats' || activeView === 'info'),
        (signal) => api.gameExtras(gameId, { signal }),
        [gameId, activeView],
    );

    // Uusi ottelu avautuu aina tapahtumiin. Nollaus tehdään renderöinnin
    // aikana eikä efektissä, jottei väliin ehdi renderöityä vanhaa välilehteä.
    const [viewedGameId, setViewedGameId] = useState(gameId);
    if (viewedGameId !== gameId) {
        setViewedGameId(gameId);
        setActiveView('events');
    }

    const details = data?.details ?? null;
    const boxscore = data?.box ?? null;

    const homeAbbrev = gameData?.homeTeam?.abbrev ?? gameData?.homeTeam;
    const awayAbbrev = gameData?.awayTeam?.abbrev ?? gameData?.awayTeam;

    /** Erittäin järjestetyt tapahtumat, juokseva tulos mukana. */
    const periods = useMemo(() => {
        if (!details?.summary) return [];

        const byPeriod = new Map();
        const ensure = (descriptor) => {
            const number = descriptor.number;
            if (!byPeriod.has(number)) byPeriod.set(number, { descriptor, events: [] });
            return byPeriod.get(number);
        };

        for (const period of details.summary.scoring ?? []) {
            for (const goal of period.goals ?? []) {
                ensure(period.periodDescriptor).events.push({
                    type: 'goal', time: goal.timeInPeriod, data: goal,
                });
            }
        }

        for (const period of details.summary.penalties ?? []) {
            for (const penalty of period.penalties ?? []) {
                ensure(period.periodDescriptor).events.push({
                    type: 'penalty', time: penalty.timeInPeriod, data: penalty,
                });
            }
        }

        const sorted = [...byPeriod.values()].sort((a, b) => a.descriptor.number - b.descriptor.number);

        let home = 0;
        let away = 0;
        for (const period of sorted) {
            period.events.sort((a, b) => a.time.localeCompare(b.time));
            for (const event of period.events) {
                if (event.type !== 'goal') continue;
                if (event.data.teamAbbrev?.default === homeAbbrev) home += 1;
                else away += 1;
                event.score = `${away} – ${home}`;
            }
        }

        return sorted;
    }, [details, homeAbbrev]);

    /**
     * Pelinumero + joukkue -> pelaajan tunniste.
     *
     * Jäähydatassa ei ole lainkaan pelaaja-ID:tä — vain nimi, pelinumero ja
     * joukkue. Siksi jäähypelaajaa ei aiemmin päässyt napauttamaan. Pelinumero
     * on joukkueen sisällä yksikäsitteinen, joten kokoonpanosta löytyy täsmä-
     * vastaavuus. Se on luotettavampi kuin nimivertailu, jota vanha koodi
     * yritti aksentteja poistamalla.
     */
    const playerIdByNumber = useMemo(() => {
        const map = new Map();
        const sides = [['awayTeam', awayAbbrev], ['homeTeam', homeAbbrev]];

        for (const [side, abbrev] of sides) {
            const stats = boxscore?.playerByGameStats?.[side];
            if (!stats) continue;
            for (const group of ['forwards', 'defense', 'goalies']) {
                for (const p of stats[group] ?? []) {
                    if (p.sweaterNumber != null) map.set(`${abbrev}-${p.sweaterNumber}`, p.playerId);
                }
            }
        }
        return map;
    }, [boxscore, awayAbbrev, homeAbbrev]);

    if (!isOpen || !gameData) return null;

    const periodName = (descriptor) => {
        if (descriptor.periodType === 'SO') return fi ? 'Voittolaukaukset' : 'Shootout';
        if (descriptor.periodType === 'OT') return fi ? 'Jatkoaika' : 'Overtime';
        return `${descriptor.number}. ${fi ? 'erä' : 'period'}`;
    };

    /** Jäähyn saanut pelaaja nimineen ja tunnisteineen. */
    const penaltyPlayer = (penalty) => {
        const raw = penalty.committedByPlayer ?? penalty.servedByPlayer;
        const abbrev = penalty.teamAbbrev?.default ?? penalty.teamAbbrev;

        if (!raw) return { id: null, name: fi ? 'Joukkue' : 'Team' };

        if (typeof raw === 'string') return { id: null, name: raw };

        const name = raw.default
            ?? `${raw.firstName?.default ?? raw.firstName ?? ''} ${raw.lastName?.default ?? raw.lastName ?? ''}`.trim();

        const id = raw.playerId
            ?? (raw.sweaterNumber != null ? playerIdByNumber.get(`${abbrev}-${raw.sweaterNumber}`) : null)
            ?? null;

        return { id, name, sweaterNumber: raw.sweaterNumber ?? null };
    };

    /** Rikkeen kohteena ollut pelaaja — tieto on datassa mutta jäi aiemmin näyttämättä. */
    const drawnByName = (penalty) => {
        const raw = penalty.drawnBy;
        if (!raw) return null;
        return `${raw.firstName?.default ?? ''} ${raw.lastName?.default ?? ''}`.trim();
    };

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            zIndex={zIndex}
            size="full"
            title={`${awayAbbrev} – ${homeAbbrev}`}
            subtitle={details?.venue?.default || gameData?.venue?.default || undefined}
        >
            {/* Tulostaulu pysyy näkyvissä välilehdestä riippumatta. */}
            <div className="gm-score">
                <button type="button" className="gm-score-team" onClick={() => onTeamClick(awayAbbrev)}>
                    <TeamBadge abbrev={awayAbbrev} size={44} showText={false} />
                    <span>{awayAbbrev}</span>
                </button>

                <div className="gm-score-numbers">
                    <span>{gameData.awayTeam?.score ?? '–'}</span>
                    <span className="gm-score-dash">–</span>
                    <span>{gameData.homeTeam?.score ?? '–'}</span>
                </div>

                <button type="button" className="gm-score-team" onClick={() => onTeamClick(homeAbbrev)}>
                    <TeamBadge abbrev={homeAbbrev} size={44} showText={false} />
                    <span>{homeAbbrev}</span>
                </button>
            </div>

            <div className="pred-tabs gm-tabs">
                {TABS(fi).map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={`pred-tab ${activeView === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveView(tab.id)}
                        aria-pressed={activeView === tab.id}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/*
              Kiinteä vähimmäiskorkeus: sisältö ei enää hyppää eikä paneeli
              kutistu puoleen ruutuun kun vaihtaa kevyemmälle välilehdelle.
            */}
            <div className="gm-body">
                {isLoading ? (
                    <div className="loading">{t.gmLoading}</div>
                ) : (
                    <>
                        {activeView === 'events' && (
                            <div className="gm-events">
                                {periods.length === 0 && <p className="empty-state">{t.gmNoData}</p>}

                                {periods.map((period) => (
                                    <section key={period.descriptor.number}>
                                        <h4 className="gm-period">{periodName(period.descriptor)}</h4>

                                        {period.events.map((event, i) => {
                                            if (event.type === 'goal') {
                                                const g = event.data;
                                                const assists = (g.assists ?? [])
                                                    .map((a) => a.name?.default)
                                                    .filter(Boolean);

                                                return (
                                                    <div key={`g-${i}`} className="gm-event is-goal">
                                                        <span className="gm-event-time">{event.time}</span>
                                                        <TeamBadge abbrev={g.teamAbbrev?.default} size={18} showText={false} />

                                                        <div className="gm-event-main">
                                                            <button
                                                                type="button"
                                                                className="gm-event-player"
                                                                onClick={() => g.playerId && onPlayerClick(g.playerId)}
                                                            >
                                                                {g.name?.default ?? g.firstName?.default}
                                                            </button>
                                                            {assists.length > 0 && (
                                                                <span className="gm-event-assists">{assists.join(', ')}</span>
                                                            )}
                                                        </div>

                                                        <span className="score-chip">{event.score}</span>

                                                        {g.highlightClipSharingUrl && (
                                                            <a
                                                                className="gc-goal-video"
                                                                href={g.highlightClipSharingUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                aria-label={fi ? 'Katso maali' : 'Watch goal'}
                                                            >
                                                                ▶
                                                            </a>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            const p = event.data;
                                            const player = penaltyPlayer(p);

                                            return (
                                                <div key={`p-${i}`} className="gm-event is-penalty">
                                                    <span className="gm-event-time">{event.time}</span>
                                                    <TeamBadge abbrev={p.teamAbbrev?.default ?? p.teamAbbrev} size={18} showText={false} />

                                                    <div className="gm-event-main">
                                                        {/* Jäähypelaaja on nyt klikattava, kun tunniste löytyy. */}
                                                        <button
                                                            type="button"
                                                            className="gm-event-player"
                                                            onClick={() => player.id && onPlayerClick(player.id)}
                                                            disabled={!player.id}
                                                        >
                                                            {player.name}
                                                        </button>
                                                        <span className="gm-event-assists">
                                                            {penaltyName(p.descKey, fi)}
                                                            {drawnByName(p) && ` · ${fi ? 'kohde' : 'drawn by'} ${drawnByName(p)}`}
                                                        </span>
                                                    </div>

                                                    <span className="gm-penalty-min">{p.duration ?? 2} min</span>
                                                </div>
                                            );
                                        })}
                                    </section>
                                ))}
                            </div>
                        )}

                        {activeView === 'shots' && (
                            shotsLoading
                                ? <div className="loading">{t.gmLoading}</div>
                                : <ShotMap data={shotData} language={language} onPlayerClick={onPlayerClick} />
                        )}

                        {activeView === 'stats' && (
                            extrasLoading ? <div className="loading">{t.gmLoading}</div> : (
                                <div className="gm-stats">
                                    {(extras?.shotsByPeriod?.length > 0) && (
                                        <table className="gm-period-table">
                                            <thead>
                                                <tr>
                                                    <th>{fi ? 'Laukaukset' : 'Shots'}</th>
                                                    {extras.shotsByPeriod.map((p) => (
                                                        <th key={p.period}>
                                                            {p.periodType === 'REG' ? `${p.period}.` : p.periodType}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td>{awayAbbrev}</td>
                                                    {extras.shotsByPeriod.map((p) => <td key={p.period}>{p.away}</td>)}
                                                </tr>
                                                <tr>
                                                    <td>{homeAbbrev}</td>
                                                    {extras.shotsByPeriod.map((p) => <td key={p.period}>{p.home}</td>)}
                                                </tr>
                                            </tbody>
                                        </table>
                                    )}

                                    {(extras?.teamStats ?? []).map((stat) => {
                                        const label = STAT_LABELS[stat.category];
                                        return (
                                            <div key={stat.category} className="gm-stat-row">
                                                <span className="gm-stat-value">{formatStat(stat.category, stat.away)}</span>
                                                <span className="gm-stat-label">
                                                    {label ? (fi ? label.fi : label.en) : stat.category}
                                                </span>
                                                <span className="gm-stat-value">{formatStat(stat.category, stat.home)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        )}

                        {activeView === 'faceoffs' && (
                            faceoffsLoading ? <div className="loading">{t.gmLoading}</div> : (
                                <div className="gm-faceoffs">
                                    {faceoffs?.totals && (
                                        <div className="gm-stat-row is-total">
                                            <span className="gm-stat-value">
                                                {faceoffs.totals.away.won}/{faceoffs.totals.away.total}
                                            </span>
                                            <span className="gm-stat-label">{fi ? 'Aloitukset' : 'Faceoffs'}</span>
                                            <span className="gm-stat-value">
                                                {faceoffs.totals.home.won}/{faceoffs.totals.home.total}
                                            </span>
                                        </div>
                                    )}

                                    <p className="gm-note">
                                        {fi
                                            ? 'Mukana vain pelaajat, jotka ottivat aloituksia.'
                                            : 'Only players who took faceoffs are listed.'}
                                    </p>

                                    {(faceoffs?.players ?? []).map((p) => (
                                        <button
                                            key={p.playerId}
                                            type="button"
                                            className="gm-faceoff-row"
                                            onClick={() => onPlayerClick(p.playerId)}
                                        >
                                            <TeamBadge
                                                abbrev={p.isHome ? homeAbbrev : awayAbbrev}
                                                size={16}
                                                showText={false}
                                            />
                                            <span className="gm-faceoff-name">{p.name}</span>
                                            <span className="gm-faceoff-record">{p.won}/{p.total}</span>
                                            <span className={`gm-faceoff-pct ${p.pct >= 0.5 ? 'is-good' : ''}`}>
                                                {Math.round(p.pct * 100)} %
                                            </span>
                                            <span className="gm-faceoff-zones">
                                                {fi ? 'H' : 'O'} {p.offensive.won}/{p.offensive.total} ·{' '}
                                                {fi ? 'P' : 'D'} {p.defensive.won}/{p.defensive.total}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )
                        )}

                        {activeView === 'rosters' && (
                            <div className="gm-rosters">
                                {['awayTeam', 'homeTeam'].map((side) => {
                                    const stats = boxscore?.playerByGameStats?.[side];
                                    const abbrev = side === 'homeTeam' ? homeAbbrev : awayAbbrev;
                                    if (!stats) return null;

                                    return (
                                        <section key={side}>
                                            <h4 className="gm-period">
                                                <TeamBadge abbrev={abbrev} size={20} showText={false} /> {abbrev}
                                            </h4>

                                            {[
                                                ['forwards', t.gmForwards || 'Hyökkääjät'],
                                                ['defense', t.gmDefense || 'Puolustajat'],
                                                ['goalies', t.gmGoalies || 'Maalivahdit'],
                                            ].map(([group, label]) => (
                                                <div key={group} className="gm-roster-group">
                                                    <h5>{label}</h5>
                                                    <div className="gm-roster-players">
                                                        {[...(stats[group] ?? [])]
                                                            .sort((a, b) => (a.sweaterNumber ?? 99) - (b.sweaterNumber ?? 99))
                                                            .map((p) => (
                                                                <button
                                                                    key={p.playerId}
                                                                    type="button"
                                                                    className="gm-roster-player"
                                                                    onClick={() => onPlayerClick(p.playerId)}
                                                                >
                                                                    <span className="gm-roster-number">#{p.sweaterNumber ?? '–'}</span>
                                                                    {p.name?.default}
                                                                    {group !== 'goalies' && p.points > 0 && (
                                                                        <span className="gm-roster-points">{p.goals}+{p.assists}</span>
                                                                    )}
                                                                </button>
                                                            ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </section>
                                    );
                                })}
                            </div>
                        )}

                        {activeView === 'info' && (
                            extrasLoading ? <div className="loading">{t.gmLoading}</div> : (
                                <div className="gm-info">
                                    <section>
                                        <h4 className="gm-period">{fi ? 'Valmentajat' : 'Coaches'}</h4>
                                        <div className="gm-info-pair">
                                            <span>{awayAbbrev}: {extras?.away?.headCoach ?? '—'}</span>
                                            <span>{homeAbbrev}: {extras?.home?.headCoach ?? '—'}</span>
                                        </div>
                                    </section>

                                    <section>
                                        <h4 className="gm-period">{fi ? 'Tuomarit' : 'Officials'}</h4>
                                        <p className="gm-info-text">
                                            {(extras?.referees ?? []).join(', ') || '—'}
                                            {extras?.linesmen?.length > 0 && (
                                                <>
                                                    <br />
                                                    <span className="gm-info-muted">
                                                        {fi ? 'Linjatuomarit: ' : 'Linesmen: '}
                                                        {extras.linesmen.join(', ')}
                                                    </span>
                                                </>
                                            )}
                                        </p>
                                    </section>

                                    <section>
                                        <h4 className="gm-period">{fi ? 'Ylimääräiset' : 'Scratches'}</h4>
                                        <p className="gm-note">
                                            {fi
                                                ? 'NHL ei julkaise loukkaantumistietoja. Ylimääräisistä voi päätellä poissaoloja, mutta syy voi olla myös valmentajan valinta.'
                                                : 'The NHL publishes no injury data. Scratches hint at absences, but the reason may also be a coaching decision.'}
                                        </p>

                                        {['away', 'home'].map((side) => (
                                            <div key={side} className="gm-scratches">
                                                <strong>{side === 'home' ? homeAbbrev : awayAbbrev}</strong>
                                                <div className="gm-roster-players">
                                                    {(extras?.[side]?.scratches ?? []).map((p) => (
                                                        <button
                                                            key={p.id}
                                                            type="button"
                                                            className="gm-roster-player"
                                                            onClick={() => onPlayerClick(p.id)}
                                                        >
                                                            {p.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </section>

                                    {extras?.seasonSeries?.length > 0 && (
                                        <section>
                                            <h4 className="gm-period">{fi ? 'Keskinäiset' : 'Season series'}</h4>
                                            {extras.seriesWins && (
                                                <p className="gm-info-text">
                                                    {awayAbbrev} {extras.seriesWins.awayTeamWins} – {extras.seriesWins.homeTeamWins} {homeAbbrev}
                                                </p>
                                            )}
                                            <div className="gm-series">
                                                {extras.seasonSeries.map((g) => (
                                                    <div key={g.id} className="gm-series-game">
                                                        <span>{g.date}</span>
                                                        <span>{g.away} {g.awayScore ?? '–'} – {g.homeScore ?? '–'} {g.home}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                </div>
                            )
                        )}
                    </>
                )}
            </div>
        </Sheet>
    );
};

export default GameModal;
