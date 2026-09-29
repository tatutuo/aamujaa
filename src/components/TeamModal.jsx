import React, { useMemo, useState } from 'react';
import { IconHeart, IconHeartFilled, IconHome, IconPlane, IconFlame, IconChartLine } from '@tabler/icons-react';
import Sheet from './Sheet';
import DataTable from './ui/DataTable';
import Segmented from './ui/Segmented';
import Chips from './ui/Chips';
import StatTiles from './ui/StatTiles';
import { PlayerIdentity } from './table/Identity';
import { api } from '../utils/api';
import { useFetchWhenOpen } from '../hooks/useModal';
import { useSettings } from '../state/settings';
import { teamColors, DEFAULT_TEAM_COLORS } from '../utils/teamColors';
import { teamByAbbrev, teamNickname } from '../utils/teams';
import { countryName } from '../utils/nations';
import { positionLabel } from '../utils/positions';
import { int, dec, pct, signed, seasonLabel, ageFrom } from '../utils/format';
import { SKATER_GROUPS, GOALIE_GROUPS } from '../views/stats/tableConfigs';

/**
 * Joukkuekortti.
 *
 * Aamujään kortissa oli vain otteluluettelo ja nimilappuina esitetty
 * kokoonpano, eikä suosikkisydän tehnyt mitään. Nyt kortti kertoo joukkueen
 * sarjatilanteen ja sijoitukset liigassa, ottelut tuloksineen, kokoonpanon
 * taulukkona sekä joukkueen oman pistepörssin.
 */

const colourOf = (abbrev) => (teamColors[abbrev] ?? DEFAULT_TEAM_COLORS)[0];

const CONFERENCE = { Eastern: { fi: 'Itä', en: 'East' }, Western: { fi: 'Länsi', en: 'West' } };

const isPlayed = (g) => g.gameState === 'FINAL' || g.gameState === 'OFF';
const isLive = (g) => g.gameState === 'LIVE' || g.gameState === 'CRIT';

/** Sijoitus liigassa (1 = paras) annetun arvon mukaan. */
function leagueRank(rows, abbrev, value, lowerIsBetter = false) {
    const own = rows.find((r) => r.team === abbrev);
    if (!own || value(own) == null) return null;
    const mine = value(own);
    const better = rows.filter((r) => {
        const v = value(r);
        return v != null && (lowerIsBetter ? v < mine : v > mine);
    }).length;
    return better + 1;
}

/** Putki suomeksi: "W3" -> "3 V", "OT2" -> "2 JA". */
function streakLabel(streak, fi) {
    const match = /^([A-Z]+)(\d+)$/.exec(streak ?? '');
    if (!match) return null;
    const [, code, count] = match;
    const labels = fi ? { W: 'voittoa', L: 'tappiota', OT: 'JA-tappiota' } : { W: 'wins', L: 'losses', OT: 'OT losses' };
    return `${count} ${labels[code] ?? code}`;
}

const localise = (columns, lang) => columns.map((c) => ({ ...c, label: c.label[lang], title: c.title[lang] }));

export default function TeamModal({ isOpen, onClose, teamAbbrev, onPlayerClick, onGameClick, language, zIndex = 99000 }) {
    const { favTeams, toggleFavTeam } = useSettings();
    const lang = language === 'en' ? 'en' : 'fi';
    const fi = lang === 'fi';

    const team = teamByAbbrev(teamAbbrev);
    const colour = colourOf(teamAbbrev);
    const isFav = favTeams.includes(teamAbbrev);

    // Otsikkotiedot (sarjataulukko + joukkuetilastot) ovat pieniä ja välimuistissa,
    // joten ne haetaan heti. Ottelut ja kokoonpano ovat joukkuekohtaisia.
    const { data: overview } = useFetchWhenOpen(
        isOpen && Boolean(teamAbbrev),
        (signal) => Promise.all([
            api.standings(undefined, { signal }),
            api.statsTable('teams', {}, { signal }),
        ]).then(([standings, teams]) => ({ standings, teams })),
        [],
    );

    const { data: schedule, isLoading: scheduleLoading } = useFetchWhenOpen(
        isOpen && Boolean(teamAbbrev),
        (signal) => api.team(teamAbbrev, { signal }),
        [teamAbbrev],
    );

    const headerActions = teamAbbrev && (
        <button
            type="button"
            className={`icon-toggle ${isFav ? 'is-on' : ''}`}
            onClick={() => toggleFavTeam(teamAbbrev)}
            aria-pressed={isFav}
            aria-label={isFav ? (fi ? 'Poista suosikeista' : 'Remove from favourites') : (fi ? 'Lisää suosikiksi' : 'Add to favourites')}
        >
            {isFav ? <IconHeartFilled size={18} /> : <IconHeart size={18} stroke={2} />}
        </button>
    );

    if (!isOpen || !teamAbbrev) return null;

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            zIndex={zIndex}
            size="full"
            accent={colour}
            title={team?.name ?? teamAbbrev}
            subtitle={team ? `${team.division} · ${CONFERENCE[team.conference]?.[lang] ?? team.conference}` : undefined}
            headerExtra={headerActions}
        >
            <TeamContent
                key={teamAbbrev}
                abbrev={teamAbbrev}
                colour={colour}
                overview={overview}
                schedule={schedule}
                scheduleLoading={scheduleLoading}
                lang={lang}
                isOpen={isOpen}
                onPlayerClick={onPlayerClick}
                onGameClick={onGameClick}
            />
        </Sheet>
    );
}

function TeamContent({ abbrev, colour, overview, schedule, scheduleLoading, lang, isOpen, onPlayerClick, onGameClick }) {
    const fi = lang === 'fi';
    const [tab, setTab] = useState('games');

    const standing = overview?.standings?.teams?.find((r) => r.team === abbrev) ?? null;
    const teamRows = useMemo(() => overview?.teams?.rows ?? [], [overview]);
    const teamStats = teamRows.find((r) => r.team === abbrev) ?? null;
    const standingsSeason = overview?.standings?.season;

    const rank = (value, lowerIsBetter) => {
        const r = leagueRank(teamRows, abbrev, value, lowerIsBetter);
        return r ? `${r}./${teamRows.length}` : undefined;
    };

    const tiles = standing ? [
        { label: fi ? 'Pisteet' : 'Points', value: int(standing.points), sub: rank((r) => r.points), tone: 'accent' },
        { label: fi ? 'Voitot' : 'Wins', value: int(standing.wins), sub: fi ? `${standing.losses} H · ${standing.otLosses} JA` : `${standing.losses} L · ${standing.otLosses} OT` },
        { label: fi ? 'Piste-%' : 'Point %', value: pct(standing.pointPct, 1, lang), sub: rank((r) => r.pointPct) },
        { label: fi ? 'Maaliero' : 'Goal diff', value: signed(standing.goalDiff), tone: standing.goalDiff > 0 ? 'positive' : standing.goalDiff < 0 ? 'negative' : undefined, sub: `${standing.goalsFor}–${standing.goalsAgainst}` },
        { label: fi ? 'Ylivoima-%' : 'PP %', value: pct(teamStats?.ppPct, 1, lang), sub: rank((r) => r.ppPct) },
        { label: fi ? 'Alivoima-%' : 'PK %', value: pct(teamStats?.pkPct, 1, lang), sub: rank((r) => r.pkPct) },
    ] : null;

    return (
        <div className="team-card">
            <div className="pc2-hero" style={{ '--team': colour }}>
                <div className="pc2-hero-text">
                    {standing ? (
                        <>
                            <span className="pc2-team">
                                {fi
                                    ? `${standing.divSeq}. ${standing.division} · ${standing.leagueSeq}. liigassa`
                                    : `${standing.divSeq}. ${standing.division} · ${standing.leagueSeq}. in league`}
                            </span>
                            <span className="pc2-role">
                                {fi ? 'Sarjataulukko' : 'Standings'} {seasonLabel(standingsSeason)}
                                {overview?.standings?.isPreviousSeason && (fi ? ' (lopputilanne)' : ' (final)')}
                            </span>
                        </>
                    ) : (
                        <span className="pc2-team">{teamNickname(abbrev)}</span>
                    )}
                </div>
                <span className="pc2-number tc-abbrev" aria-hidden="true">{abbrev}</span>
            </div>

            {standing && (
                <div className="facts pc2-facts">
                    <span className="fact"><IconHome size={14} stroke={2} aria-hidden="true" />{fi ? 'Koti' : 'Home'} <strong>{standing.home}</strong></span>
                    <span className="fact"><IconPlane size={14} stroke={2} aria-hidden="true" />{fi ? 'Vieras' : 'Road'} <strong>{standing.road}</strong></span>
                    <span className="fact"><IconChartLine size={14} stroke={2} aria-hidden="true" />{fi ? '10 viim.' : 'Last 10'} <strong>{standing.l10}</strong></span>
                    {streakLabel(standing.streak, fi) && (
                        <span className="fact"><IconFlame size={14} stroke={2} aria-hidden="true" />{fi ? 'Putki' : 'Streak'} <strong>{streakLabel(standing.streak, fi)}</strong></span>
                    )}
                </div>
            )}

            {tiles ? (
                <section className="card-section">
                    <StatTiles tiles={tiles} />
                </section>
            ) : (
                <div className="skeleton" style={{ height: 140, marginTop: 'var(--space-4)' }} />
            )}

            <div className="tc-tabs">
                <Segmented
                    label={fi ? 'Näkymä' : 'View'}
                    value={tab}
                    onChange={setTab}
                    options={[
                        { value: 'games', label: fi ? 'Ottelut' : 'Games' },
                        { value: 'roster', label: fi ? 'Kokoonpano' : 'Roster' },
                        { value: 'stats', label: fi ? 'Tilastot' : 'Stats' },
                    ]}
                />
            </div>

            {tab === 'games' && (
                <TeamGames abbrev={abbrev} schedule={schedule} isLoading={scheduleLoading} lang={lang} onGameClick={onGameClick} />
            )}
            {tab === 'roster' && (
                <TeamRoster abbrev={abbrev} lang={lang} isOpen={isOpen} onPlayerClick={onPlayerClick} />
            )}
            {tab === 'stats' && (
                <TeamStats abbrev={abbrev} teamRows={teamRows} lang={lang} isOpen={isOpen} onPlayerClick={onPlayerClick} />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Ottelut
// ---------------------------------------------------------------------------

const GAMES_PAGE = 15;

function gameDateLabel(g, lang) {
    const d = new Date(g.startTimeUTC);
    const weekday = d.toLocaleDateString(lang === 'en' ? 'en-US' : 'fi-FI', { weekday: 'short' }).replace('.', '');
    return lang === 'en'
        ? `${weekday} ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : `${weekday} ${d.getDate()}.${d.getMonth() + 1}.`;
}

const startTime = (g, lang) => new Date(g.startTimeUTC)
    .toLocaleTimeString(lang === 'en' ? 'en-GB' : 'fi-FI', { hour: '2-digit', minute: '2-digit' });

function TeamGames({ abbrev, schedule, isLoading, lang, onGameClick }) {
    const fi = lang === 'fi';
    const games = useMemo(() => schedule?.games ?? [], [schedule]);
    const played = useMemo(() => games.filter((g) => isPlayed(g)).reverse(), [games]);
    const upcoming = useMemo(() => games.filter((g) => !isPlayed(g)), [games]);

    const [which, setWhich] = useState(null);
    const [shown, setShown] = useState(GAMES_PAGE);
    // Oletuksena tulevat, paitsi kauden päätyttyä pelatut.
    const active = which ?? (upcoming.length > 0 ? 'upcoming' : 'played');
    const list = active === 'upcoming' ? upcoming : played;

    if (isLoading) return <div className="skeleton" style={{ height: 320 }} />;
    if (games.length === 0) return <p className="panel-hint">{fi ? 'Ei otteluita.' : 'No games.'}</p>;

    return (
        <>
            <div className="tc-filter">
                <Chips
                    label={fi ? 'Ottelut' : 'Games'}
                    value={active}
                    onChange={(v) => { setWhich(v); setShown(GAMES_PAGE); }}
                    options={[
                        { value: 'upcoming', label: fi ? 'Tulevat' : 'Upcoming', count: upcoming.length },
                        { value: 'played', label: fi ? 'Pelatut' : 'Played', count: played.length },
                    ]}
                />
            </div>

            {list.length === 0 ? (
                <p className="panel-hint">{active === 'upcoming' ? (fi ? 'Ei tulevia otteluita.' : 'No upcoming games.') : (fi ? 'Ei vielä pelattuja otteluita.' : 'No games played yet.')}</p>
            ) : (
                <ul className="team-games">
                    {list.slice(0, shown).map((g, i) => (
                        <li key={g.id}>
                            <TeamGameRow
                                game={g}
                                abbrev={abbrev}
                                lang={lang}
                                isNext={active === 'upcoming' && i === 0}
                                onClick={() => onGameClick?.(g)}
                            />
                        </li>
                    ))}
                </ul>
            )}

            {list.length > shown && (
                <button type="button" className="dt-more" onClick={() => setShown((n) => n + GAMES_PAGE)}>
                    {fi ? `Näytä lisää · ${list.length} yhteensä` : `Show more · ${list.length} total`}
                </button>
            )}
        </>
    );
}

function TeamGameRow({ game, abbrev, lang, isNext, onClick }) {
    const fi = lang === 'fi';
    const isHome = game.homeTeam?.abbrev === abbrev;
    const us = isHome ? game.homeTeam : game.awayTeam;
    const them = isHome ? game.awayTeam : game.homeTeam;
    const opponent = them?.abbrev ?? '';

    let result;
    if (isPlayed(game)) {
        const won = (us?.score ?? 0) > (them?.score ?? 0);
        const extra = game.gameOutcome?.lastPeriodType;
        const suffix = extra === 'OT' ? (fi ? ' JA' : ' OT') : extra === 'SO' ? (fi ? ' VL' : ' SO') : '';
        result = (
            <span className={`tg-result ${won ? 'is-win' : extra === 'OT' || extra === 'SO' ? 'is-otl' : 'is-loss'}`}>
                <span className="tg-wl">{won ? (fi ? 'V' : 'W') : (fi ? 'H' : 'L')}</span>
                <span className="num">{us?.score}–{them?.score}</span>
                {suffix && <span className="tg-extra">{suffix.trim()}</span>}
            </span>
        );
    } else if (isLive(game)) {
        result = (
            <span className="tg-result is-live">
                <span className="tg-wl">LIVE</span>
                <span className="num">{us?.score ?? 0}–{them?.score ?? 0}</span>
            </span>
        );
    } else {
        result = <span className="tg-time num">{game.gameScheduleState === 'PPD' ? (fi ? 'Siirretty' : 'PPD') : startTime(game, lang)}</span>;
    }

    const typeTag = game.gameType === 1 ? (fi ? 'HO' : 'PRE') : game.gameType === 3 ? (fi ? 'PO' : 'PO') : null;

    return (
        <button type="button" className={`team-game ${isNext ? 'is-next' : ''}`} onClick={onClick}>
            <span className="tg-date">
                {isNext && <span className="tg-next">{fi ? 'Seuraava' : 'Next'}</span>}
                {gameDateLabel(game, lang)}
            </span>
            <span className="tg-opp">
                <span className="recent-at">{isHome ? 'vs' : '@'}</span>
                <span className="dt-dot" style={{ background: colourOf(opponent) }} aria-hidden="true" />
                <span className="tg-opp-abbrev">{opponent}</span>
                <span className="tg-opp-name">{teamNickname(opponent)}</span>
                {typeTag && <span className="dt-tag" title={game.gameType === 1 ? (fi ? 'Harjoitusottelu' : 'Preseason') : (fi ? 'Pudotuspelit' : 'Playoffs')}>{typeTag}</span>}
            </span>
            {result}
        </button>
    );
}

// ---------------------------------------------------------------------------
// Kokoonpano
// ---------------------------------------------------------------------------

const ROSTER_GROUPS = [
    { value: 'forwards', label: { fi: 'Hyökkääjät', en: 'Forwards' } },
    { value: 'defensemen', label: { fi: 'Puolustajat', en: 'Defense' } },
    { value: 'goalies', label: { fi: 'Maalivahdit', en: 'Goalies' } },
];

function TeamRoster({ abbrev, lang, isOpen, onPlayerClick }) {
    const fi = lang === 'fi';
    const [group, setGroup] = useState('forwards');

    const { data, isLoading, error } = useFetchWhenOpen(
        isOpen,
        (signal) => api.roster(abbrev, { signal }),
        [abbrev],
    );

    const rows = useMemo(() => (data?.[group] ?? []).map((p) => ({
        id: p.id,
        name: `${p.firstName?.default ?? ''} ${p.lastName?.default ?? ''}`.trim(),
        pos: p.positionCode,
        nat: p.birthCountry,
        number: p.sweaterNumber ?? null,
        age: ageFrom(p.birthDate),
        height: p.heightInCentimeters ?? null,
        weight: p.weightInKilograms ?? null,
    })), [data, group]);

    if (isLoading) return <div className="skeleton" style={{ height: 320 }} />;
    if (error || !data) return <p className="panel-hint">{fi ? 'Kokoonpanon haku epäonnistui.' : 'Could not load roster.'}</p>;

    const columns = [
        { key: 'number', label: '#', title: fi ? 'Pelinumero' : 'Number', format: int, lowerIsBetter: true },
        { key: 'age', label: fi ? 'Ikä' : 'Age', title: fi ? 'Ikä' : 'Age', format: int, lowerIsBetter: true },
        { key: 'height', label: 'cm', title: fi ? 'Pituus' : 'Height', format: int },
        { key: 'weight', label: 'kg', title: fi ? 'Paino' : 'Weight', format: int },
    ];

    return (
        <>
            <div className="tc-filter">
                <Chips
                    label={fi ? 'Pelipaikka' : 'Position'}
                    value={group}
                    onChange={setGroup}
                    options={ROSTER_GROUPS.map((g) => ({ value: g.value, label: g.label[lang], count: data[g.value]?.length ?? 0 }))}
                />
            </div>
            <DataTable
                key={group}
                rows={rows}
                columns={columns}
                identity={{
                    label: fi ? 'Pelaaja' : 'Player',
                    render: (row) => (
                        <span className="dt-person">
                            <span className="dt-dot" style={{ background: colourOf(abbrev) }} aria-hidden="true" />
                            <span className="dt-person-text">
                                <span className="dt-name">{row.name}</span>
                                <span className="dt-meta">
                                    {[positionLabel(row.pos, lang), countryName(row.nat, lang)].filter(Boolean).join(' · ')}
                                </span>
                            </span>
                        </span>
                    ),
                }}
                defaultSort={{ key: 'number', dir: 'asc' }}
                onRowClick={(row) => onPlayerClick(row.id)}
                showRank={false}
                pageSize={60}
                language={lang}
                caption={fi ? 'Kokoonpano' : 'Roster'}
            />
        </>
    );
}

// ---------------------------------------------------------------------------
// Tilastot: joukkueen pistepörssi ja sijoitukset liigassa
// ---------------------------------------------------------------------------

function TeamStats({ abbrev, teamRows, lang, isOpen, onPlayerClick }) {
    const fi = lang === 'fi';
    const [who, setWho] = useState('skaters');
    const [skaterGroup, setSkaterGroup] = useState('basic');
    const [goalieGroup, setGoalieGroup] = useState('basic');

    const { data, isLoading, error } = useFetchWhenOpen(
        isOpen,
        (signal) => Promise.all([
            api.statsTable('skaters', {}, { signal }),
            api.statsTable('goalies', {}, { signal }),
        ]).then(([skaters, goalies]) => ({ skaters, goalies })),
        [],
    );

    const skaters = useMemo(() => (data?.skaters?.rows ?? []).filter((r) => r.team === abbrev), [data, abbrev]);
    const goalies = useMemo(() => (data?.goalies?.rows ?? []).filter((r) => r.team === abbrev), [data, abbrev]);
    const own = teamRows.find((r) => r.team === abbrev);

    const rankOf = (field, lowerIsBetter = false) => {
        const r = leagueRank(teamRows, abbrev, (row) => row[field], lowerIsBetter);
        return r ? `${r}./${teamRows.length}` : undefined;
    };

    const rankTiles = own ? [
        { label: fi ? 'Maalit/O' : 'GF/GP', value: dec(own.gfPerGame, 2, lang), sub: rankOf('gfPerGame') },
        { label: fi ? 'Päästetyt/O' : 'GA/GP', value: dec(own.gaPerGame, 2, lang), sub: rankOf('gaPerGame', true) },
        { label: fi ? 'Laukaukset/O' : 'Shots/GP', value: dec(own.shotsForPerGame, 1, lang), sub: rankOf('shotsForPerGame') },
        { label: fi ? 'Lauk. vastaan/O' : 'SA/GP', value: dec(own.shotsAgainstPerGame, 1, lang), sub: rankOf('shotsAgainstPerGame', true) },
        { label: fi ? 'Aloitus-%' : 'Faceoff %', value: pct(own.faceoffPct, 1, lang), sub: rankOf('faceoffPct') },
        { label: 'Corsi-%', value: pct(own.corsiPct, 1, lang), sub: rankOf('corsiPct') },
    ] : null;

    const groups = who === 'skaters' ? SKATER_GROUPS : GOALIE_GROUPS;
    const groupId = who === 'skaters' ? skaterGroup : goalieGroup;
    const setGroupId = who === 'skaters' ? setSkaterGroup : setGoalieGroup;
    const group = groups.find((g) => g.id === groupId) ?? groups[0];
    const rows = who === 'skaters' ? skaters : goalies;
    const season = data?.skaters?.season;

    return (
        <>
            {rankTiles && (
                <section className="card-section tc-first">
                    <div className="card-section-head">
                        <h3 className="card-section-title">{fi ? 'Sijoitus liigassa' : 'League rank'}</h3>
                    </div>
                    <StatTiles tiles={rankTiles} />
                </section>
            )}

            <section className="card-section">
                <div className="card-section-head">
                    <h3 className="card-section-title">
                        {fi ? 'Pelaajat' : 'Players'} {season && seasonLabel(season)}
                    </h3>
                    <Segmented
                        size="sm"
                        label={fi ? 'Pelaajat' : 'Players'}
                        value={who}
                        onChange={setWho}
                        options={[
                            { value: 'skaters', label: fi ? 'Kenttä' : 'Skaters' },
                            { value: 'goalies', label: fi ? 'Maalivahdit' : 'Goalies' },
                        ]}
                    />
                </div>

                {data?.skaters?.isPreviousSeason && (
                    <p className="panel-hint tc-hint">
                        {fi
                            ? 'Kausi ei ole vielä alkanut, joten luvut ovat edelliseltä kaudelta (pelaajat, jotka päättivät kauden tässä joukkueessa).'
                            : 'The season has not started, so these are last season’s numbers (players who finished the season with this team).'}
                    </p>
                )}

                <div className="tc-filter">
                    <Chips
                        label={fi ? 'Sarakeryhmä' : 'Column group'}
                        value={group.id}
                        onChange={setGroupId}
                        options={groups.map((g) => ({ value: g.id, label: g.label[lang] }))}
                    />
                </div>

                {isLoading ? (
                    <div className="skeleton" style={{ height: 320 }} />
                ) : error ? (
                    <p className="panel-hint">{fi ? 'Tilastojen haku epäonnistui.' : 'Could not load stats.'}</p>
                ) : (
                    <DataTable
                        key={`${who}:${group.id}`}
                        rows={rows}
                        columns={localise(group.columns, lang)}
                        identity={{ label: fi ? 'Pelaaja' : 'Player', render: (row) => <PlayerIdentity row={row} language={lang} /> }}
                        defaultSort={{ key: who === 'skaters' ? 'points' : 'wins', dir: 'desc' }}
                        isQualified={(row) => row.gp >= 10}
                        qualifierNote={fi ? 'Alle 10 ottelua' : 'Fewer than 10 games'}
                        onRowClick={(row) => onPlayerClick(row.id)}
                        pageSize={60}
                        language={lang}
                        caption={fi ? 'Joukkueen pelaajatilastot' : 'Team player stats'}
                    />
                )}
            </section>
        </>
    );
}
