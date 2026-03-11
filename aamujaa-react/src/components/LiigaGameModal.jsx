import React, { useState, useEffect } from 'react';

const LiigaGameModal = ({ game, onClose, onTeamClick, onPlayerClick }) => {
    const [activeView, setActiveView] = useState('events'); 
    const [activeRoster, setActiveRoster] = useState(null);
    const [gameDetails, setGameDetails] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const home = game?.homeTeam;
    const away = game?.awayTeam;

    useEffect(() => {
        if (!game) return;
        setIsLoading(true);
        setActiveRoster(null);
        setActiveView('events');

        fetch(`/api/liiga/game/${game.id}`)
            .then(r => r.json())
            .then(data => { setGameDetails(data); setIsLoading(false); })
            .catch(err => { console.error("Virhe:", err); setIsLoading(false); });
    }, [game]);

    if (!game || !home || !away) return null;

    const formatGameTime = (seconds) => {
        if (!seconds) return "00:00";
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    let allEvents = [];
    const addEvents = (teamData, isHome, teamName) => {
        if (!teamData) return;
        if (teamData.goalEvents) teamData.goalEvents.forEach(e => allEvents.push({ ...e, type: 'goal', isHome, teamName }));
        if (teamData.penaltyEvents) teamData.penaltyEvents.forEach(e => allEvents.push({ ...e, type: 'penalty', isHome, teamName }));
    };

    const hData = gameDetails?.game?.homeTeam || home;
    const aData = gameDetails?.game?.awayTeam || away;
    
    addEvents(hData, true, home.teamName);
    addEvents(aData, false, away.teamName);
    allEvents.sort((a, b) => a.gameTime - b.gameTime);

    let runHome = 0; let runAway = 0;
    allEvents.forEach(e => {
        if (e.type === 'goal') {
            if (e.isHome) runHome++; else runAway++;
            e.runningScore = `${runHome} - ${runAway}`; 
        }
    });

    const eventsByPeriod = {};
    allEvents.forEach(e => {
        const p = e.period || 1;
        if (!eventsByPeriod[p]) eventsByPeriod[p] = [];
        eventsByPeriod[p].push(e);
    });

    const homeLogo = home.logos?.lightBg || home.logos?.darkBg;
    const awayLogo = away.logos?.lightBg || away.logos?.darkBg;

    const calcPim = (teamName) => {
        const teamPenalties = allEvents.filter(e => e.type === 'penalty' && e.teamName === teamName);
        return teamPenalties.length > 0 ? teamPenalties.reduce((sum, e) => sum + (e.duration || 2), 0) : 0;
    };
    
    const hPim = calcPim(home.teamName); const aPim = calcPim(away.teamName);
    const hXG = home.expectedGoals?.toFixed(2) || '0.00'; const aXG = away.expectedGoals?.toFixed(2) || '0.00';
    const hPP = `${home.powerplayGoals || 0} / ${home.powerplayInstances || 0}`; const aPP = `${away.powerplayGoals || 0} / ${away.powerplayInstances || 0}`;
    const hSH = home.shortHandedGoals || 0; const aSH = away.shortHandedGoals || 0;

    const getRosterGroup = (teamType, keywords) => {
        if (!gameDetails || !gameDetails[`${teamType}Players`]) return [];
        return gameDetails[`${teamType}Players`]
            .filter(p => keywords.some(kw => (p.role || p.position || '').toUpperCase().includes(kw)))
            .sort((a, b) => (a.jersey || a.sweaterNumber || 99) - (b.jersey || b.sweaterNumber || 99));
    };

    const renderRosterGroup = (players, labelColor) => {
        if (!players || players.length === 0) return null;
        return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {players.map((p, idx) => (
                    <span 
                        key={idx} 
                        onClick={() => onPlayerClick && onPlayerClick(p.id || p.playerId)}
                        style={{ background: '#222', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9rem', color: '#ccc', cursor: 'pointer', border: '1px solid #333' }}
                        onMouseOver={e => e.currentTarget.style.borderColor = '#ff6600'}
                        onMouseOut={e => e.currentTarget.style.borderColor = '#333'}
                    >
                        <span style={{ color: labelColor, marginRight: '4px', fontWeight: 'bold' }}>#{p.jersey || p.sweaterNumber || '-'}</span> 
                        {p.firstName} {p.lastName}
                    </span>
                ))}
            </div>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content liiga-modal" onClick={(e) => e.stopPropagation()} style={{ background: 'linear-gradient(135deg, #1a1a1a, #0d0d0d)', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '5px' }}>
                    <span onClick={onClose} style={{ color: '#aaa', fontSize: '28px', fontWeight: 'bold', cursor: 'pointer', lineHeight: 1 }}>&times;</span>
                </div>

                {/* KORJATTU: Lähetetään onTeamClickille pelkkä teamName (esim. "Tappara"), ei ID:tä! */}
                <div className="modal-score-row" style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ textAlign: 'center', width: '30%', cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => onTeamClick && onTeamClick(home.teamName)} onMouseOver={e => e.currentTarget.style.transform='scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform='scale(1)'}>
                        <img src={homeLogo} alt={home.teamName} style={{ height: '70px', objectFit: 'contain' }} />
                        <h2 style={{ margin: '5px 0', color: '#fff', fontSize: '1.2rem' }}>{home.teamName}</h2>
                    </div>
                    
                    <div style={{ fontSize: '3.5rem', fontWeight: 'bold', fontFamily: "'Teko', sans-serif", color: '#fff', textShadow: '0 0 20px rgba(255,102,0,0.3)' }}>
                        {game.started ? home.goals : '-'}{" - "}{game.started ? away.goals : '-'}
                    </div>

                    <div style={{ textAlign: 'center', width: '30%', cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => onTeamClick && onTeamClick(away.teamName)} onMouseOver={e => e.currentTarget.style.transform='scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform='scale(1)'}>
                        <img src={awayLogo} alt={away.teamName} style={{ height: '70px', objectFit: 'contain' }} />
                        <h2 style={{ margin: '5px 0', color: '#fff', fontSize: '1.2rem' }}>{away.teamName}</h2>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '5px', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                    <button onClick={() => setActiveView('events')} style={{ flex: 1, padding: '8px', background: activeView === 'events' ? '#ff6600' : '#222', color: activeView === 'events' ? '#000' : '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>TAPAHTUMAT</button>
                    <button onClick={() => setActiveView('stats')} style={{ flex: 1, padding: '8px', background: activeView === 'stats' ? '#ff6600' : '#222', color: activeView === 'stats' ? '#000' : '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>TILASTOT</button>
                    <button onClick={() => setActiveView('rosters')} style={{ flex: 1, padding: '8px', background: activeView === 'rosters' ? '#ff6600' : '#222', color: activeView === 'rosters' ? '#000' : '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>KOKOONPANOT</button>
                </div>

                {isLoading && activeView !== 'events' ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#ff6600', animation: 'pulse 1s infinite' }}>Ladataan dataa...</div>
                ) : (
                    <>
                        {activeView === 'events' && (
                            <div style={{ animation: 'fadeIn 0.3s', fontSize: '0.9rem' }}>
                                {Object.keys(eventsByPeriod).length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>Ei tapahtumia vielä.</div>
                                ) : (
                                    Object.keys(eventsByPeriod).map(periodNum => {
                                        let pName = `ERÄ ${periodNum}`;
                                        if (periodNum === '4') pName = "JATKOAIKA";
                                        if (periodNum === '5') pName = "VOITTOOLAUKAUKSET";

                                        return (
                                            <div key={periodNum}>
                                                <div style={{ background: '#222', padding: '5px', marginTop: '10px', fontSize: '0.8rem', fontWeight: 'bold', color: '#fff' }}>{pName}</div>
                                                {eventsByPeriod[periodNum].map((event, idx) => {
                                                    const isGoal = event.type === 'goal';
                                                    const logo = event.isHome ? homeLogo : awayLogo;
                                                    
                                                    let pNameStr = "Tuntematon";
                                                    let clickedId = null;

                                                    if (isGoal && event.scorerPlayer) {
                                                        pNameStr = `${event.scorerPlayer.firstName} ${event.scorerPlayer.lastName}`;
                                                        clickedId = event.scorerPlayerId || event.scorerPlayer.id;
                                                    } else if (!isGoal) {
                                                        const pObj = event.penalizedPlayer || event.player;
                                                        if (pObj && pObj.firstName) {
                                                            pNameStr = `${pObj.firstName} ${pObj.lastName}`;
                                                            clickedId = event.penalizedPlayerId || event.playerId;
                                                        } else if (gameDetails && (event.playerId || event.penalizedPlayerId)) {
                                                            clickedId = event.playerId || event.penalizedPlayerId;
                                                            const allP = [...(gameDetails.homeTeamPlayers || []), ...(gameDetails.awayTeamPlayers || [])];
                                                            const found = allP.find(p => p.id === clickedId || p.playerId === clickedId);
                                                            if (found) pNameStr = `${found.firstName} ${found.lastName}`;
                                                        }
                                                    }

                                                    if (isGoal) {
                                                        const assists = event.assistantPlayers ? event.assistantPlayers.map(p => `${p.firstName.charAt(0)}. ${p.lastName}`).join(', ') : '';
                                                        let badge = '';
                                                        if (event.goalTypes) {
                                                            if (event.goalTypes.includes('YV')) badge = <span style={{ color: '#ffaa00', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '8px' }}>YV</span>;
                                                            else if (event.goalTypes.includes('AV')) badge = <span style={{ color: '#00d4ff', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '8px' }}>AV</span>;
                                                            else if (event.goalTypes.includes('TM')) badge = <span style={{ color: '#aaa', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '8px' }}>TM</span>;
                                                        }
                                                        return (
                                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #222' }}>
                                                                <span style={{ color: '#ccc', width: '50px', fontSize: '0.8rem' }}>{formatGameTime(event.gameTime)}</span>
                                                                <img src={logo} style={{ width: '25px', height: '25px', marginRight: '10px', objectFit: 'contain' }} alt="team" />
                                                                <div>
                                                                    <span 
                                                                        style={{ color: '#4ade80', fontWeight: 'bold', cursor: clickedId ? 'pointer' : 'default' }}
                                                                        onClick={() => clickedId && onPlayerClick && onPlayerClick(clickedId)}
                                                                    >
                                                                        🚨 {pNameStr}
                                                                    </span>
                                                                    <span style={{ background: '#e0e0e0', color: '#111', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', marginLeft: '8px' }}>{event.runningScore}</span>
                                                                    {badge}
                                                                    <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '3px' }}>{assists || 'Ei syöttäjiä'}</div>
                                                                </div>
                                                            </div>
                                                        );
                                                    } else {
                                                        return (
                                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #222' }}>
                                                                <span style={{ color: '#ffaa00', width: '50px', fontSize: '0.8rem', fontWeight: 'bold' }}>{formatGameTime(event.gameTime)}</span>
                                                                <img src={logo} style={{ width: '25px', height: '25px', marginRight: '10px', objectFit: 'contain' }} alt="team" />
                                                                <div>
                                                                    <span 
                                                                        style={{ color: '#fff', fontWeight: 'bold', cursor: clickedId ? 'pointer' : 'default' }}
                                                                        onClick={() => clickedId && onPlayerClick && onPlayerClick(clickedId)}
                                                                    >
                                                                        {pNameStr}
                                                                    </span>
                                                                    <div style={{ fontSize: '0.8rem', color: '#ffaa00', marginTop: '3px' }}>{event.duration || 2} min - {event.reason || 'JÄÄHY'}</div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                })}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {activeView === 'stats' && (
                            <div style={{ animation: 'fadeIn 0.3s' }}>
                                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                        <span style={{ width: '65px', textAlign: 'left', color: '#fff' }}>{home.teamName}</span>
                                        <span style={{ flex: 1, textAlign: 'center', color: '#888', fontSize: '0.8rem', textTransform: 'uppercase' }}>TILASTO</span>
                                        <span style={{ width: '65px', textAlign: 'right', color: '#fff' }}>{away.teamName}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #222', alignItems: 'center' }}>
                                        <span style={{ width: '65px', textAlign: 'left', fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{hPim}</span>
                                        <span style={{ flex: 1, textAlign: 'center', color: '#ccc', fontSize: '0.9rem' }}>Jäähyminuutit</span>
                                        <span style={{ width: '65px', textAlign: 'right', fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{aPim}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #222', alignItems: 'center' }}>
                                        <span style={{ width: '65px', textAlign: 'left', fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{hPP}</span>
                                        <span style={{ flex: 1, textAlign: 'center', color: '#ccc', fontSize: '0.9rem' }}>Ylivoima</span>
                                        <span style={{ width: '65px', textAlign: 'right', fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{aPP}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #222', alignItems: 'center' }}>
                                        <span style={{ width: '65px', textAlign: 'left', fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{hSH}</span>
                                        <span style={{ flex: 1, textAlign: 'center', color: '#ccc', fontSize: '0.9rem' }}>Alivoimamaalit</span>
                                        <span style={{ width: '65px', textAlign: 'right', fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{aSH}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', alignItems: 'center' }}>
                                        <span style={{ width: '65px', textAlign: 'left', fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{hXG}</span>
                                        <span style={{ flex: 1, textAlign: 'center', color: '#ccc', fontSize: '0.9rem' }}>Maaliodottama (xG)</span>
                                        <span style={{ width: '65px', textAlign: 'right', fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{aXG}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeView === 'rosters' && (
                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid #333', animation: 'fadeIn 0.3s' }}>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                    <button style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #444', background: activeRoster === 'home' || !activeRoster ? '#333' : '#111', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => setActiveRoster('home')}>
                                        🏠 {home.teamName}
                                    </button>
                                    <button style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #444', background: activeRoster === 'away' ? '#333' : '#111', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => setActiveRoster('away')}>
                                        ✈️ {away.teamName}
                                    </button>
                                </div>
                                {(() => {
                                    const currentTeamStr = activeRoster === 'away' ? 'awayTeam' : 'homeTeam';
                                    const hyokkaajat = getRosterGroup(currentTeamStr, ['WING', 'CENTER', 'ATTACKER', 'FORWARD']);
                                    const pakit = getRosterGroup(currentTeamStr, ['DEFENSE']);
                                    const veskarit = getRosterGroup(currentTeamStr, ['GOAL']);

                                    return (
                                        <div style={{ textAlign: 'left' }}>
                                            <h4 style={{ color: '#00d4ff', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '5px', borderBottom: '1px solid #444' }}>HYÖKKÄÄJÄT</h4>
                                            {renderRosterGroup(hyokkaajat, '#00d4ff')}
                                            
                                            <h4 style={{ color: '#4ade80', fontSize: '0.8rem', textTransform: 'uppercase', margin: '15px 0 5px 0', borderBottom: '1px solid #444' }}>PUOLUSTAJAT</h4>
                                            {renderRosterGroup(pakit, '#4ade80')}
                                            
                                            <h4 style={{ color: '#ffcc00', fontSize: '0.8rem', textTransform: 'uppercase', margin: '15px 0 5px 0', borderBottom: '1px solid #444' }}>MAALIVAHDIT</h4>
                                            {renderRosterGroup(veskarit, '#ffcc00')}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default LiigaGameModal;