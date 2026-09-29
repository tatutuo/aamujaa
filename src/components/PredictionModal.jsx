import React, { useState, useEffect } from 'react';
import { translations } from '../utils/translations';
import TeamBadge from './TeamBadge';
import Sheet from './Sheet';
import { api } from '../utils/api';

/**
 * Kristallipallo — ennusteiden näkymä.
 *
 * Kirjoitettu kokonaan CSS-luokilla. Aiemmin tässä tiedostossa oli 75 erillistä
 * inline-tyyliä, mustaa taustaa ja kirkkaan keltaisia kehyksiä, jotka eivät
 * noudattaneet sovelluksen muuta ulkoasua eivätkä toimineet vaaleassa teemassa.
 */

const shortenName = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.split(' ');
    return parts.length > 1 ? `${parts[0].charAt(0)}. ${parts.slice(1).join(' ')}` : fullName;
};

const PredictionModal = ({ isOpen, onClose, onPlayerClick, language, zIndex = 99000 }) => {
    const t = translations[language] || translations.fi;

    const [data, setData] = useState({ players: [], teams: [] });
    const [matches, setMatches] = useState([]);
    const [actualScores, setActualScores] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [accuracy, setAccuracy] = useState(null);
    const [view, setView] = useState('matches');
    const [availableDates, setAvailableDates] = useState([]);
    const [currentDateIndex, setCurrentDateIndex] = useState(0);

    useEffect(() => {
        if (!isOpen) return undefined;
        const controller = new AbortController();

        Promise.all([
            api.predictionDates({ signal: controller.signal }),
            api.predictionAccuracy(30, { signal: controller.signal }).catch(() => null),
        ])
            .then(([dates, acc]) => {
                if (dates?.length > 0) {
                    setAvailableDates(dates);
                    setCurrentDateIndex(0);
                } else {
                    setIsLoading(false);
                }
                setAccuracy(acc);
            })
            .catch((err) => {
                if (err.name !== 'AbortError') setIsLoading(false);
            });

        return () => controller.abort();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || availableDates.length === 0) return undefined;

        const controller = new AbortController();
        const selectedDate = availableDates[currentDateIndex];
        setIsLoading(true);

        Promise.all([
            api.predictions(selectedDate, { signal: controller.signal }),
            api.score(selectedDate, { signal: controller.signal }).catch(() => ({ games: [] })),
        ])
            .then(([predData, scoreData]) => {
                setData(predData);
                setMatches(predData.matches || []);
                setActualScores(scoreData.games || []);
                setIsLoading(false);
            })
            .catch((err) => {
                if (err.name !== 'AbortError') setIsLoading(false);
            });

        return () => controller.abort();
    }, [isOpen, currentDateIndex, availableDates]);

    const formatDate = (value) => {
        if (!value) return '';
        const [year, month, day] = value.split('-');
        return `${Number(day)}.${Number(month)}.${year}`;
    };

    const currentDate = availableDates[currentDateIndex];
    const isHistorical = currentDateIndex > 0;

    const tabs = [
        { id: 'matches', label: t.predTabMatches || 'Ottelut' },
        { id: 'players', label: language === 'fi' ? 'Pistepörssi' : 'Scoring' },
        { id: 'teams', label: language === 'fi' ? 'Sarjataulukko' : 'Standings' },
        { id: 'info', label: language === 'fi' ? 'Miten?' : 'How?' },
    ];

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            zIndex={zIndex}
            size="full"
            accent="var(--gold)"
            title={t.predTitle}
            subtitle={currentDate
                ? `${formatDate(currentDate)}${isHistorical ? (language === 'fi' ? ' · historiadata' : ' · historical') : ''}`
                : undefined}
        >
            <div className="pred">
                <div className="pred-datenav">
                    <button
                        type="button"
                        className="sched-filter-btn"
                        onClick={() => setCurrentDateIndex((i) => Math.min(i + 1, availableDates.length - 1))}
                        disabled={currentDateIndex >= availableDates.length - 1}
                        aria-label={language === 'fi' ? 'Edellinen päivä' : 'Previous day'}
                    >
                        &laquo;
                    </button>

                    {/* Toteutunut tarkkuus heti kärkeen — prosenttiluvut ilman
                        kontekstia eivät kerro kannattaako niihin uskoa. */}
                    <div className="pred-accuracy">
                        {accuracy?.total > 0 ? (
                            <>
                                <span>
                                    {language === 'fi'
                                        ? `Osunut ${accuracy.percentage} % (${accuracy.hits}/${accuracy.total})`
                                        : `Hit ${accuracy.percentage}% (${accuracy.hits}/${accuracy.total})`}
                                </span>
                                {accuracy.brierScore != null && (
                                    <span className={accuracy.brierScore < accuracy.coinFlipBrier ? 'is-good' : 'is-weak'}>
                                        Brier {accuracy.brierScore}
                                        <span className="pred-accuracy-hint">
                                            {language === 'fi'
                                                ? ` · kolikonheitto ${accuracy.coinFlipBrier}`
                                                : ` · coin flip ${accuracy.coinFlipBrier}`}
                                        </span>
                                    </span>
                                )}
                            </>
                        ) : (
                            <span>{language === 'fi' ? 'Ei vielä mitattua tarkkuutta' : 'No measured accuracy yet'}</span>
                        )}
                    </div>

                    <button
                        type="button"
                        className="sched-filter-btn"
                        onClick={() => setCurrentDateIndex((i) => Math.max(0, i - 1))}
                        disabled={currentDateIndex === 0}
                        aria-label={language === 'fi' ? 'Seuraava päivä' : 'Next day'}
                    >
                        &raquo;
                    </button>
                </div>

                <div className="pred-tabs">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            className={`pred-tab ${view === tab.id ? 'active' : ''}`}
                            onClick={() => setView(tab.id)}
                            aria-pressed={view === tab.id}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="loading">{t.predLoading}</div>
                ) : (
                    <>
                        {view === 'matches' && <MatchView matches={matches} actualScores={actualScores} t={t} language={language} />}
                        {view === 'players' && <PlayerView players={data.players} t={t} onPlayerClick={onPlayerClick} />}
                        {view === 'teams' && <TeamView teams={data.teams} language={language} />}
                        {view === 'info' && <InfoView t={t} />}
                    </>
                )}
            </div>
        </Sheet>
    );
};

// ---------------------------------------------------------------------------
// Ottelut
// ---------------------------------------------------------------------------

const MatchView = ({ matches, actualScores, t, language }) => {
    if (!matches?.length) {
        return <div className="empty-state">{t.predNoMatches || 'Ei otteluita tälle yölle.'}</div>;
    }

    const reasonText = (reason) => {
        const text = t[reason.key] || reason.key;
        return reason.val ? `${text} (${reason.val})` : text;
    };

    return (
        <div className="pred-matches">
            {matches.map((m) => {
                const actual = actualScores.find(
                    (g) => g.id === m.gameId || (g.homeTeam.abbrev === m.home && g.awayTeam.abbrev === m.away),
                );
                const isFinal = actual && (actual.gameState === 'FINAL' || actual.gameState === 'OFF');

                const homeScore = actual?.homeTeam?.score;
                const awayScore = actual?.awayTeam?.score;

                let isHit = false;
                if (isFinal) {
                    const actualHomeWin = homeScore > awayScore;
                    isHit = m.homeWinProb === m.awayWinProb
                        ? (m.homeScore > m.awayScore) === actualHomeWin
                        : (m.homeWinProb > m.awayWinProb) === actualHomeWin;
                }

                const favourite = m.homeWinProb > m.awayWinProb
                    ? m.home
                    : m.awayWinProb > m.homeWinProb ? m.away : '50 / 50';

                return (
                    <article key={m.gameId} className={`pred-match ${isFinal ? (isHit ? 'is-hit' : 'is-miss') : ''}`}>
                        {isFinal && (
                            <span className={`pred-verdict ${isHit ? 'is-hit' : 'is-miss'}`}>
                                {isHit
                                    ? (language === 'fi' ? 'Osui' : 'Hit')
                                    : (language === 'fi' ? 'Huti' : 'Miss')}
                            </span>
                        )}

                        <div className="pred-teams">
                            <div className="pred-team">
                                <TeamBadge abbrev={m.home} size={40} showText={false} />
                                <span className="pred-team-abbrev">{m.home}</span>
                            </div>

                            <div className="pred-verdict-box">
                                <span className="pred-verdict-label">
                                    {isFinal ? (t.predActual || 'Toteutunut') : (t.predFav || 'Suosikki')}
                                </span>
                                <span className="pred-verdict-value">
                                    {isFinal ? `${homeScore} – ${awayScore}` : favourite}
                                </span>
                                {!isFinal && (
                                    <span className="pred-verdict-sub">
                                        {language === 'fi' ? 'ennuste' : 'predicted'} {m.homeScore}–{m.awayScore}
                                        {m.isOT ? ' JA' : ''}
                                    </span>
                                )}
                            </div>

                            <div className="pred-team">
                                <TeamBadge abbrev={m.away} size={40} showText={false} />
                                <span className="pred-team-abbrev">{m.away}</span>
                            </div>
                        </div>

                        {/* Voittotodennäköisyys palkkina: kaksi lukua ja niiden suhde
                            kerralla luettavissa. */}
                        <div className="pred-bar" role="img"
                            aria-label={`${m.home} ${m.homeWinProb} %, ${m.away} ${m.awayWinProb} %`}>
                            <div className="pred-bar-fill" style={{ width: `${m.homeWinProb}%` }} />
                            <div className="pred-bar-labels">
                                <span>{m.home} {m.homeWinProb} %</span>
                                <span>{m.away} {m.awayWinProb} %</span>
                            </div>
                        </div>

                        <dl className="pred-facts">
                            <div>
                                <dt>{t.predRegTime || 'Varsinainen'}</dt>
                                <dd>{m.homeRegProb} · <span className="is-ot">{m.otProb}</span> · {m.awayRegProb} %</dd>
                            </div>
                            <div>
                                <dt>{t.predOver55 || 'Yli 5,5'}</dt>
                                <dd className={m.over55Prob > 50 ? 'is-good' : ''}>{m.over55Prob} %</dd>
                            </div>
                            {m.expectedGoals && (
                                <div>
                                    <dt>{language === 'fi' ? 'Odotusmaalit' : 'Expected goals'}</dt>
                                    <dd>{m.expectedGoals.home} – {m.expectedGoals.away}</dd>
                                </div>
                            )}
                        </dl>

                        {(m.homeReasons?.length > 0 || m.awayReasons?.length > 0) && (
                            <div className="pred-reasons">
                                <ul>
                                    {m.homeReasons.map((r, i) => (
                                        <li key={i} className={r.type === 'plus' ? 'is-plus' : 'is-minus'}>
                                            {reasonText(r)}
                                        </li>
                                    ))}
                                </ul>
                                <ul className="is-away">
                                    {m.awayReasons.map((r, i) => (
                                        <li key={i} className={r.type === 'plus' ? 'is-plus' : 'is-minus'}>
                                            {reasonText(r)}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </article>
                );
            })}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Pistepörssi
// ---------------------------------------------------------------------------

const PlayerView = ({ players = [], t, onPlayerClick }) => {
    const list = Array.isArray(players) ? players : [];

    if (list.length === 0) {
        return <div className="empty-state">{t.predLoading}</div>;
    }

    return (
        <div className="pred-table">
            <header className="pred-table-head">
                <span className="pred-rank">#</span>
                <span className="pred-name">{t.predPlayer}</span>
                <span className="pred-col">{t.predCurrent}</span>
                <span className="pred-col is-highlight">{t.predProj}</span>
            </header>

            {list.map((p, i) => (
                <button key={p.id} type="button" className="pred-row" onClick={() => onPlayerClick(p.id)}>
                    <span className={`pred-rank ${i < 3 ? 'is-top' : ''}`}>{i + 1}</span>

                    <span className="pred-name">
                        <TeamBadge abbrev={p.team} size={18} showText={false} />
                        {shortenName(p.name)}
                    </span>

                    <span className="pred-col">
                        <strong>{p.current?.p ?? 0}</strong>
                        <small>{p.current?.g ?? 0}+{p.current?.a ?? 0}</small>
                    </span>

                    <span className="pred-col is-highlight">
                        <strong>{p.predicted?.p ?? 0}</strong>
                        {p.predicted?.range && p.predicted.range.high > p.predicted.range.low && (
                            <small>{p.predicted.range.low}–{p.predicted.range.high}</small>
                        )}
                    </span>
                </button>
            ))}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Sarjataulukko
// ---------------------------------------------------------------------------

const TeamView = ({ teams = [], language }) => {
    const list = Array.isArray(teams) ? teams : [];
    const conferences = [
        { name: language === 'fi' ? 'Itäinen konferenssi' : 'Eastern Conference', teams: list.filter((t) => t.conference === 'Eastern') },
        { name: language === 'fi' ? 'Läntinen konferenssi' : 'Western Conference', teams: list.filter((t) => t.conference === 'Western') },
    ];

    if (list.length === 0) return <div className="empty-state">—</div>;

    return (
        <div className="pred-conferences">
            {conferences.map(({ name, teams: confTeams }) => (
                <section key={name}>
                    <h3 className="section-title">{name}</h3>
                    <div className="pred-table">
                        {confTeams.map((team, i) => (
                            <div key={team.teamAbbrev} className={`pred-row ${i === 7 ? 'is-cutoff' : ''}`}>
                                <span className={`pred-rank ${i < 8 ? 'is-playoff' : 'is-out'}`}>{i + 1}</span>
                                <span className="pred-name">
                                    <TeamBadge abbrev={team.teamAbbrev} size={20} showText={false} />
                                    {team.teamName}
                                </span>
                                <span className="pred-col is-highlight">
                                    <strong>{team.projectedPoints}</strong>
                                    <small>{language === 'fi' ? 'nyt' : 'now'} {team.currentPoints}</small>
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Miten ennuste syntyy
// ---------------------------------------------------------------------------

const InfoView = ({ t }) => {
    const paragraphs = [t.predInfoP2, t.predInfoP3, t.predInfoP4, t.predInfoP5].filter(Boolean);

    return (
        <div className="pred-info">
            <p className="prose-lead">{t.predInfoP1}</p>

            <h4>{t.predInfoMethod}</h4>
            <ol className="pred-steps">
                {paragraphs.map((text, i) => {
                    const splitAt = text.indexOf(':');
                    const hasTitle = splitAt > 0 && splitAt < 40;
                    return (
                        <li key={i}>
                            {hasTitle ? (
                                <>
                                    <strong>{text.slice(0, splitAt)}</strong>
                                    {text.slice(splitAt + 1)}
                                </>
                            ) : text}
                        </li>
                    );
                })}
            </ol>

            {t.predInfoP6 && <p className="pred-caveat">{t.predInfoP6}</p>}
        </div>
    );
};

export default PredictionModal;
