import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import DateNavigation from './DateNavigation';
import GameCard from './GameCard';
import PlayerCard from './PlayerCard';
import TeamBadge from './TeamBadge';
import WhatsNew from './WhatsNew';
import { translations } from '../utils/translations';
import { api } from '../utils/api';
import { scoreSkater, scoreGoalie } from '../utils/fantasy';
import { toApiDate, getGameDayDate, addDays, isSameDay, formatShort } from '../utils/dates';

/**
 * Etusivu.
 *
 * Kaksi isoa muutosta vanhaan:
 *
 * 1. Yksi API-kutsu monen sijaan. Ennen jokainen sivulataus haki jokaiselle
 *    ottelulle erikseen boxscoren ja landing-datan suoraan selaimesta — 16
 *    ottelun iltana 32 rinnakkaista pyyntöä. Nyt /api/nhl/day palauttaa saman
 *    valmiiksi koottuna ja välimuistitettuna.
 *
 * 2. Päivitysväli mukautuu tilanteeseen. Ennen haku toistui 30 sekunnin välein
 *    aina — myös kesäkuussa, kun otteluita ei ole, ja silloinkin kun välilehti
 *    oli taustalla. Nyt päivitetään vain kun otteluita on käynnissä ja sovellus
 *    on näkyvissä.
 */

const LIVE_POLL_MS = 20_000;

const HomePage = ({
    onPlayerClick, onGameClick, onFantasyClick,
    favTeams, toggleFavTeam,
    favPlayers, toggleFavPlayer,
    fantasyTeam, toggleFantasyPlayer,
    language,
}) => {
    const t = translations[language] || translations.fi;

    // Päivä voi tulla osoiteriviltä (?date=2026-04-15), jolloin tietyn illan
    // otteluihin voi linkittää suoraan. Ilman parametria näytetään kuluva
    // ottelukierros.
    const [currentDateObj, setCurrentDateObj] = useState(() => {
        const fromUrl = new URLSearchParams(window.location.search).get('date');
        if (fromUrl && /^\d{4}-\d{2}-\d{2}$/.test(fromUrl)) {
            const parsed = new Date(`${fromUrl}T12:00:00`);
            if (!Number.isNaN(parsed.getTime())) return parsed;
        }
        return getGameDayDate();
    });
    const [day, setDay] = useState({ games: [], hot: [], tracked: [], hasLiveGames: false });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const [seasonStats, setSeasonStats] = useState({});
    const [goalAlert, setGoalAlert] = useState(null);
    const previousScores = useRef({});

    const apiDate = toApiDate(currentDateObj);
    const isToday = isSameDay(currentDateObj, getGameDayDate());

    /** Havaitsee uudet maalit vertaamalla edelliseen hakuun. */
    const detectGoals = useCallback((games) => {
        const alerts = [];

        for (const game of games) {
            const previous = previousScores.current[game.id];
            const away = game.awayTeam.score ?? 0;
            const home = game.homeTeam.score ?? 0;

            if (previous && (away > previous.away || home > previous.home)) {
                alerts.push(`🚨 ${game.awayTeam.abbrev} ${away} – ${home} ${game.homeTeam.abbrev} 🚨`);
            }
            previousScores.current[game.id] = { away, home };
        }

        return alerts;
    }, []);

    const load = useCallback((options = {}) => {
        const { silent = false, signal } = options;
        if (!silent) setIsLoading(true);

        return api.day(apiDate, language, { signal })
            .then((data) => {
                const alerts = detectGoals(data.games);
                if (silent && alerts.length > 0) {
                    setGoalAlert(alerts.join('  |  '));
                }
                setDay(data);
                setError(null);
                setIsLoading(false);
            })
            .catch((err) => {
                if (err.name === 'AbortError') return;
                setError(err.message);
                setIsLoading(false);
            });
    }, [apiDate, language, detectGoals]);

    // Päivän vaihtuessa nollataan maalivahti, jotta eilisen tulokset eivät
    // näytä "uusilta maaleilta".
    useEffect(() => {
        previousScores.current = {};
        setGoalAlert(null);

        const controller = new AbortController();
        load({ signal: controller.signal });
        return () => controller.abort();
    }, [load]);

    // Live-päivitys vain kun sitä oikeasti tarvitaan.
    useEffect(() => {
        if (!isToday || !day.hasLiveGames) return undefined;

        const controller = new AbortController();
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                load({ silent: true, signal: controller.signal });
            }
        }, LIVE_POLL_MS);

        return () => {
            clearInterval(interval);
            controller.abort();
        };
    }, [isToday, day.hasLiveGames, load]);

    useEffect(() => {
        if (!goalAlert) return undefined;
        const timer = setTimeout(() => setGoalAlert(null), 8000);
        return () => clearTimeout(timer);
    }, [goalAlert]);

    // Kausitilastot seurattaville pelaajille — yksi pyyntö, ei silmukkaa.
    const trackedIds = useMemo(() => {
        const ids = [...favPlayers, ...(fantasyTeam ?? []).map((f) => f.id)];
        return [...new Set(ids)].filter((id) => String(id).length === 7);
    }, [favPlayers, fantasyTeam]);

    useEffect(() => {
        const missing = trackedIds.filter((id) => !seasonStats[id]);
        if (missing.length === 0) return undefined;

        const controller = new AbortController();

        api.players(missing, { signal: controller.signal })
            .then((players) => {
                setSeasonStats((prev) => {
                    const next = { ...prev };
                    for (const p of players) {
                        next[p.playerId] = {
                            ...(p.featuredStats?.regularSeason?.subSeason ?? {}),
                            team: p.currentTeamAbbrev ?? '',
                            position: p.position,
                            name: `${p.firstName?.default ?? ''} ${p.lastName?.default ?? ''}`.trim(),
                        };
                    }
                    return next;
                });
            })
            .catch((err) => {
                if (err.name !== 'AbortError') console.error('Kausitilastojen haku epäonnistui:', err);
            });

        return () => controller.abort();
    }, [trackedIds, seasonStats]);

    /** Yhdistää päivän suorituksen ja kausitilastot yhdeksi korttidataksi. */
    const buildPlayerList = useCallback((ids, nameOverrides = {}) => {
        const playingToday = new Map(day.tracked.concat(day.hot).map((p) => [p.id, p]));
        const gameTeams = new Set(day.games.flatMap((g) => [g.homeTeam.abbrev, g.awayTeam.abbrev]));

        return ids.map((id) => {
            const today = playingToday.get(id);
            const season = seasonStats[id];

            if (today) {
                return { ...today, name: nameOverrides[id] ?? today.name, isPlayingToday: true, seasonStats: season ?? {} };
            }

            if (season) {
                return {
                    id,
                    name: nameOverrides[id] ?? season.name,
                    team: season.team,
                    position: season.position,
                    isPlayingToday: gameTeams.has(season.team),
                    seasonStats: season,
                    stats: {},
                };
            }

            return { id, name: nameOverrides[id] ?? t.loading, isLoading: true, stats: {} };
        });
    }, [day, seasonStats, t.loading]);

    const sortPlayers = useCallback((list) => [...list].sort((a, b) => {
        const aPlays = a.isPlayingToday !== false;
        const bPlays = b.isPlayingToday !== false;
        if (aPlays !== bPlays) return aPlays ? -1 : 1;

        const isGoalie = (p) => p.position === 'G' || p.position === 'Goalie';
        if (isGoalie(a) !== isGoalie(b)) return isGoalie(a) ? 1 : -1;

        if (isGoalie(a)) {
            const value = (p) => (p.isPlayingToday !== false ? p.stats?.saves ?? 0 : p.seasonStats?.wins ?? 0);
            return value(b) - value(a);
        }

        const points = (p) => (p.isPlayingToday !== false ? p.stats?.points ?? 0 : p.seasonStats?.points ?? 0);
        const goals = (p) => (p.isPlayingToday !== false ? p.stats?.goals ?? 0 : p.seasonStats?.goals ?? 0);
        return points(b) - points(a) || goals(b) - goals(a);
    }), []);

    const fantasyNames = useMemo(
        () => Object.fromEntries((fantasyTeam ?? []).map((p) => [p.id, p.name])),
        [fantasyTeam],
    );

    /*
     * Fantasy-pisteet päivän otteluista.
     *
     * Haetaan yhdellä pyynnöllä koko joukkueelle ja päivitetään samaa tahtia
     * kuin päivän tulokset, jotta kortit näyttävät pisteet ottelun edetessä.
     * Pisteet lasketaan vasta täällä, koska kapteenin kerroin on käyttäjän
     * oma valinta eikä sitä ole palvelimella.
     */
    const [fantasyStats, setFantasyStats] = useState({});

    const fantasyIds = useMemo(
        () => (fantasyTeam ?? []).map((p) => p.id).filter((id) => String(id).length === 7),
        [fantasyTeam],
    );

    useEffect(() => {
        if (fantasyIds.length === 0) {
            setFantasyStats({});
            return undefined;
        }

        const controller = new AbortController();
        const fetchStats = () => api
            .fantasyStats(fantasyIds, apiDate, { signal: controller.signal })
            .then((data) => setFantasyStats(data.players ?? {}))
            .catch((err) => {
                if (err.name !== 'AbortError') console.error('Fantasy-pisteiden haku epäonnistui:', err);
            });

        fetchStats();

        // Ottelun aikana pisteet päivittyvät; muuten kertahaku riittää.
        const timer = day.hasLiveGames ? setInterval(fetchStats, 30_000) : null;
        return () => {
            controller.abort();
            if (timer) clearInterval(timer);
        };
    }, [fantasyIds, apiDate, day.hasLiveGames]);

    const fantasyList = useMemo(() => {
        const captains = new Set((fantasyTeam ?? []).filter((p) => p.isCaptain).map((p) => p.id));

        return buildPlayerList(fantasyIds, fantasyNames).map((player) => {
            const stats = fantasyStats[player.id];
            if (!stats?.played) return player;

            const isCaptain = captains.has(player.id);
            const result = stats.position === 'G'
                ? scoreGoalie({ ...stats, isCaptain })
                : scoreSkater({ ...stats, isCaptain });

            return {
                ...player,
                // Illan tilastorivi kortille. Ilman tätä kortti näyttäisi
                // "odottaa ottelua" vaikka pisteet ovat jo kertyneet: päivän
                // kooste sisältää vain seurattavan alueen pelaajat, eikä
                // fantasy-joukkue ole välttämättä sillä listalla.
                stats: { ...player.stats, ...stats },
                position: player.position ?? stats.position,
                isPlayingToday: true,
                fantasyPoints: result.total,
                isCaptain,
            };
        });
    }, [buildPlayerList, fantasyIds, fantasyNames, fantasyStats, fantasyTeam]);

    const favList = useMemo(
        () => buildPlayerList(favPlayers.filter((id) => String(id).length === 7)),
        [buildPlayerList, favPlayers],
    );

    const withSeasonStats = useCallback(
        (player) => ({ ...player, seasonStats: seasonStats[player.id] ?? {} }),
        [seasonStats],
    );

    const cardProps = {
        favPlayers, toggleFavPlayer, fantasyTeam, toggleFantasyPlayer, language,
    };

    const renderSection = (titleClass, title, players, variant, onClick, keyPrefix) => {
        if (players.length === 0) return null;
        return (
            <section className="finns-section">
                <h3 className={titleClass}>{title}</h3>
                <div className="h-scroll-wrapper">
                    {sortPlayers(players).map((player) => (
                        <PlayerCard
                            key={`${keyPrefix}-${player.id}`}
                            player={player}
                            variant={variant}
                            onClick={() => onClick(player.id)}
                            {...cardProps}
                        />
                    ))}
                </div>
            </section>
        );
    };

    return (
        <div className="container home-container">
            {goalAlert && (
                <div className="goal-alert" role="status" aria-live="polite">
                    {goalAlert}
                </div>
            )}

            <WhatsNew language={language} />

            <DateNavigation
                currentDateObj={currentDateObj}
                language={language}
                onPrevDay={() => setCurrentDateObj((d) => addDays(d, -1))}
                onNextDay={() => setCurrentDateObj((d) => addDays(d, 1))}
                onRefresh={() => load()}
                isRefreshing={isLoading}
            />

            <div className="games-container">
                {isLoading ? (
                    <div className="loading">{t.homeLoading}</div>
                ) : error ? (
                    <div className="error-state">
                        <p>{error}</p>
                        <button type="button" className="sched-filter-btn" onClick={() => load()}>
                            {language === 'fi' ? 'Yritä uudelleen' : 'Try again'}
                        </button>
                    </div>
                ) : day.games.length === 0 ? (
                    <NoGames next={day.next} language={language} t={t}
                        onPick={(iso) => setCurrentDateObj(new Date(`${iso}T12:00:00`))} />
                ) : (
                    day.games.map((game) => (
                        <GameCard
                            key={game.id}
                            game={game}
                            onClick={() => onGameClick(game)}
                            favTeams={favTeams}
                            toggleFavTeam={toggleFavTeam}
                            language={language}
                        />
                    ))
                )}
            </div>

            {renderSection('otsikko-fantasy', t.homeFantasyTitle, fantasyList, 'fantasy',
                (id) => (onFantasyClick ? onFantasyClick(id) : onPlayerClick(id)), 'fantasy')}

            {renderSection('otsikko-suosikit', t.homeFavTitle, favList, 'fav', onPlayerClick, 'fav')}

            {renderSection('otsikko-tulikuumat', `${t.homeHotTitle} (${formatShort(currentDateObj)})`,
                day.hot.map(withSeasonStats), 'hot', onPlayerClick, 'hot')}

            <section className="finns-section">
                <h3 className="otsikko-suomalaiset">
                    {t.homeFinnsTitle} ({formatShort(currentDateObj)})
                </h3>
                <div className="h-scroll-wrapper">
                    {isLoading ? (
                        <div className="loading">{t.homeFinnsLoading}</div>
                    ) : day.tracked.length === 0 ? (
                        <div className="empty-state">{t.homeNoFinns}</div>
                    ) : (
                        sortPlayers(day.tracked.map(withSeasonStats)).map((player) => (
                            <PlayerCard
                                key={`fin-${player.id}`}
                                player={player}
                                variant="fin"
                                onClick={() => onPlayerClick(player.id)}
                                {...cardProps}
                            />
                        ))
                    )}
                </div>
            </section>
        </div>
    );
};


/**
 * Näkymä pelittömälle päivälle.
 *
 * NHL-kausi on tauolla noin neljä kuukautta vuodessa, ja kesken kaudenkin on
 * pelittömiä päiviä. Pelkkä "ei otteluita" jättää käyttäjän arvailemaan onko
 * sovellus rikki. Nyt kerrotaan milloin seuraavaksi pelataan ja pääsee sinne
 * yhdellä napautuksella.
 */
const NoGames = ({ next, language, t, onPick }) => {
    if (!next) {
        return <div className="empty-state">{t.homeNoGames}</div>;
    }

    const date = new Date(`${next.date}T12:00:00`);
    const paivia = Math.round((date - new Date()) / (1000 * 60 * 60 * 24));

    const muotoiltu = date.toLocaleDateString(language === 'fi' ? 'fi-FI' : 'en-US', {
        weekday: 'long', day: 'numeric', month: 'long',
    });

    return (
        <div className="no-games">
            <p className="no-games-title">{t.homeNoGames}</p>

            <p className="no-games-next">
                {language === 'fi'
                    ? `Seuraavat ottelut ${muotoiltu}`
                    : `Next games on ${muotoiltu}`}
                {paivia > 1 && (
                    <span className="no-games-countdown">
                        {language === 'fi' ? ` · ${paivia} päivän päästä` : ` · in ${paivia} days`}
                    </span>
                )}
            </p>

            <ul className="no-games-list">
                {next.games.map((g) => (
                    <li key={g.id}>
                        <TeamBadge abbrev={g.away} size={22} showText={false} />
                        <span>{g.away} – {g.home}</span>
                        <TeamBadge abbrev={g.home} size={22} showText={false} />
                    </li>
                ))}
            </ul>

            {next.gameCount > next.games.length && (
                <p className="no-games-more">
                    {language === 'fi'
                        ? `+ ${next.gameCount - next.games.length} ottelua lisää`
                        : `+ ${next.gameCount - next.games.length} more games`}
                </p>
            )}

            <button type="button" className="block-btn" onClick={() => onPick(next.date)}>
                {language === 'fi' ? 'Siirry päivään' : 'Go to that day'}
            </button>
        </div>
    );
};

export default HomePage;
