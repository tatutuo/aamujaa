import React, { useState, useEffect } from 'react';
import { translations } from '../utils/translations';
import TeamBadge from './TeamBadge'; // LISÄTTY TURVALLINEN KOMPONENTTI

const FantasyModal = ({ isOpen, onClose, playerId, fantasyTeam, toggleFantasyPlayer, language }) => {
    const t = translations[language] || translations.fi;

    const [player, setPlayer] = useState(null);
    const [gameData, setGameData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !playerId) return;
        setIsLoading(true);

        fetch(`/api/nhl/player/${playerId}`)
            .then(res => res.json())
            .then(pData => {
                setPlayer(pData);
                
                const d = new Date();
                d.setHours(d.getHours() - 12);
                const apiPvm = d.toISOString().split('T')[0];

                return fetch(`/api/nhl/score?date=${apiPvm}`)
                    .then(res => res.json())
                    .then(scoreData => {
                        const tiimiAbbrev = pData.currentTeamAbbrev || pData.teamAbbrev || '';
                        const peli = (scoreData.games || []).find(g => g.homeTeam.abbrev === tiimiAbbrev || g.awayTeam.abbrev === tiimiAbbrev);
                        
                        if (peli) {
                            if (peli.gameState !== "FUT" && peli.gameState !== "PRE") {
                                return Promise.all([
                                    fetch(`/api/nhl/boxscore/${peli.id}`).then(r => r.json()),
                                    fetch(`/api/nhl/game/${peli.id}`).then(r => r.json())
                                ]).then(([box, game]) => {
                                    setGameData({ boxData: box, fullGameData: game, status: peli.gameState });
                                    setIsLoading(false);
                                });
                            } else {
                                setGameData({ status: 'UPCOMING', startTime: peli.startTimeUTC });
                                setIsLoading(false);
                            }
                        } else {
                            setGameData({ status: 'NO_GAME' });
                            setIsLoading(false);
                        }
                    });
            })
            .catch(err => {
                console.error("Fantasy haku virhe:", err);
                setIsLoading(false);
            });
    }, [isOpen, playerId]);

    if (!isOpen) return null;

    let totalPts = 0;
    let breakdown = [];
    
    const addBd = (label, count, points) => {
        if (points !== 0 || (count !== 0 && count !== "" && count !== "0-0" && count !== "0.0%")) {
            breakdown.push({ label, count, pts: points });
        }
    };

    if (player && gameData && gameData.boxData?.playerByGameStats) {
        const box = gameData.boxData;
        const game = gameData.fullGameData;
        const allPlayers = [
            ...(box.playerByGameStats.awayTeam.forwards || []),
            ...(box.playerByGameStats.awayTeam.defense || []),
            ...(box.playerByGameStats.awayTeam.goalies || []),
            ...(box.playerByGameStats.homeTeam.forwards || []),
            ...(box.playerByGameStats.homeTeam.defense || []),
            ...(box.playerByGameStats.homeTeam.goalies || [])
        ];
        
        const pStats = allPlayers.find(p => Number(p.playerId) === Number(playerId));
        
        if (pStats) {
            const isGoalie = player.position === 'G' || player.position === 'Goalie';
            const s = pStats.stats?.skaterStats || pStats.stats?.goalieStats || pStats.stats || {};
            
            const getStat = (keys) => {
                for (let k of keys) {
                    if (s[k] !== undefined && s[k] !== null) return Number(s[k]);
                    if (pStats[k] !== undefined && pStats[k] !== null) return Number(pStats[k]);
                }
                return 0;
            };

            if (isGoalie) {
                const g = getStat(['goals']); const a = getStat(['assists']); const pim = getStat(['pim', 'penaltyMinutes']);
                let gPts = g * 25; totalPts += gPts; addBd(t.statGoals, g, gPts);
                let aPts = a * 10; totalPts += aPts; addBd(t.statAssists, a, aPts);
                let penPts = Math.max(-10, -(Math.floor(pim / 2))); totalPts += penPts; addBd(t.statPenalties, `${pim} min`, penPts);

                const saves = getStat(['saves']); const ga = getStat(['goalsAgainst']); const dec = pStats.decision ?? s.decision ?? '';
                let decPts = 0;
                if (dec === 'W') { decPts = 4; if (ga === 0) decPts += 12; } else if (dec === 'L') decPts = -2; else if (dec === 'O' || dec === 'OTL') decPts = 1;
                totalPts += decPts; if (dec) addBd(`${t.statResult} (${dec})`, dec, decPts);

                let svPts = 0;
                if (saves > 0) {
                    if (saves <= 4) svPts = 1; else if (saves <= 34) svPts = 3 + Math.floor((saves - 5) / 5) * 2; else svPts = 16 + Math.floor((saves - 35) / 5) * 3;
                }
                totalPts += svPts; addBd(t.statSaves, saves, svPts);

                let gaPts = 0; if (ga > 0) { if (ga <= 4) gaPts = -ga; else gaPts = -(4 + (ga - 4) * 2); }
                totalPts += gaPts; addBd(t.statGA, ga, gaPts);
            } 
            else {
                const g = getStat(['goals']); const a = getStat(['assists']); const pm = getStat(['plusMinus']);
                const pim = getStat(['pim', 'penaltyMinutes']); const shots = getStat(['shots', 'sog']);
                const hits = getStat(['hits']); const blocks = getStat(['blocked', 'blockedShots']);
                
                const sbhTotal = shots + hits + blocks;
                let sbhPts = sbhTotal > 0 ? Math.ceil(sbhTotal / 2) : 0;
                totalPts += sbhPts; addBd(t.statSbh, sbhTotal, sbhPts);

                let penPts = -(Math.floor(pim / 2));
                totalPts += penPts; addBd(t.statPenalties, `${pim} min`, penPts);

                const pos = player.position === 'Defenseman' ? 'D' : player.position;
                if (pos === 'D') {
                    let gPts = g * 9; totalPts += gPts; addBd(t.statGoalsD, g, gPts);
                    let aPts = a * 6; totalPts += aPts; addBd(t.statAssistsD, a, aPts);
                    let pmPts = pm > 0 ? pm * 3 : (pm < 0 ? -(Math.abs(pm) * 2) : 0); totalPts += pmPts; addBd(t.statPm, pm > 0 ? `+${pm}` : pm, pmPts);
                } else {
                    let gPts = g * 7; totalPts += gPts; addBd(t.statGoalsF, g, gPts);
                    let aPts = a * 4; totalPts += aPts; addBd(t.statAssistsF, a, aPts);
                    let pmPts = pm > 0 ? pm * 2 : (pm < 0 ? -(Math.abs(pm) * 1) : 0); totalPts += pmPts; addBd(t.statPm, pm > 0 ? `+${pm}` : pm, pmPts);
                }

                const rawPctg = getStat(['faceoffWinningPctg', 'faceOffWinningPctg', 'faceoffWinningPercentage']);
                if (rawPctg > 0) {
                    const pctg = rawPctg > 1 ? rawPctg / 100 : rawPctg;
                    let foPts = 0;
                    if (pos === 'C' || pos === 'Center') {
                        if (pctg >= 0.68) foPts = 3; else if (pctg >= 0.58) foPts = 2; else if (pctg > 0.50) foPts = 1;
                        else if (pctg > 0.0 && pctg <= 0.35) foPts = -2; else if (pctg > 0.35 && pctg < 0.45) foPts = -1;
                    } else {
                        if (pctg >= 0.50) foPts = 1; else if (pctg > 0.0 && pctg <= 0.30) foPts = -1;
                    }
                    totalPts += foPts; addBd(t.statFO, (pctg * 100).toFixed(1) + "%", foPts);
                }
            }

            let starPts = 0; let starRank = null;
            const starsArray = game?.threeStars || game?.summary?.threeStars || [];
            starsArray.forEach((star, i) => {
                if (Number(star.playerId || star.id) === Number(playerId)) {
                    starRank = Number(star.star || (i+1));
                    if (starRank === 1) starPts = 3; else if (starRank === 2) starPts = 2; else if (starRank === 3) starPts = 1;
                }
            });
            totalPts += starPts; addBd(t.statStarObj, starRank ? `${starRank}${t.statStarRank}` : '-', starPts);
        }
    }

    const isFantasy = fantasyTeam?.some(f => f.id === playerId);

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

    return (
        <div className="modal-overlay" style={{ display: 'block', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.95)', zIndex: 100000 }}>
            <div style={{ display: 'block', position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '95%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#151515', borderRadius: '12px', border: '1px solid #333', padding: '20px' }}>
                <span className="close-card-btn" onClick={onClose} style={{ position: 'absolute', right: '15px', top: '10px', fontSize: '2rem', cursor: 'pointer', color: '#888', lineHeight: 1, zIndex: 10 }}>&times;</span>
                
                {isLoading || !player ? (
                    <div className="loading" style={{ textAlign: 'center', padding: '40px', color: '#ffd700' }}>{t.fModalLoading}</div>
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
                                <div style={{ width: '90px', height: '90px', borderRadius: '50%', backgroundColor: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', color: '#555' }}>
                                    👤
                                </div>
                            </div>
                            
                            <h2 style={{ margin: '15px 0 5px 0', color: '#fff', fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                {player.firstName?.default} {player.lastName?.default}
                                <button className={`fav-tahti ${isFantasy ? 'aktiivinen' : ''}`} onClick={() => toggleFantasyPlayer({ id: player.playerId, name: `${player.firstName?.default} ${player.lastName?.default}`, position: player.position })} style={{ fontSize: '1.4rem', color: isFantasy ? '#ffd700' : '#555', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                    {isFantasy ? '⭐' : '☆'}
                                </button>
                            </h2>
                            <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '25px' }}>
                                {player.currentTeamAbbrev || player.teamAbbrev} | {player.position}
                            </div>
                        </div>
                        
                        <div style={{ padding: '0 10px' }}>
                            <h3 style={{ color: '#ffd700', textAlign: 'center', margin: '0 0 15px 0', fontSize: '1.3rem', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
                                {t.fModalTotal}: <span style={{ fontSize: '1.8rem', marginLeft: '5px' }}>{totalPts}</span>
                            </h3>
                            
                            {breakdown.length > 0 ? (
                                breakdown.map((item, i) => {
                                    const isZero = item.pts === 0;
                                    const vari = item.pts > 0 ? '#4ade80' : (item.pts < 0 ? '#ff4444' : '#666');
                                    return (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #333', padding: '12px 0', color: isZero ? '#666' : '#ccc' }}>
                                            <span>{item.label} <span style={{ fontSize: '0.8rem', color: '#888' }}>({item.count})</span></span>
                                            <span style={{ fontWeight: 'bold', color: vari }}>
                                                {item.pts > 0 ? `+${item.pts}` : item.pts} p
                                            </span>
                                        </div>
                                    );
                                })
                            ) : (
                                <div style={{ color: '#aaa', textAlign: 'center', padding: '20px', fontStyle: 'italic' }}>
                                    {renderEmptyState()}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default FantasyModal;