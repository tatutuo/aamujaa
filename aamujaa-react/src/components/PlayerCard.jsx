import React from 'react';
import { translations } from '../utils/translations';
import TeamBadge from './TeamBadge'; // TUOTU UUSI KOMPONENTTI

// --- APUFUNKTIO: ---
const lyhennaKortinNimi = (kokoNimi) => {
    if (!kokoNimi) return { first: '', last: '' };
    const puhdasNimi = kokoNimi.replace(/\./g, '');
    const osat = puhdasNimi.trim().split(' ');

    if (osat.length > 1) {
        const first = `${osat[0].charAt(0)}.`;
        const last = osat.slice(1).join(' ');
        return { first, last };
    }
    
    return { first: '', last: osat[0] };
};

const PlayerCard = ({ player, onClick, variant = 'fin', favPlayers, toggleFavPlayer, fantasyTeam, toggleFantasyPlayer, language }) => {
    if (!player) return null;
    const t = translations[language] || translations.fi;

    let borderColor = '#333';
    if (variant === 'fantasy') borderColor = '#ffd700';
    if (variant === 'hot') borderColor = '#ff4444';

    if (player.isLoading) {
        return (
            <div style={{ background: '#151515', borderRadius: '6px', minWidth: '210px', maxWidth: '210px', padding: '12px', border: `1px solid ${borderColor}`, opacity: 0.6, textAlign: 'center' }}>
                <div style={{ color: '#888', marginTop: '30px' }}>{t.loading || 'Ladataan...'}</div>
            </div>
        );
    }

    const isGoalie = player.position === 'G' || player.position === 'Goalie';
    const isFav = favPlayers?.includes(player.id);
    const isFantasy = fantasyTeam?.some(f => f.id === player.id);
    const isLive = player.fullGameData && (player.fullGameData.gameState === 'LIVE' || player.fullGameData.gameState === 'CRIT');

    const { first: firstName, last: lastName } = lyhennaKortinNimi(player.name);

    const toiStr = player.stats?.toi || player.stats?.timeOnIce || player.stats?.skaterStats?.timeOnIce || player.stats?.goalieStats?.timeOnIce;
    const hasPlayed = toiStr && toiStr !== "00:00" && toiStr !== "0:00" && toiStr !== "0" && toiStr !== "";
    
    const isPlaying = player.isPlayingToday !== false; 
    const ss = player.seasonStats || {};
    
    const hasSeasonStats = ss.gamesPlayed !== undefined && ss.gamesPlayed > 0;

    const lblWaiting = t.pcWaitingGame || "ODOTTAA OTTELUA";
    const lblNoGame = t.pcNoGameToday || "EI PELIÄ TÄNÄÄN";
    const topLabel = isPlaying ? lblWaiting : lblNoGame;
    const txtWait1 = t.pcWaiting || "Odottaa ottelua tai";
    const txtWait2 = t.pcNotPlaying || "poissa kokoonpanosta.";

    let fPoints = 0;
    const s = player.stats?.skaterStats || player.stats?.goalieStats || player.stats || {};
    const game = player.fullGameData;

    const getStat = (keys) => {
        for (let k of keys) {
            if (s[k] !== undefined && s[k] !== null) return Number(s[k]);
            if (player.stats?.[k] !== undefined && player.stats?.[k] !== null) return Number(player.stats[k]);
        }
        return 0;
    };

    if (hasPlayed) {
        if (isGoalie) {
            const g = getStat(['goals']); const a = getStat(['assists']); const pim = getStat(['pim', 'penaltyMinutes']);
            fPoints += (g * 25) + (a * 10) - Math.floor(pim / 2);
            const saves = getStat(['saves']); const ga = getStat(['goalsAgainst']); const dec = player.stats?.decision ?? s.decision ?? '';
            
            if (dec === 'W') { fPoints += 4; if (ga === 0) fPoints += 12; } 
            else if (dec === 'L') { fPoints -= 2; } else if (dec === 'O' || dec === 'OTL') { fPoints += 1; }
            if (saves > 0) { if (saves <= 4) fPoints += 1; else if (saves <= 34) fPoints += 3 + Math.floor((saves - 5) / 5) * 2; else fPoints += 16 + Math.floor((saves - 35) / 5) * 3; }
            if (ga > 0) { if (ga <= 4) fPoints -= ga; else fPoints -= (4 + (ga - 4) * 2); }
        } else {
            const g = getStat(['goals']); const a = getStat(['assists']); const pm = getStat(['plusMinus']);
            const pim = getStat(['pim', 'penaltyMinutes']); const shots = getStat(['shots', 'sog']);
            const hits = getStat(['hits']); const blocks = getStat(['blocked', 'blockedShots']);
            const sbhTotal = shots + hits + blocks;
            fPoints += sbhTotal > 0 ? Math.ceil(sbhTotal / 2) : 0;
            fPoints -= Math.floor(pim / 2);

            const pos = player.position === 'Defenseman' ? 'D' : player.position;
            if (pos === 'D') { fPoints += (g * 9) + (a * 6) + (pm > 0 ? pm * 3 : (pm < 0 ? -(Math.abs(pm) * 2) : 0)); } 
            else { fPoints += (g * 7) + (a * 4) + (pm > 0 ? pm * 2 : (pm < 0 ? -(Math.abs(pm) * 1) : 0)); }

            const rawPctg = getStat(['faceoffWinningPctg', 'faceOffWinningPctg', 'faceoffWinningPercentage']);
            if (rawPctg > 0) {
                const pctg = rawPctg > 1 ? rawPctg / 100 : rawPctg;
                if (pos === 'C' || pos === 'Center') {
                    if (pctg >= 0.68) fPoints += 3; else if (pctg >= 0.58) fPoints += 2; else if (pctg > 0.50) fPoints += 1; else if (pctg > 0.0 && pctg <= 0.35) fPoints -= 2; else if (pctg > 0.35 && pctg < 0.45) fPoints -= 1;
                } else {
                    if (pctg >= 0.50) fPoints += 1; else if (pctg > 0.0 && pctg <= 0.30) fPoints -= 1;
                }
            }
        }
        const starsArray = game?.threeStars || game?.summary?.threeStars || [];
        starsArray.forEach((star, i) => {
            if (Number(star.playerId || star.id) === Number(player.id)) {
                const starRank = Number(star.star || (i+1));
                if (starRank === 1) fPoints += 3; else if (starRank === 2) fPoints += 2; else if (starRank === 3) fPoints += 1;
            }
        });
    }

    const getPlusMinusColor = (pm) => pm > 0 ? '#4ade80' : (pm < 0 ? '#ff4444' : '#fff');
    const getPtsColor = (pts) => pts > 0 ? '#4ade80' : '#fff';

    // --- UUSI YHDEN RIVIN YLÄTUNNISTE (LOGOT KORVATTU TEAMBADGELLA) ---
    const renderHeader = () => (
        <div style={{ marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
            <button onClick={(e) => { e.stopPropagation(); toggleFavPlayer(player.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', padding: '0', color: isFav ? '#ff4444' : '#555', flexShrink: 0 }}>
                {isFav ? '♥' : '♡'}
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '6px', flex: 1, minWidth: 0 }}>
                
                {/* TEAMBADGE PAIKALLEEN */}
                {player.team && <TeamBadge abbrev={player.team} size={20} />}
                
                <span style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#fff', textAlign: 'center', lineHeight: '1.2' }}>
                    {firstName} {lastName}
                    {isLive && <span style={{ color: '#ff4444', fontSize: '0.65rem', marginLeft: '4px', display: 'inline-block', animation: 'pulse 1s infinite' }}>🔴</span>}
                </span>
            </div>
            
            <button onClick={(e) => { e.stopPropagation(); toggleFantasyPlayer({ id: player.id, name: player.name, position: player.position }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', padding: '0', color: isFantasy ? '#ffd700' : '#555', flexShrink: 0 }}>
                {isFantasy ? '⭐' : '☆'}
            </button>
        </div>
    );

    return (
        <div 
            onClick={onClick}
            style={{ background: '#151515', borderRadius: '6px', minWidth: '210px', maxWidth: '210px', padding: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', border: `1px solid ${borderColor}`, transition: 'transform 0.2s, background 0.2s' }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#1a1a1a'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = '#151515'; }}
        >
            {renderHeader()}

            {hasPlayed ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {isGoalie ? (
                        <>
                            {variant === 'fantasy' ? (
                                <StatBox label="F-Points" val={fPoints} valColor="#ffd700" bg="rgba(255, 215, 0, 0.08)" border="rgba(255, 215, 0, 0.2)" />
                            ) : ( <StatBox label={t.statSaves || "Torjunnat"} val={`${getStat(['saves'])}/${getStat(['shotsAgainst'])}`} /> )}
                            <StatBox label={t.statGA || "Päästetyt"} val={getStat(['goalsAgainst'])} valColor="#ff4444" />
                            <StatBox label={t.pcSVP || "SV%"} val={`${(getStat(['savePctg']) * 100).toFixed(1)}%`} />
                            <StatBox label={t.pcTOI || "TOI"} val={player.stats?.toi || "0:00"} />
                        </>
                    ) : (
                        <>
                            {variant === 'fantasy' ? (
                                <>
                                    <StatBox label="F-Points" val={fPoints} valColor="#ffd700" bg="rgba(255, 215, 0, 0.08)" border="rgba(255, 215, 0, 0.2)" />
                                    <StatBox label={t.pcToday || "Tänään"} val={`${getStat(['goals'])}+${getStat(['assists'])}`} valColor={getPtsColor(getStat(['goals'])+getStat(['assists']))} bg={(getStat(['goals'])+getStat(['assists'])) > 0 ? 'rgba(74, 222, 128, 0.08)' : '#1a1a1a'} />
                                </>
                            ) : variant === 'hot' ? (
                                <>
                                    <StatBox label={t.pcPoints || "Pisteet"} val={`${getStat(['goals'])}+${getStat(['assists'])}`} valColor={getPtsColor(getStat(['goals'])+getStat(['assists']))} bg={(getStat(['goals'])+getStat(['assists'])) > 0 ? 'rgba(74, 222, 128, 0.08)' : '#1a1a1a'} />
                                    <StatBox label={t.pcShots || "Laukaukset"} val={getStat(['shots', 'sog'])} />
                                </>
                            ) : (
                                <>
                                    <StatBox label={t.pcToday || "Tänään"} val={`${getStat(['goals'])}+${getStat(['assists'])}`} valColor={getPtsColor(getStat(['goals'])+getStat(['assists']))} bg={(getStat(['goals'])+getStat(['assists'])) > 0 ? 'rgba(74, 222, 128, 0.08)' : '#1a1a1a'} />
                                    <StatBox label={t.pcShots || "Laukaukset"} val={getStat(['shots', 'sog'])} />
                                </>
                            )}
                            <StatBox label={t.statPm || "+/-"} val={getStat(['plusMinus']) > 0 ? `+${getStat(['plusMinus'])}` : getStat(['plusMinus'])} valColor={getPlusMinusColor(getStat(['plusMinus']))} />
                            {variant === 'fantasy' ? (
                                <StatBox label={t.pcShots || "Laukaukset"} val={getStat(['shots', 'sog'])} />
                            ) : (
                                <StatBox label={t.pcTOI || "TOI"} val={player.stats?.toi || "0:00"} />
                            )}
                        </>
                    )}
                </div>
            ) : (
                <>
                    <div style={{ fontSize: '0.65rem', color: '#666', textAlign: 'center', marginBottom: '8px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                        {topLabel}
                    </div>
                    
                    {hasSeasonStats ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            {isGoalie ? (
                                <>
                                    <StatBox label={t.pcGames || "Pelit"} val={ss.gamesPlayed || 0} />
                                    <StatBox label={t.pcWins || "Voitot"} val={ss.wins || 0} valColor="#4ade80" />
                                    <StatBox label={t.statGAA || "GAA"} val={(ss.goalsAgainstAvg ?? ss.goalsAgainstAverage ?? 0).toFixed(2)} />
                                    <StatBox label={t.pcSVP || "SV%"} val={`${(ss.savePctg || 0).toFixed(3)}`} valColor="var(--accent-blue)" />
                                </>
                            ) : (
                                <>
                                    <StatBox label={t.pcGames || "Pelit"} val={ss.gamesPlayed || 0} />
                                    <StatBox label={t.pcPoints || "Pisteet"} val={ss.points || 0} valColor="#ffd700" />
                                    <StatBox label={t.statGoals || "Maalit"} val={ss.goals || 0} />
                                    <StatBox label={t.statAssists || "Syötöt"} val={ss.assists || 0} />
                                </>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '60px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#666', textAlign: 'center', fontStyle: 'italic', fontWeight: '500', letterSpacing: '0.5px' }}>
                                {txtWait1} <br/> {txtWait2}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const StatBox = ({ label, val, valColor = '#ccc', bg = '#1a1a1a', border = '#222' }) => (
    <div style={{ background: bg, borderRadius: '4px', padding: '8px 4px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: `1px solid ${border}` }}>
        <span style={{ fontSize: '0.65rem', color: '#888', marginBottom: '4px' }}>{label}</span>
        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: valColor }}>{val}</span>
    </div>
);

export default PlayerCard;