import React, { useState, useEffect } from 'react';
import { translations } from '../utils/translations';
import TeamBadge from './TeamBadge';
import { api } from '../utils/api';
import Sheet from './Sheet';
import { toApiDate, getGameDayDate } from '../utils/dates';
import { scoreSkater, scoreGoalie } from '../utils/fantasy';

const FantasyModal = ({
    isOpen, onClose, playerId, fantasyTeam,
    toggleFantasyPlayer, toggleCaptain, language, zIndex = 99000,
}) => {
    const t = translations[language] || translations.fi;

    const [player, setPlayer] = useState(null);
    const [gameData, setGameData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !playerId) return undefined;

        const controller = new AbortController();
        const opts = { signal: controller.signal };
        setIsLoading(true);

        // Korjattu päivämäärä: aiemmin toISOString() antoi UTC-päivän, joten
        // ilta-aikaan haettiin väärän päivän ottelut.
        const apiDate = toApiDate(getGameDayDate());

        (async () => {
            try {
                const playerData = await api.player(playerId, opts);
                setPlayer(playerData);

                const teamAbbrev = playerData.currentTeamAbbrev || playerData.teamAbbrev || '';
                const score = await api.score(apiDate, opts);
                const game = (score.games || []).find(
                    (g) => g.homeTeam.abbrev === teamAbbrev || g.awayTeam.abbrev === teamAbbrev,
                );

                if (!game) {
                    setGameData({ status: 'NO_GAME' });
                } else if (game.gameState === 'FUT' || game.gameState === 'PRE') {
                    setGameData({ status: 'UPCOMING', startTime: game.startTimeUTC });
                } else {
                    /*
                     * Boxscore antaa perustilastot, mutta ei sitä mikä Hockey
                     * GM:n säännöissä ratkaisee pisteet: maalin vahvuuden,
                     * jatkoaika- ja voittomaalit, jäähyt tyypeittäin eikä
                     * aloitusten voitto–häviö-erotusta. Ne tulevat omasta
                     * päätepisteestään.
                     */
                    const [box, events] = await Promise.all([
                        api.boxscore(game.id, opts),
                        api.gameFantasy(game.id, opts).catch(() => null),
                    ]);
                    setGameData({ boxData: box, events, status: game.gameState });
                }
                setIsLoading(false);
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.error('Fantasy-datan haku epäonnistui:', err);
                setIsLoading(false);
            }
        })();

        return () => controller.abort();
    }, [isOpen, playerId]);

    if (!isOpen) return null;

    const fi = language === 'fi';

    /** Erittelyrivin otsikko. Laskenta palauttaa avaimen, käännös tehdään täällä. */
    const rowLabel = (key) => ({
        goals: t.statGoals,
        assists: t.statAssists,
        gameWinner: fi ? 'Voittomaali' : 'Game-winner',
        overtimeGoal: fi ? 'Jatkoaikamaali' : 'Overtime goal',
        shorthandedGoal: fi ? 'Alivoimamaali' : 'Shorthanded goal',
        shorthandedAssist: fi ? 'Alivoimasyöttö' : 'Shorthanded assist',
        plusMinus: t.statPm,
        penalties: t.statPenalties,
        sbh: t.statSbh,
        faceoffs: t.statFO,
        win: fi ? 'Voitto' : 'Win',
        loss: fi ? 'Tappio' : 'Loss',
        otLoss: fi ? 'Tappio jatkoajalla' : 'Overtime loss',
        shutout: fi ? 'Nollapeli' : 'Shutout',
        saves: t.statSaves,
        goalsAgainst: t.statGA,
        star: t.statStarObj,
    }[key] ?? key);

    const isFantasy = fantasyTeam?.some((f) => f.id === playerId);
    const isCaptain = Boolean(fantasyTeam?.find((f) => f.id === playerId)?.isCaptain);

    let totalPts = 0;
    let rawTotal = 0;
    let breakdown = [];

    if (player && gameData?.boxData?.playerByGameStats) {
        const box = gameData.boxData;
        const allPlayers = ['awayTeam', 'homeTeam'].flatMap((side) => [
            ...(box.playerByGameStats[side]?.forwards ?? []),
            ...(box.playerByGameStats[side]?.defense ?? []),
            ...(box.playerByGameStats[side]?.goalies ?? []),
        ]);

        const pStats = allPlayers.find((p) => Number(p.playerId) === Number(playerId));

        if (pStats) {
            const events = gameData.events;
            const own = events?.players?.[playerId] ?? {};
            const starRank = events?.stars?.[playerId] ?? null;

            // Sijainti luetaan boxscoresta: se on ottelukohtainen eikä vanhene
            // pelaajakortin tietoihin nähden esimerkiksi kaupan jälkeen.
            const position = pStats.position ?? player.position;

            // Nollapeli edellyttää, että sama vahti pelasi koko ottelun.
            const ownSide = ['awayTeam', 'homeTeam'].find((side) =>
                (box.playerByGameStats[side]?.goalies ?? []).some((g) => Number(g.playerId) === Number(playerId)));
            const goaliesUsed = (box.playerByGameStats[ownSide]?.goalies ?? [])
                .filter((g) => g.toi && g.toi !== '00:00').length;

            const result = position === 'G'
                ? scoreGoalie({ ...pStats, ...own, starRank, isCaptain, fullGame: goaliesUsed === 1 })
                : scoreSkater({ ...pStats, ...own, position, starRank, isCaptain });

            totalPts = result.total;
            rawTotal = result.rawTotal;
            breakdown = result.breakdown
                // Nollarivit näytetään vain jos niissä on jotain kerrottavaa.
                .filter((r) => r.points !== 0 || (r.count !== 0 && r.count !== null && r.count !== ''))
                .map((r) => ({
                    label: rowLabel(r.key),
                    count: r.key === 'star' && r.count ? `${r.count}${t.statStarRank}` : r.count,
                    pts: r.points,
                }));
        }
    }

    const renderEmptyState = () => {
        if (gameData?.status === 'UPCOMING' && gameData.startTime) {
            const timeString = new Date(gameData.startTime).toLocaleTimeString('fi-FI', {hour: '2-digit', minute:'2-digit'});
            return `${t.fmUpcoming}${timeString})`;
        } else if (gameData?.status === 'NO_GAME') {
            return t.fmNoGameToday;
        } else {
            return t.fmNotInRoster;
        }
    };

    const playerName = player
        ? `${player.firstName?.default ?? ''} ${player.lastName?.default ?? ''}`.trim()
        : t.fModalLoading;

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            zIndex={zIndex}
            accent="var(--gold)"
            title={playerName}
            subtitle={language === 'fi' ? 'Fantasy-pisteet' : 'Fantasy points'}
        >
            <>
                {isLoading || !player ? (
                    <div className="loading">{t.fModalLoading}</div>
                ) : (
                    <>
                        <div style={{ textAlign: 'center', position: 'relative' }}>
                            
                            {/* KORVATTU NHL LOGO TEAMBADGELLA */}
                            <div style={{ position: 'absolute', left: 0, top: 0, opacity: 0.8 }}>
                                {(player.currentTeamAbbrev || player.teamAbbrev) && (
                                    <TeamBadge abbrev={player.currentTeamAbbrev || player.teamAbbrev} size={40} />
                                )}
                            </div>
                            
                            {/* KORVATTU HEADSHOT-KUVA TYYLITELLYLLÄ IKONILLA */}
                            <div style={{ display: 'inline-block', padding: '3px', border: '3px solid #ffd700', borderRadius: '50%', marginTop: '10px' }}>
                                <div style={{ width: '90px', height: '90px', borderRadius: '50%', backgroundColor: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', color: 'var(--text-tertiary)' }}>
                                    👤
                                </div>
                            </div>
                            
                            <h2 style={{ margin: '15px 0 5px 0', color: 'var(--text-primary)', fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                {player.firstName?.default} {player.lastName?.default}
                                <button className={`fav-tahti ${isFantasy ? 'aktiivinen' : ''}`} onClick={() => toggleFantasyPlayer({ id: player.playerId, name: `${player.firstName?.default} ${player.lastName?.default}`, position: player.position })} style={{ fontSize: '1.4rem', color: isFantasy ? 'var(--gold)' : 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                    {isFantasy ? '⭐' : '☆'}
                                </button>
                            </h2>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginBottom: '14px' }}>
                                {player.currentTeamAbbrev || player.teamAbbrev} | {player.position}
                            </div>

                            {/* Kapteeni saa pisteensä 1,3 kertoimella. */}
                            {isFantasy && (
                                <button
                                    type="button"
                                    className={`fm-captain ${isCaptain ? 'is-captain' : ''}`}
                                    onClick={() => toggleCaptain?.(playerId)}
                                >
                                    {isCaptain
                                        ? (fi ? '🅲 Kapteeni · 1,3×' : '🅲 Captain · 1.3×')
                                        : (fi ? 'Aseta kapteeniksi' : 'Make captain')}
                                </button>
                            )}
                        </div>

                        <div style={{ padding: '0 10px' }}>
                            <h3 style={{ color: 'var(--gold)', textAlign: 'center', margin: '0 0 15px 0', fontSize: '1.3rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '15px' }}>
                                {t.fModalTotal}: <span style={{ fontSize: '1.8rem', marginLeft: '5px' }}>{totalPts}</span>
                                {isCaptain && rawTotal !== totalPts && (
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 400, marginTop: '4px' }}>
                                        {rawTotal} × 1,3 {fi ? 'kapteenina' : 'as captain'}
                                    </span>
                                )}
                            </h3>

                            {breakdown.length > 0 ? (
                                breakdown.map((item, i) => {
                                    const isZero = item.pts === 0;
                                    const vari = item.pts > 0 ? 'var(--positive)' : (item.pts < 0 ? 'var(--negative)' : 'var(--text-tertiary)');
                                    return (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #333', padding: '12px 0', color: isZero ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>
                                            <span>{item.label} <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>({item.count})</span></span>
                                            <span style={{ fontWeight: 'bold', color: vari }}>
                                                {item.pts > 0 ? `+${item.pts}` : item.pts} p
                                            </span>
                                        </div>
                                    );
                                })
                            ) : (
                                <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px', fontStyle: 'italic' }}>
                                    {renderEmptyState()}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </>
        </Sheet>
    );
};

export default FantasyModal;