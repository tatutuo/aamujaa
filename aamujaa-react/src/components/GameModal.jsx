import React, { useState, useEffect } from 'react';
import { translations } from '../utils/translations';
import TeamBadge from './TeamBadge'; // Oletetaan samassa kansiossa!

const GameModal = ({ isOpen, onClose, gameData, onTeamClick, onPlayerClick, language }) => {
    const t = translations[language] || translations.fi;
    const [activeRoster, setActiveRoster] = useState(null);
    const [gameDetails, setGameDetails] = useState(null);
    const [boxscore, setBoxscore] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    
    const [activeView, setActiveView] = useState('events'); 

    useEffect(() => {
        if (!isOpen || !gameData) return;

        setIsLoading(true);
        setActiveRoster(null); 
        setActiveView('events'); 

        Promise.all([
            fetch(`/api/nhl/game/${gameData.id}`).then(r => r.json()),
            fetch(`/api/nhl/boxscore/${gameData.id}`).then(r => r.json())
        ])
        .then(([detailsData, boxscoreData]) => {
            setGameDetails(detailsData);
            setBoxscore(boxscoreData);
            setIsLoading(false);
        })
        .catch(err => {
            console.error("Virhe otteludatan haussa:", err);
            setIsLoading(false);
        });

    }, [isOpen, gameData]);

    if (!isOpen || !gameData) return null;

    const homeAbbrev = gameData.homeTeam.abbrev || gameData.homeTeam;
    const awayAbbrev = gameData.awayTeam.abbrev || gameData.awayTeam;

    const venueName = gameDetails?.venue?.default || gameData?.venue?.default || '';
    const threeStars = gameDetails?.summary?.threeStars || [];

    let periods = {}; 
    let runningHome = 0;
    let runningAway = 0;

    if (gameDetails?.summary) {
        (gameDetails.summary.scoring || []).forEach(period => {
            const pNum = period.periodDescriptor.number;
            if (!periods[pNum]) periods[pNum] = { descriptor: period.periodDescriptor, events: [] };
            period.goals.forEach(goal => {
                periods[pNum].events.push({ type: 'goal', time: goal.timeInPeriod, data: goal });
            });
        });

        (gameDetails.summary.penalties || []).forEach(period => {
            const pNum = period.periodDescriptor.number;
            if (!periods[pNum]) periods[pNum] = { descriptor: period.periodDescriptor, events: [] };
            period.penalties.forEach(pen => {
                periods[pNum].events.push({ type: 'penalty', time: pen.timeInPeriod, data: pen });
            });
        });
    }

    const sortedPeriods = Object.values(periods).sort((a, b) => a.descriptor.number - b.descriptor.number);
    
    sortedPeriods.forEach(period => {
        period.events.sort((a, b) => a.time.localeCompare(b.time));
        period.events.forEach(event => {
            if (event.type === 'goal') {
                if (event.data.teamAbbrev?.default === homeAbbrev) {
                    runningHome++;
                } else {
                    runningAway++;
                }
                event.runningScore = `${runningAway} - ${runningHome}`;
            }
        });
    });

    const resolvePenaltyPlayer = (d, boxData) => {
        let name = "Joukkue / Team";
        let id = d.committedByPlayerId || d.servedByPlayerId || null;

        const pObj = d.committedByPlayer || d.servedByPlayer;
        if (pObj) {
            if (typeof pObj === 'object') {
                if (pObj.default) name = pObj.default;
                else if (pObj.firstName && pObj.lastName) {
                    name = `${pObj.firstName.default || pObj.firstName} ${pObj.lastName.default || pObj.lastName}`;
                } else if (pObj.name) {
                    name = pObj.name;
                }
                id = pObj.playerId || pObj.id || id;
            } else {
                name = pObj; 
            }
        }

        if (!id && name !== "Joukkue / Team" && boxData?.playerByGameStats) {
            const siisti = (str) => (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "").toLowerCase().trim();
            const etsittava = siisti(name);

            const kaikkiPelaajat = [
                ...(boxData.playerByGameStats.awayTeam?.forwards || []),
                ...(boxData.playerByGameStats.awayTeam?.defense || []),
                ...(boxData.playerByGameStats.awayTeam?.goalies || []),
                ...(boxData.playerByGameStats.homeTeam?.forwards || []),
                ...(boxData.playerByGameStats.homeTeam?.defense || []),
                ...(boxData.playerByGameStats.homeTeam?.goalies || [])
            ];

            const osuma = kaikkiPelaajat.find(p => {
                const kokoNimi = siisti(p.name?.default || "");
                const suku = siisti(p.lastName?.default || p.lastName || "");
                return suku && (etsittava.includes(suku) || kokoNimi.includes(etsittava));
            });

            if (osuma) {
                id = osuma.playerId;
            }
        }
        return { name, id };
    };

    const renderRosterGroup = (players) => {
        if (!players || players.length === 0) return <span style={{ color: '#666' }}>{t.gmNoData}</span>;
        const sorted = [...players].sort((a, b) => (Number(a.sweaterNumber) || 99) - (Number(b.sweaterNumber) || 99));
        return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {sorted.map(p => {
                    const name = p.name?.default || `${p.firstName?.default} ${p.lastName?.default}`;
                    return (
                        <span 
                            key={p.playerId} 
                            onClick={() => onPlayerClick(p.playerId)} 
                            style={{ background: '#222', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9rem', color: '#ccc', cursor: 'pointer', transition: 'color 0.2s' }}
                            onMouseOver={(e) => e.target.style.color = '#fff'}
                            onMouseOut={(e) => e.target.style.color = '#ccc'}
                        >
                            <span style={{ color: '#888', marginRight: '4px' }}>#{p.sweaterNumber || '-'}</span> 
                            {name}
                        </span>
                    );
                })}
            </div>
        );
    };

    const currentRosterStats = activeRoster === 'away' ? boxscore?.playerByGameStats?.awayTeam : boxscore?.playerByGameStats?.homeTeam;

    const getSOG = (teamStr) => {
        const teamKey = teamStr === 'awayTeam' ? 'away' : 'home';
        return boxscore?.[teamStr]?.sog 
            ?? gameDetails?.[teamStr]?.sog 
            ?? gameData?.[teamStr]?.sog 
            ?? gameDetails?.summary?.teamGameStats?.find(st => st.category === 'sog')?.[`${teamKey}Value`]
            ?? 0;
    };

    const getGameStat = (teamStr, statKey) => {
        const isPreGame = gameData.gameState === 'FUT' || gameData.gameState === 'PRE';
        if (isPreGame) return '0';

        const teamKey = teamStr === 'awayTeam' ? 'away' : 'home';
        let val = undefined;

        if (gameDetails?.summary?.teamGameStats) {
            const stats = gameDetails.summary.teamGameStats.find(st => 
                st.category.toLowerCase() === statKey.toLowerCase()
            );
            if (stats && stats[`${teamKey}Value`] !== undefined) {
                val = stats[`${teamKey}Value`];
            }
        }

        if (val === undefined && boxscore?.[teamStr]) {
            const bTeam = boxscore[teamStr];
            if (statKey === 'pim') val = bTeam.pim;
            if (statKey === 'blockedShots') val = bTeam.blocks ?? bTeam.blockedShots;
            if (statKey === 'powerPlay') val = bTeam.powerPlayConversion;
        }

        if (val === undefined && boxscore?.playerByGameStats?.[teamStr]) {
            const skaters = [...(boxscore.playerByGameStats[teamStr].forwards || []), ...(boxscore.playerByGameStats[teamStr].defense || [])];
            
            if (statKey === 'pim') val = skaters.reduce((s, p) => s + (p.pim || 0), 0);
            if (statKey === 'blockedShots') val = skaters.reduce((s, p) => s + (p.blockedShots || 0), 0);
            if (statKey === 'powerPlay') {
                const ppGoals = skaters.reduce((s, p) => s + (p.powerPlayGoals || 0), 0);
                val = `${ppGoals} ${t.gmPPG || 'YVM'}`; 
            }
        }

        return val !== undefined ? val : '0';
    };

    return (
        <div className="modal-overlay" style={{ display: 'block', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 99999 }}>
            <div className="modal-content" style={{ background: 'linear-gradient(135deg, #1a1a1a, #0d0d0d)', margin: '5% auto', padding: '20px', width: '95%', maxWidth: '600px', borderRadius: '15px', border: '1px solid #444', position: 'relative', maxHeight: '85vh', overflowY: 'auto' }}>
                
                <span className="close-btn" onClick={onClose} style={{ fontSize: '28px', fontWeight: 'bold', cursor: 'pointer', float: 'right', zIndex: 10 }}>&times;</span>
                
                {/* ISOT YLÄLOGOT TURVALLISEKSI */}
                <div className="modal-score-row" style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => onTeamClick(awayAbbrev)}>
                        <TeamBadge abbrev={awayAbbrev} size={70} style={{ margin: '0 auto' }} />
                    </div>
                    <div style={{ fontSize: '3.5rem', fontWeight: 'bold', fontFamily: "'Teko', sans-serif" }}>
                        {gameData.awayTeam?.score ?? '-'}{" - "}{gameData.homeTeam?.score ?? '-'}
                    </div>
                    <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => onTeamClick(homeAbbrev)}>
                        <TeamBadge abbrev={homeAbbrev} size={70} style={{ margin: '0 auto' }} />
                    </div>
                </div>

                {venueName && (
                    <div style={{ textAlign: 'center', color: '#888', fontSize: '0.8rem', marginTop: '-5px', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        📍 {venueName}
                    </div>
                )}

                {/* 3 TÄHTEÄ TURVALLISEKSI (Poistettu headshot linkit) */}
                {threeStars.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px', background: 'rgba(255, 215, 0, 0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
                        {threeStars.map((star, i) => {
                            const sName = star.name?.default || `${star.firstName?.default || ''} ${star.lastName?.default || ''}`.trim();
                            
                            return (
                                <div 
                                    key={i} 
                                    style={{ textAlign: 'center', cursor: 'pointer', flex: 1, transition: 'transform 0.2s' }} 
                                    onClick={() => (star.playerId || star.id) && onPlayerClick(star.playerId || star.id)}
                                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    <div style={{ color: '#ffd700', fontSize: '1rem', marginBottom: '4px' }}>
                                        {'⭐'.repeat(star.star || i + 1)}
                                    </div>
                                    <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: '#222', border: '1px solid #444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: '1.2rem' }}>
                                        👤
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#fff', fontWeight: 'bold', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px', margin: '4px auto 0' }}>
                                        {sName}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '5px', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                    <button 
                        onClick={() => setActiveView('events')}
                        style={{ flex: 1, padding: '8px', background: activeView === 'events' ? '#00d4ff' : '#222', color: activeView === 'events' ? '#000' : '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                        {t.gmTabEvents || "TAPAHTUMAT"}
                    </button>
                    <button 
                        onClick={() => setActiveView('stats')}
                        style={{ flex: 1, padding: '8px', background: activeView === 'stats' ? '#00d4ff' : '#222', color: activeView === 'stats' ? '#000' : '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                        {t.gmTabStats || "TILASTOT"}
                    </button>
                    <button 
                        onClick={() => setActiveView('rosters')}
                        style={{ flex: 1, padding: '8px', background: activeView === 'rosters' ? '#00d4ff' : '#222', color: activeView === 'rosters' ? '#000' : '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                        {t.gmTabRosters || "KOKOONPANOT"}
                    </button>
                </div>

                {isLoading ? (
                    <div className="loading" style={{ textAlign: 'center', padding: '30px', color: 'var(--accent-blue)' }}>{t.gmLoading}</div>
                ) : (
                    <>
                        {activeView === 'events' && (
                            <div style={{ marginBottom: '20px', fontSize: '0.9rem' }}>
                                {sortedPeriods.length > 0 ? (
                                    sortedPeriods.map((period, pIdx) => {
                                        let eraNimi = `${t.gmPeriodObj} ${period.descriptor.number}`;
                                        if (period.descriptor.periodType !== 'REG') eraNimi = period.descriptor.periodType;

                                        return (
                                            <div key={pIdx}>
                                                <div style={{ background: '#222', padding: '5px', marginTop: '10px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                    {eraNimi}
                                                </div>
                                                
                                                {period.events.map((event, eIdx) => {
                                                    const d = event.data;
                                                    const teamAbbrev = d.teamAbbrev?.default;
                                                    
                                                    if (event.type === 'goal') {
                                                        const strength = (d.strength || '').toUpperCase();
                                                        const mod = (d.goalModifier || '').toUpperCase();
                                                        let badge = '';
                                                        
                                                        if (strength === 'PP') badge = <span style={{ color: '#ffaa00', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '8px' }}>{t.gmBadgePP || 'YV'}</span>;
                                                        if (strength === 'SH') badge = <span style={{ color: '#00d4ff', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '8px' }}>{t.gmBadgeSH || 'AV'}</span>;
                                                        if (mod === 'EN' || d.emptyNet) badge = <span style={{ color: '#aaa', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '8px' }}>{t.gmBadgeEN || 'TM'}</span>;
                                                        if (mod === 'PS') badge = <span style={{ color: '#ff4444', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '8px' }}>{t.gmBadgePS || 'RL'}</span>;

                                                        return (
                                                            <div key={eIdx} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #222' }}>
                                                                <span style={{ color: '#ccc', width: '50px', fontSize: '0.8rem' }}>{event.time}</span>
                                                                {/* TAPAHTUMALOGOT TURVALLISEKSI */}
                                                                <TeamBadge abbrev={teamAbbrev} size={25} style={{ marginRight: '10px' }} />
                                                                <div>
                                                                    <span 
                                                                        style={{ color: '#4ade80', fontWeight: 'bold', cursor: 'pointer', transition: 'color 0.2s' }}
                                                                        onClick={() => onPlayerClick(d.playerId)}
                                                                        onMouseOver={(e) => e.target.style.color = '#fff'}
                                                                        onMouseOut={(e) => e.target.style.color = '#4ade80'}
                                                                    >
                                                                        🚨 {d.firstName?.default} {d.lastName?.default} ({d.goalsToDate})
                                                                    </span>
                                                                    
                                                                    <span style={{ background: '#e0e0e0', color: '#111', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', marginLeft: '8px', letterSpacing: '0.5px' }}>
                                                                        {event.runningScore}
                                                                    </span>
                                                                    {badge}

                                                                    <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '3px' }}>
                                                                        {d.assists?.length > 0 
                                                                            ? d.assists.map((a, i) => {
                                                                                const aName = a.name?.default || `${a.firstName?.default || ''} ${a.lastName?.default || ''}`.trim();
                                                                                return (
                                                                                    <span key={i}>
                                                                                        <span 
                                                                                            style={{ cursor: a.playerId ? 'pointer' : 'default', transition: 'color 0.2s' }}
                                                                                            onClick={() => a.playerId && onPlayerClick(a.playerId)}
                                                                                            onMouseOver={(e) => { if(a.playerId) e.target.style.color = '#fff'; }}
                                                                                            onMouseOut={(e) => { if(a.playerId) e.target.style.color = '#666'; }}
                                                                                        >
                                                                                            {aName}
                                                                                        </span>
                                                                                        {i < d.assists.length - 1 ? ', ' : ''}
                                                                                    </span>
                                                                                );
                                                                            })
                                                                            : t.gmNoAssists
                                                                        }
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    } else if (event.type === 'penalty') {
                                                        const { name: playerName, id: playerId } = resolvePenaltyPlayer(d, boxscore);
                                                        const syy = (d.descKey || t.gmPenalty).toUpperCase();
                                                        const min = d.duration || 2;

                                                        return (
                                                            <div key={eIdx} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #222' }}>
                                                                <span style={{ color: '#ffaa00', width: '50px', fontSize: '0.8rem', fontWeight: 'bold' }}>{event.time}</span>
                                                                {/* TAPAHTUMALOGOT TURVALLISEKSI */}
                                                                <TeamBadge abbrev={teamAbbrev} size={25} style={{ marginRight: '10px' }} />
                                                                <div>
                                                                    <span 
                                                                        style={{ color: '#fff', fontWeight: 'bold', cursor: playerId ? 'pointer' : 'default', transition: 'color 0.2s' }}
                                                                        onClick={() => playerId && onPlayerClick(playerId)}
                                                                        onMouseOver={(e) => { if(playerId) e.target.style.color = '#00d4ff'; }}
                                                                        onMouseOut={(e) => { if(playerId) e.target.style.color = '#fff'; }}
                                                                    >
                                                                        {playerName}
                                                                    </span>
                                                                    <div style={{ fontSize: '0.8rem', color: '#ffaa00', marginTop: '3px' }}>
                                                                        {min} min - {syy}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div style={{ color: '#666', padding: '10px 0', textAlign: 'center' }}>{t.gmNoEvents}</div>
                                )}
                            </div>
                        )}

                        {activeView === 'stats' && (
                            <div style={{ animation: 'fadeIn 0.3s' }}>
                                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                        <span style={{ width: '65px', textAlign: 'left' }}>{awayAbbrev}</span>
                                        <span style={{ flex: 1, textAlign: 'center', color: '#888', fontSize: '0.8rem', textTransform: 'uppercase' }}>{t.gmStatTitle || 'Tilasto'}</span>
                                        <span style={{ width: '65px', textAlign: 'right' }}>{homeAbbrev}</span>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #222', alignItems: 'center' }}>
                                        <span style={{ width: '65px', textAlign: 'left', fontSize: '1.3rem', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap' }}>{getSOG('awayTeam')}</span>
                                        <span style={{ flex: 1, textAlign: 'center', color: '#ccc', fontSize: '0.9rem' }}>{t.gmStatSOG || 'Laukaukset (SOG)'}</span>
                                        <span style={{ width: '65px', textAlign: 'right', fontSize: '1.3rem', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap' }}>{getSOG('homeTeam')}</span>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #222', alignItems: 'center' }}>
                                        <span style={{ width: '65px', textAlign: 'left', fontSize: '1.1rem', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap' }}>{getGameStat('awayTeam', 'pim')}</span>
                                        <span style={{ flex: 1, textAlign: 'center', color: '#ccc', fontSize: '0.9rem' }}>{t.gmStatPIM || 'Jäähyminuutit (PIM)'}</span>
                                        <span style={{ width: '65px', textAlign: 'right', fontSize: '1.1rem', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap' }}>{getGameStat('homeTeam', 'pim')}</span>
                                    </div>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #222', alignItems: 'center' }}>
                                        <span style={{ width: '65px', textAlign: 'left', fontSize: '1.1rem', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap' }}>{getGameStat('awayTeam', 'powerPlay')}</span>
                                        <span style={{ flex: 1, textAlign: 'center', color: '#ccc', fontSize: '0.9rem' }}>{t.gmStatPP || 'Ylivoima (PP)'}</span>
                                        <span style={{ width: '65px', textAlign: 'right', fontSize: '1.1rem', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap' }}>{getGameStat('homeTeam', 'powerPlay')}</span>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', alignItems: 'center' }}>
                                        <span style={{ width: '65px', textAlign: 'left', fontSize: '1.1rem', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap' }}>{getGameStat('awayTeam', 'blockedShots')}</span>
                                        <span style={{ flex: 1, textAlign: 'center', color: '#ccc', fontSize: '0.9rem' }}>{t.gmStatBLK || 'Blokit (BLK)'}</span>
                                        <span style={{ width: '65px', textAlign: 'right', fontSize: '1.1rem', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap' }}>{getGameStat('homeTeam', 'blockedShots')}</span>
                                    </div>

                                </div>
                            </div>
                        )}

                        {activeView === 'rosters' && (
                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid #333', animation: 'fadeIn 0.3s' }}>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                    <button 
                                        style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #444', background: activeRoster === 'away' || !activeRoster ? '#333' : '#111', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                                        onClick={() => setActiveRoster('away')}
                                    >
                                        👕 {awayAbbrev}
                                    </button>
                                    <button 
                                        style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #444', background: activeRoster === 'home' ? '#333' : '#111', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                                        onClick={() => setActiveRoster('home')}
                                    >
                                        👕 {homeAbbrev}
                                    </button>
                                </div>
                                
                                {activeRoster && currentRosterStats ? (
                                    <div style={{ textAlign: 'left' }}>
                                        <h4 style={{ color: '#00d4ff', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '5px', borderBottom: '1px solid #444' }}>{t.gmForwards}</h4>
                                        {renderRosterGroup(currentRosterStats.forwards)}
                                        
                                        <h4 style={{ color: '#4ade80', fontSize: '0.8rem', textTransform: 'uppercase', margin: '15px 0 5px 0', borderBottom: '1px solid #444' }}>{t.gmDefense}</h4>
                                        {renderRosterGroup(currentRosterStats.defense)}
                                        
                                        <h4 style={{ color: '#ffcc00', fontSize: '0.8rem', textTransform: 'uppercase', margin: '15px 0 5px 0', borderBottom: '1px solid #444' }}>{t.gmGoalies}</h4>
                                        {renderRosterGroup(currentRosterStats.goalies)}
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', color: '#666', fontStyle: 'italic', padding: '20px 0' }}>
                                        {t.gmSelectTeam || "Valitse joukkue nähdäksesi kokoonpanon."}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default GameModal;