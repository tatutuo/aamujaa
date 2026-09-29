import React, { useMemo, useState } from 'react';
import {
    IconHeart, IconHeartFilled, IconCake, IconMapPin, IconRuler2, IconHandFinger,
    IconTrophy, IconTicket, IconStar, IconStarFilled,
} from '@tabler/icons-react';
import Sheet from './Sheet';
import PlayerForm from './PlayerForm';
import DataTable from './ui/DataTable';
import Segmented from './ui/Segmented';
import Chips from './ui/Chips';
import StatTiles from './ui/StatTiles';
import { api } from '../utils/api';
import { useFetchWhenOpen } from '../hooks/useModal';
import { teamColors, DEFAULT_TEAM_COLORS } from '../utils/teamColors';
import { teamNickname } from '../utils/teams';
import { countryName } from '../utils/nations';
import { positionName, handedness } from '../utils/positions';
import { int, dec, pct, signed, seasonLabel, ageFrom, shortDate, longDate } from '../utils/format';

/**
 * Pelaajakortti.
 *
 * Aamujään kortti näytti vain NHL-kaudet ja oli rakennettu kokonaan
 * inline-tyyleillä. NHL:n rajapinta kertoo kuitenkin koko uran kaikissa
 * sarjoissa — suomalaisella juniorivuodet, Liigan, MM-kisat ja olympialaiset
 * — sekä palkinnot, draftin ja viisi viimeisintä ottelua. Nyt ne kaikki näkyvät.
 */

const isGoaliePosition = (position) => position === 'G';

/** Kausittaisen taulukon rivit: yksi per kausi ja joukkue. */
function seasonRows(player, gameTypeId, nhlOnly) {
    return (player.seasonTotals ?? [])
        .filter((s) => s.gameTypeId === gameTypeId && (!nhlOnly || s.leagueAbbrev === 'NHL'))
        .map((s, i) => ({
            id: `${s.season}-${s.sequence ?? i}-${s.leagueAbbrev}`,
            season: s.season,
            league: s.leagueAbbrev,
            team: s.teamCommonName?.default ?? s.teamName?.default ?? '',
            gp: s.gamesPlayed,
            goals: s.goals,
            assists: s.assists,
            points: s.points,
            wins: s.wins,
            gaa: s.goalsAgainstAvg,
            savePct: s.savePctg,
        }));
}

export default function PlayerModal({
    isOpen, onClose, playerId, favPlayers, toggleFavPlayer,
    fantasyTeam, toggleFantasyPlayer, onGameClick, language, zIndex = 99000,
}) {
    const lang = language === 'en' ? 'en' : 'fi';
    const fi = lang === 'fi';

    const { data: player, isLoading, error } = useFetchWhenOpen(
        isOpen && Boolean(playerId),
        (signal) => api.player(playerId, { signal }),
        [playerId],
    );

    // Muotokäyrä on oma hakunsa: se ei saa hidastaa itse kortin avautumista.
    const { data: form } = useFetchWhenOpen(
        isOpen && Boolean(playerId),
        (signal) => api.playerForm(playerId, undefined, { signal }),
        [playerId],
    );

    const name = player
        ? `${player.firstName?.default ?? ''} ${player.lastName?.default ?? ''}`.trim()
        : (fi ? 'Ladataan…' : 'Loading…');

    const team = player?.currentTeamAbbrev;
    const teamColour = (teamColors[team] ?? DEFAULT_TEAM_COLORS)[0];
    const isFav = favPlayers?.includes(playerId);
    const isFantasy = fantasyTeam?.some((f) => f.id === playerId);

    const headerActions = player && (
        <>
            {toggleFantasyPlayer && (
                <button
                    type="button"
                    className={`icon-toggle ${isFantasy ? 'is-on' : ''}`}
                    onClick={() => toggleFantasyPlayer({ id: playerId, name, position: player.position })}
                    aria-pressed={isFantasy}
                    aria-label={fi ? 'Fantasy-joukkue' : 'Fantasy team'}
                >
                    {isFantasy ? <IconStarFilled size={18} /> : <IconStar size={18} stroke={2} />}
                </button>
            )}
            <button
                type="button"
                className={`icon-toggle ${isFav ? 'is-on' : ''}`}
                onClick={() => toggleFavPlayer(playerId)}
                aria-pressed={isFav}
                aria-label={isFav ? (fi ? 'Poista suosikeista' : 'Remove from favourites') : (fi ? 'Lisää suosikiksi' : 'Add to favourites')}
            >
                {isFav ? <IconHeartFilled size={18} /> : <IconHeart size={18} stroke={2} />}
            </button>
        </>
    );

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            zIndex={zIndex}
            size="full"
            accent={teamColour}
            title={name}
            subtitle={player ? [team && teamNickname(team), positionName(player.position, lang)].filter(Boolean).join(' · ') : undefined}
            headerExtra={headerActions}
        >
            {isLoading ? (
                <div className="skeleton" style={{ height: 420 }} />
            ) : error || !player ? (
                <p className="panel-hint">{fi ? 'Pelaajan tietojen haku epäonnistui.' : 'Could not load player.'}</p>
            ) : (
                <PlayerContent
                    player={player}
                    form={form}
                    teamColour={teamColour}
                    lang={lang}
                    onGameClick={onGameClick}
                />
            )}
        </Sheet>
    );
}

function PlayerContent({ player, form, teamColour, lang, onGameClick }) {
    const fi = lang === 'fi';
    const isGoalie = isGoaliePosition(player.position);
    const [gameType, setGameType] = useState(2);
    const [scope, setScope] = useState('NHL');

    const season = player.featuredStats?.season;
    const current = player.featuredStats?.regularSeason?.subSeason ?? null;
    const currentPlayoffs = player.featuredStats?.playoffs?.subSeason ?? null;
    const career = player.careerTotals?.regularSeason ?? null;

    const rows = useMemo(() => seasonRows(player, gameType, scope === 'NHL'), [player, gameType, scope]);
    const hasOtherLeagues = (player.seasonTotals ?? []).some((s) => s.leagueAbbrev !== 'NHL');

    const age = ageFrom(player.birthDate);
    const draft = player.draftDetails;

    // --- Ruudut ---
    const skaterTiles = (s) => [
        { label: fi ? 'Ottelut' : 'Games', value: int(s.gamesPlayed) },
        { label: fi ? 'Maalit' : 'Goals', value: int(s.goals) },
        { label: fi ? 'Syötöt' : 'Assists', value: int(s.assists) },
        { label: fi ? 'Pisteet' : 'Points', value: int(s.points), tone: 'accent' },
        { label: '+/−', value: signed(s.plusMinus), tone: s.plusMinus > 0 ? 'positive' : s.plusMinus < 0 ? 'negative' : undefined },
        { label: fi ? 'Pisteet/ottelu' : 'Points/game', value: s.gamesPlayed ? dec(s.points / s.gamesPlayed, 2, lang) : '–' },
    ];

    const goalieTiles = (s) => [
        { label: fi ? 'Ottelut' : 'Games', value: int(s.gamesPlayed) },
        { label: fi ? 'Voitot' : 'Wins', value: int(s.wins), tone: 'accent' },
        { label: fi ? 'Torjunta-%' : 'Save %', value: pct(s.savePctg, 1, lang) },
        { label: fi ? 'PÄM' : 'GAA', value: dec(s.goalsAgainstAvg, 2, lang) },
        { label: fi ? 'Nollapelit' : 'Shutouts', value: int(s.shutouts) },
        { label: fi ? 'H / JAH' : 'L / OTL', value: `${int(s.losses)} / ${int(s.otLosses)}` },
    ];

    const tilesFor = (s) => (isGoalie ? goalieTiles(s) : skaterTiles(s));

    // --- Kausittainen taulukko ---
    const seasonColumn = { key: 'season', label: fi ? 'Kausi' : 'Season', format: (v) => seasonLabel(v).slice(2), width: '52px' };
    const columns = isGoalie
        ? [
            seasonColumn,
            { key: 'gp', label: fi ? 'O' : 'GP', title: fi ? 'Ottelut' : 'Games', format: int },
            { key: 'wins', label: fi ? 'V' : 'W', title: fi ? 'Voitot' : 'Wins', format: int },
            { key: 'gaa', label: fi ? 'PÄM' : 'GAA', title: fi ? 'Päästetyt maalit per ottelu' : 'Goals against average', format: (v) => dec(v, 2, lang), lowerIsBetter: true },
            { key: 'savePct', label: fi ? 'T%' : 'SV%', title: fi ? 'Torjuntaprosentti' : 'Save percentage', format: (v) => pct(v, 1, lang) },
        ]
        : [
            seasonColumn,
            { key: 'gp', label: fi ? 'O' : 'GP', title: fi ? 'Ottelut' : 'Games', format: int },
            { key: 'goals', label: fi ? 'M' : 'G', title: fi ? 'Maalit' : 'Goals', format: int },
            { key: 'assists', label: fi ? 'S' : 'A', title: fi ? 'Syötöt' : 'Assists', format: int },
            { key: 'points', label: 'P', title: fi ? 'Pisteet' : 'Points', format: int },
        ];

    // Palkinnot ryhmiteltynä: "Stanley Cup 2026".
    const awards = (player.awards ?? []).map((a) => ({
        name: a.trophy?.default,
        years: (a.seasons ?? []).map((s) => String(s.seasonId).slice(4)).join(', '),
    }));

    return (
        <div className="player-card-v2">
            {/* Tunnisteosa: pelinumero vesileimana joukkueen värissä. */}
            <div className="pc2-hero" style={{ '--team': teamColour }}>
                <div className="pc2-hero-text">
                    <span className="pc2-team">{player.fullTeamName?.default ?? teamNickname(player.currentTeamAbbrev)}</span>
                    <span className="pc2-role">
                        {[positionName(player.position, lang), handedness(player.shootsCatches, isGoalie, lang)].filter(Boolean).join(' · ')}
                    </span>
                </div>
                {player.sweaterNumber && <span className="pc2-number" aria-hidden="true">{player.sweaterNumber}</span>}
            </div>

            <div className="facts pc2-facts">
                {age !== null && (
                    <span className="fact"><IconCake size={14} stroke={2} aria-hidden="true" />
                        <strong>{age} v</strong> {longDate(player.birthDate, lang)}
                    </span>
                )}
                {(player.birthCity || player.birthCountry) && (
                    <span className="fact"><IconMapPin size={14} stroke={2} aria-hidden="true" />
                        {[player.birthCity?.default, countryName(player.birthCountry, lang)].filter(Boolean).join(', ')}
                    </span>
                )}
                {player.heightInCentimeters && (
                    <span className="fact"><IconRuler2 size={14} stroke={2} aria-hidden="true" />
                        {player.heightInCentimeters} cm · {player.weightInKilograms} kg
                    </span>
                )}
                {draft ? (
                    <span className="fact"><IconTicket size={14} stroke={2} aria-hidden="true" />
                        Draft <strong>{draft.year}</strong> · {draft.overallPick}. ({draft.teamAbbrev})
                    </span>
                ) : (
                    <span className="fact"><IconHandFinger size={14} stroke={2} aria-hidden="true" />
                        {fi ? 'Varaamaton' : 'Undrafted'}
                    </span>
                )}
            </div>

            {awards.length > 0 && (
                <div className="awards pc2-awards">
                    {awards.map((a) => (
                        <span key={a.name} className="award">
                            <IconTrophy size={14} stroke={2} aria-hidden="true" />
                            {a.name} {a.years}
                        </span>
                    ))}
                </div>
            )}

            {current && (
                <section className="card-section">
                    <div className="card-section-head">
                        <h3 className="card-section-title">{fi ? 'Kausi' : 'Season'} {seasonLabel(season)}</h3>
                        {currentPlayoffs?.gamesPlayed > 0 && (
                            <span className="pc2-note">
                                {fi ? 'Pudotuspelit' : 'Playoffs'}: {isGoalie
                                    ? `${currentPlayoffs.gamesPlayed} O · ${pct(currentPlayoffs.savePctg, 1, lang)} %`
                                    : `${currentPlayoffs.gamesPlayed} O · ${currentPlayoffs.goals}+${currentPlayoffs.assists}=${currentPlayoffs.points}`}
                            </span>
                        )}
                    </div>
                    <StatTiles tiles={tilesFor(current)} />
                </section>
            )}

            {career && (
                <section className="card-section">
                    <div className="card-section-head">
                        <h3 className="card-section-title">{fi ? 'NHL-ura' : 'NHL career'}</h3>
                    </div>
                    <StatTiles tiles={tilesFor(career)} />
                </section>
            )}

            <EdgeSection playerId={player.playerId} isGoalie={isGoalie} lang={lang} />

            {player.last5Games?.length > 0 && (
                <section className="card-section">
                    <div className="card-section-head">
                        <h3 className="card-section-title">{fi ? 'Viimeiset ottelut' : 'Last games'}</h3>
                    </div>
                    <ul className="recent-games">
                        {player.last5Games.map((g) => (
                            <li key={g.gameId}>
                                <button
                                    type="button"
                                    className="recent-game"
                                    onClick={() => onGameClick?.({
                                        id: g.gameId,
                                        homeTeam: { abbrev: g.homeRoadFlag === 'H' ? g.teamAbbrev : g.opponentAbbrev },
                                        awayTeam: { abbrev: g.homeRoadFlag === 'H' ? g.opponentAbbrev : g.teamAbbrev },
                                    })}
                                >
                                    <span className="recent-date">{shortDate(g.gameDate, lang)}</span>
                                    <span className="recent-opp">
                                        <span className="recent-at">{g.homeRoadFlag === 'H' ? 'vs' : '@'}</span>
                                        <span className="dt-dot" style={{ background: (teamColors[g.opponentAbbrev] ?? DEFAULT_TEAM_COLORS)[0] }} aria-hidden="true" />
                                        {g.opponentAbbrev}
                                        {g.gameTypeId === 3 && <span className="dt-tag">PO</span>}
                                    </span>
                                    {isGoalie ? (
                                        <span className="recent-line num">
                                            {g.decision && <span className={`recent-decision d-${g.decision}`}>{g.decision}</span>}
                                            {g.shotsAgainst - g.goalsAgainst}/{g.shotsAgainst}
                                        </span>
                                    ) : (
                                        <span className="recent-line num">
                                            <strong className={g.points > 0 ? 'has-points' : ''}>{g.goals}+{g.assists}</strong>
                                            <span className="recent-pm">{signed(g.plusMinus)}</span>
                                        </span>
                                    )}
                                    <span className="recent-toi num">{g.toi}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {form?.games?.length > 0 && !isGoalie && (
                <section className="card-section">
                    <div className="card-section-head">
                        <h3 className="card-section-title">{fi ? 'Muoto otteluittain' : 'Form by game'}</h3>
                    </div>
                    <PlayerForm data={form} language={lang} />
                </section>
            )}

            <section className="card-section">
                <div className="card-section-head">
                    <h3 className="card-section-title">{fi ? 'Kausittain' : 'By season'}</h3>
                    <Segmented
                        size="sm"
                        label={fi ? 'Ottelutyyppi' : 'Game type'}
                        value={gameType}
                        onChange={setGameType}
                        options={[
                            { value: 2, label: fi ? 'Runkosarja' : 'Regular' },
                            { value: 3, label: fi ? 'Pudotuspelit' : 'Playoffs' },
                        ]}
                    />
                </div>
                {hasOtherLeagues && (
                    <div style={{ marginBottom: 'var(--space-2)' }}>
                        <Chips
                            label={fi ? 'Sarjat' : 'Leagues'}
                            value={scope}
                            onChange={setScope}
                            options={[
                                { value: 'NHL', label: 'NHL' },
                                { value: 'all', label: fi ? 'Koko ura' : 'Full career' },
                            ]}
                        />
                    </div>
                )}
                <DataTable
                    key={`${gameType}:${scope}`}
                    rows={rows}
                    columns={columns}
                    identity={{
                        label: fi ? 'Joukkue' : 'Team',
                        render: (row) => (
                            <span className="dt-person-text">
                                <span className="dt-name">{row.team}</span>
                                {row.league !== 'NHL' && <span className="dt-meta">{row.league}</span>}
                            </span>
                        ),
                    }}
                    defaultSort={{ key: 'season', dir: 'desc' }}
                    showRank={false}
                    tiesShareRank={false}
                    pageSize={100}
                    language={lang}
                    caption={fi ? 'Tilastot kausittain' : 'Stats by season'}
                />
            </section>
        </div>
    );
}

/**
 * NHL EDGE: pelaajan mittaukset suhteessa liigaan. Palkki kertoo persentiilin
 * (kuinka suuri osa liigan pelaajista jää alle), viiva liigan keskiarvon.
 */
function EdgeSection({ playerId, isGoalie, lang }) {
    const fi = lang === 'fi';
    const { data } = useFetchWhenOpen(
        Boolean(playerId),
        (signal) => api.edgePlayer(playerId, isGoalie, { signal }),
        [playerId, isGoalie],
    );
    if (!data) return null;

    const d1 = (v) => dec(v, 1, lang);
    const rows = isGoalie
        ? [
            { key: 'savePct', label: fi ? 'Torjunta-%' : 'Save %', m: data.savePct, fmt: (v) => pct(v, 1, lang) },
            { key: 'hdSavePct', label: fi ? 'Vaaralliset, torjunta-%' : 'High-danger save %', m: data.hdSavePct, fmt: (v) => pct(v, 1, lang) },
            { key: 'gaa', label: fi ? 'Päästetyt / ottelu' : 'Goals against avg', m: data.gaa, fmt: (v) => dec(v, 2, lang) },
            { key: 'gamesAbove900', label: fi ? 'Ottelut yli ,900' : 'Games above .900', m: data.gamesAbove900, fmt: (v) => `${pct(v, 0, lang)} %` },
            { key: 'goalSupport', label: fi ? 'Maalituki / ottelu' : 'Goal support', m: data.goalSupport, fmt: (v) => dec(v, 2, lang) },
        ]
        : [
            { key: 'maxSpeed', label: fi ? 'Huippunopeus' : 'Top speed', m: data.maxSpeed, fmt: (v) => `${d1(v)} km/h` },
            { key: 'bursts20', label: fi ? 'Pyrähdykset yli 32 km/h' : 'Bursts over 20 mph', m: data.bursts20, fmt: int },
            { key: 'topShot', label: fi ? 'Kovin laukaus' : 'Hardest shot', m: data.topShot, fmt: (v) => `${d1(v)} km/h` },
            { key: 'distance', label: fi ? 'Luisteltu matka' : 'Distance skated', m: data.distance, fmt: (v) => `${d1(v)} km` },
            { key: 'ozPct', label: fi ? 'Aika hyökkäysalueella' : 'Offensive-zone time', m: data.ozPct, fmt: (v) => `${pct(v, 1, lang)} %` },
            { key: 'shots', label: fi ? 'Laukaukset' : 'Shots', m: data.shots, fmt: int },
        ];

    const visible = rows.filter((r) => r.m && r.m.value != null);
    if (visible.length === 0) return null;

    return (
        <section className="card-section">
            <div className="card-section-head">
                <h3 className="card-section-title">NHL EDGE {seasonLabel(data.season)}</h3>
                <span className="pc2-note">{fi ? 'persentiili liigassa' : 'league percentile'}</span>
            </div>
            <ul className="edge-list">
                {visible.map((r) => {
                    const p = r.m.percentile != null ? Math.round(r.m.percentile * 100) : null;
                    return (
                        <li key={r.key} className="edge-item">
                            <span className="edge-label">{r.label}</span>
                            <span className="edge-value num">{r.fmt(r.m.value)}</span>
                            <span className="edge-bar" aria-hidden="true">
                                <span className={`edge-fill ${p >= 90 ? 'is-elite' : p >= 70 ? 'is-good' : ''}`} style={{ width: `${Math.max(3, p ?? 0)}%` }} />
                            </span>
                            <span className="edge-pct num">{p != null ? `${p}.` : '–'}</span>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
