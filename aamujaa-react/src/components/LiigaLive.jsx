import React, { useState, useEffect } from 'react';
import DateNavigation from './DateNavigation';
import LiigaGameCard from './LiigaGameCard';
import LiigaGameModal from './LiigaGameModal';

const LiigaLive = ({ currentView, onPlayerClick, onTeamClick, favTeams, favPlayers, toggleFavPlayer }) => {
    const getLiigaDate = () => {
        const d = new Date();
        if (d.getHours() < 10) d.setDate(d.getDate() - 1);
        return d;
    };

    const [games, setGames] = useState([]);
    const [standings, setStandings] = useState([]);
    const [players, setPlayers] = useState([]); 
    const [isLoading, setIsLoading] = useState(true);
    
    const [currentDateObj, setCurrentDateObj] = useState(getLiigaDate());
    const [selectedGame, setSelectedGame] = useState(null);
    const [statTab, setStatTab] = useState('points');

    const [todayStats, setTodayStats] = useState({});

    const muotoileApiPvm = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const cleanTeamName = (rawName) => {
        if (!rawName) return '';
        if (rawName.includes(':')) return rawName.split(':').pop().toUpperCase(); 
        return rawName.toUpperCase();
    };

    useEffect(() => {
        if (players.length === 0) {
            fetch('/api/liiga/players').then(r => r.json()).then(setPlayers).catch(console.error);
        }
    }, [players.length]);

    useEffect(() => {
        setIsLoading(true);
        if (currentView === 'home') {
            const fetchGames = async () => {
                try {
                    const res = await fetch(`/api/liiga/games?date=${muotoileApiPvm(currentDateObj)}`);
                    const fetchedGames = await res.json() || [];
                    setGames(fetchedGames);
                    
                    const tStats = {};
                    fetchedGames.forEach(g => {
                        const processEvents = (events, teamName) => {
                            if (!events) return;
                            events.forEach(ev => {
                                if (ev.scorerPlayerId && ev.scorerPlayer) {
                                    const pid = ev.scorerPlayerId;
                                    if (!tStats[pid]) tStats[pid] = { id: pid, firstName: ev.scorerPlayer.firstName, lastName: ev.scorerPlayer.lastName, team: cleanTeamName(teamName), goals: 0, assists: 0, points: 0 };
                                    tStats[pid].goals++;
                                    tStats[pid].points++;
                                }
                                if (ev.assistantPlayers) {
                                    ev.assistantPlayers.forEach(ap => {
                                        const pid = ap.playerId;
                                        if (!tStats[pid]) tStats[pid] = { id: pid, firstName: ap.firstName, lastName: ap.lastName, team: cleanTeamName(teamName), goals: 0, assists: 0, points: 0 };
                                        tStats[pid].assists++;
                                        tStats[pid].points++;
                                    });
                                }
                            });
                        };
                        processEvents(g.homeTeam?.goalEvents, g.homeTeam?.teamName);
                        processEvents(g.awayTeam?.goalEvents, g.awayTeam?.teamName);
                    });
                    setTodayStats(tStats);
                    setIsLoading(false);
                } catch (err) { setIsLoading(false); }
            };
            fetchGames();
            const interval = setInterval(fetchGames, 30000); 
            return () => clearInterval(interval);
        } 
        else if (currentView === 'standings') {
            fetch('/api/liiga/standings').then(r => r.json()).then(data => { setStandings(data || []); setIsLoading(false); }).catch(() => setIsLoading(false));
        }
        else if (currentView === 'stats') {
            fetch('/api/liiga/players').then(r => r.json()).then(data => { setPlayers(data || []); setIsLoading(false); }).catch(() => setIsLoading(false));
        }
    }, [currentView, currentDateObj]);

    const handlePrevDay = () => { const d = new Date(currentDateObj); d.setDate(d.getDate() - 1); setCurrentDateObj(d); }; 
    const handleNextDay = () => { const d = new Date(currentDateObj); d.setDate(d.getDate() + 1); setCurrentDateObj(d); };

    const hotPlayers = Object.values(todayStats)
        .filter(p => p.points >= 2)
        .sort((a, b) => b.points - a.points || b.goals - a.goals);

    const favPlayersData = (favPlayers || [])
        .filter(id => String(id).length !== 7)
        .map(id => {
        const liveData = todayStats[id];
        const seasonData = players.find(p => String(p.id) === String(id));
        
        const teamName = cleanTeamName(liveData?.team || seasonData?.teamId || '');
        const isPlayingToday = games.some(g => cleanTeamName(g.homeTeam?.teamName) === teamName || cleanTeamName(g.awayTeam?.teamName) === teamName);

        return {
            id,
            firstName: liveData?.firstName || seasonData?.firstName || '',
            lastName: liveData?.lastName || seasonData?.lastName || 'Ladataan...',
            team: teamName,
            goalsToday: liveData ? liveData.goals : 0,
            assistsToday: liveData ? liveData.assists : 0,
            pointsToday: liveData ? liveData.points : 0,
            isPlayingToday,
            seasonPoints: seasonData?.points || 0
        };
    });

    const LiigaMiniPlayerCard = ({ p, isHot }) => {
        const isFav = favPlayers?.includes(p.id);
        const borderColor = isHot ? '#ff4444' : '#333';
        
        return (
            <div 
                onClick={() => onPlayerClick(p.id)}
                style={{ background: '#151515', borderRadius: '6px', minWidth: '210px', maxWidth: '210px', padding: '12px', cursor: 'pointer', border: `1px solid ${borderColor}`, transition: 'transform 0.2s', flexShrink: 0 }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
                <div style={{ marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button onClick={(e) => { e.stopPropagation(); toggleFavPlayer(p.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', padding: '0', color: isFav ? '#ff4444' : '#555' }}>
                        {isFav ? '♥' : '♡'}
                    </button>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#fff' }}>{p.firstName ? `${p.firstName.charAt(0)}. ` : ''}{p.lastName}</div>
                    </div>
                </div>

                {isHot || (p.isPlayingToday && p.pointsToday > 0) ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div style={{ background: 'rgba(74, 222, 128, 0.08)', borderRadius: '4px', padding: '8px', textAlign: 'center', border: '1px solid #222' }}>
                            <div style={{ fontSize: '0.65rem', color: '#888', marginBottom: '4px' }}>Tänään</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#4ade80' }}>{p.goalsToday}+{p.assistsToday}</div>
                        </div>
                        <div style={{ background: '#1a1a1a', borderRadius: '4px', padding: '8px', textAlign: 'center', border: '1px solid #222' }}>
                            <div style={{ fontSize: '0.65rem', color: '#888', marginBottom: '4px' }}>Kausi</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ccc' }}>{p.seasonPoints}p</div>
                        </div>
                    </div>
                ) : p.isPlayingToday ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div style={{ background: '#1a1a1a', borderRadius: '4px', padding: '8px', textAlign: 'center', border: '1px solid #222' }}>
                            <div style={{ fontSize: '0.65rem', color: '#888', marginBottom: '4px' }}>Tänään</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ccc' }}>0+0</div>
                        </div>
                        <div style={{ background: '#1a1a1a', borderRadius: '4px', padding: '8px', textAlign: 'center', border: '1px solid #222' }}>
                            <div style={{ fontSize: '0.65rem', color: '#888', marginBottom: '4px' }}>Kausi</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ccc' }}>{p.seasonPoints}p</div>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#666', textAlign: 'center', fontStyle: 'italic', fontWeight: 'bold' }}>EI PELIÄ TÄNÄÄN</div>
                    </div>
                )}
            </div>
        );
    };

    if (currentView === 'home') {
        return (
            <div className="container" style={{ paddingBottom: '80px', animation: 'fadeIn 0.4s' }}>
                <DateNavigation currentDateObj={currentDateObj} language="fi" onPrevDay={handlePrevDay} onNextDay={handleNextDay} isRefreshing={isLoading} theme="liiga" />
                
                {/* OTTELUT */}
                {isLoading ? (
                    <div className="loading" style={{ textAlign: 'center', padding: '50px', color: '#ff6600', animation: 'pulse 1.5s infinite' }}>Haetaan pelejä...</div>
                ) : games.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>Ei otteluita.</div>
                ) : (
                    <div className="games-container" style={{ marginTop: '15px', marginBottom: '30px' }}>
                        {games.map(game => (
                            <LiigaGameCard key={game.id} game={game} onClick={() => setSelectedGame(game)} favTeams={favTeams} />
                        ))}
                    </div>
                )}

                {/* OMAT SUOSIKIT RIVI */}
                {favPlayersData.length > 0 && (
                    <div className="finns-section" style={{ marginBottom: '20px' }}>
                        <h3 className="otsikko-suosikit" style={{ margin: '0 0 10px 10px', fontSize: '1.2rem', color: '#fff' }}>
                            <span style={{ color: '#ff4444', marginRight: '8px' }}>♥</span> Omat Suosikit
                        </h3>
                        <div className="h-scroll-wrapper" style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', paddingLeft: '10px' }}>
                            {favPlayersData.map(p => <LiigaMiniPlayerCard key={p.id} p={p} isHot={false} />)}
                        </div>
                    </div>
                )}

                {/* ILLAN TULIKUUMAT RIVI */}
                {hotPlayers.length > 0 && (
                    <div className="finns-section" style={{ marginBottom: '20px' }}>
                        <h3 className="otsikko-tulikuumat" style={{ margin: '0 0 10px 10px', fontSize: '1.2rem', color: '#fff' }}>
                            🔥 Illan Tulikuumat
                        </h3>
                        <div className="h-scroll-wrapper" style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', paddingLeft: '10px' }}>
                            {hotPlayers.map(p => <LiigaMiniPlayerCard key={p.id} p={{...p, isPlayingToday: true, goalsToday: p.goals, assistsToday: p.assists, pointsToday: p.points}} isHot={true} />)}
                        </div>
                    </div>
                )}
                
                {selectedGame && <LiigaGameModal game={selectedGame} onClose={() => setSelectedGame(null)} onTeamClick={onTeamClick} onPlayerClick={onPlayerClick} />}
            </div>
        );
    }

    if (currentView === 'standings') {
        return (
            <div className="container" style={{ paddingBottom: '80px', animation: 'fadeIn 0.4s' }}>
                <h2 className="page-main-title" style={{ color: '#ff6600' }}>SARJATAULUKKO</h2>
                {isLoading ? (
                    <div className="loading" style={{ textAlign: 'center', padding: '50px', color: '#ff6600', animation: 'pulse 1.5s infinite' }}>Ladataan taulukkoa...</div>
                ) : (
                    <div className="standings-table-container" style={{ maxHeight: '75vh' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #444', color: '#888', fontSize: '0.75rem', background: '#111' }}>
                                    <th style={{ padding: '8px 4px' }}>#</th>
                                    <th style={{ padding: '8px 4px', textAlign: 'left' }}>JOUKKUE</th>
                                    <th style={{ padding: '8px 4px' }}>O</th>
                                    <th style={{ padding: '8px 4px' }}>V</th>
                                    <th style={{ padding: '8px 4px' }}>H</th>
                                    <th style={{ padding: '8px 4px', color: '#ff6600', fontWeight: 'bold' }}>P</th>
                                </tr>
                            </thead>
                            <tbody>
                                {standings.map((team, idx) => (
                                    <tr key={team.teamId} className={idx === 3 || idx === 11 ? 'playoff-line' : ''} style={{ borderBottom: '1px solid #222' }}>
                                        <td style={{ padding: '10px 4px', textAlign: 'center', color: '#888', fontWeight: 'bold' }}>{idx + 1}.</td>
                                        <td 
                                            style={{ padding: '10px 4px', textAlign: 'left', fontWeight: 'bold', color: '#fff', cursor: 'pointer', transition: 'color 0.2s' }}
                                            onClick={() => onTeamClick(team.teamName)}
                                            onMouseOver={(e) => e.target.style.color = '#ff6600'}
                                            onMouseOut={(e) => e.target.style.color = '#fff'}
                                        >
                                            {team.teamName}
                                        </td>
                                        <td style={{ padding: '10px 4px', textAlign: 'center', color: '#bbb' }}>{team.games}</td>
                                        <td style={{ padding: '10px 4px', textAlign: 'center', color: '#4ade80' }}>{team.wins}</td>
                                        <td style={{ padding: '10px 4px', textAlign: 'center', color: '#ff4444' }}>{team.losses}</td>
                                        <td style={{ padding: '10px 4px', textAlign: 'center', color: '#ff6600', fontWeight: 'bold', fontSize: '1.05rem' }}>{team.points}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <h5>Sijat 1-4. suoraan puolivälierävaiheeseen. <br></br>
                    Sijat 5-12. neljännesvälierävaiheeseen.</h5>  

            </div>
        );
    }

    if (currentView === 'stats') {
        let sortedPlayers = [...players];
        if (statTab === 'points') sortedPlayers.sort((a, b) => (b.points||0) - (a.points||0) || (b.goals||0) - (a.goals||0));
        if (statTab === 'goals') sortedPlayers.sort((a, b) => (b.goals||0) - (a.goals||0) || (b.points||0) - (a.points||0));
        
        const displayPlayers = sortedPlayers.slice(0, 50);

        return (
            <div className="container" style={{ paddingBottom: '80px', animation: 'fadeIn 0.4s' }}>
                <h2 className="page-main-title" style={{ color: '#ff6600', marginBottom: '15px' }}>TILASTOT TOP 50</h2>
                
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', justifyContent: 'center' }}>
                    <button onClick={() => setStatTab('points')} style={{ padding: '8px 20px', background: statTab === 'points' ? '#ff6600' : '#222', color: statTab === 'points' ? '#000' : '#fff', border: '1px solid #444', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>PISTEET</button>
                    <button onClick={() => setStatTab('goals')} style={{ padding: '8px 20px', background: statTab === 'goals' ? '#ff6600' : '#222', color: statTab === 'goals' ? '#000' : '#fff', border: '1px solid #444', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>MAALIT</button>
                </div>

                {isLoading ? (
                    <div className="loading" style={{ textAlign: 'center', padding: '50px', color: '#ff6600', animation: 'pulse 1.5s infinite' }}>Ladataan tilastoja...</div>
                ) : (
                    <div className="standings-table-container" style={{ maxHeight: '70vh' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #444', color: '#888', fontSize: '0.75rem', background: '#111' }}>
                                    <th style={{ padding: '8px 4px' }}>#</th>
                                    <th style={{ padding: '8px 4px', textAlign: 'left' }}>PELAAJA</th>
                                    <th style={{ padding: '8px 4px', color: statTab === 'goals' ? '#ff6600' : '#888' }}>M</th>
                                    <th style={{ padding: '8px 4px' }}>S</th>
                                    <th style={{ padding: '8px 4px', color: statTab === 'points' ? '#ff6600' : '#888' }}>P</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayPlayers.map((p, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #222' }}>
                                        <td style={{ padding: '10px 4px', textAlign: 'center', color: '#888', fontWeight: 'bold' }}>{idx + 1}.</td>
                                        <td 
                                            style={{ padding: '10px 4px', textAlign: 'left', cursor: 'pointer' }}
                                            onClick={() => onPlayerClick(p.id)}
                                        >
                                            <div style={{ fontWeight: 'bold', color: '#fff', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = '#ff6600'} onMouseOut={e => e.target.style.color = '#fff'}>
                                                {p.lastName} {p.firstName}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase' }}>
                                                {p.teamId}
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px 4px', textAlign: 'center', color: statTab === 'goals' ? '#ff6600' : '#ccc', fontWeight: statTab === 'goals' ? 'bold' : 'normal' }}>{p.goals || 0}</td>
                                        <td style={{ padding: '10px 4px', textAlign: 'center', color: '#ccc' }}>{p.assists || 0}</td>
                                        <td style={{ padding: '10px 4px', textAlign: 'center', color: statTab === 'points' ? '#ff6600' : '#ccc', fontWeight: statTab === 'points' ? 'bold' : 'normal', fontSize: statTab === 'points' ? '1.05rem' : '0.9rem' }}>{p.points || 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    }

    return null;
};

export default LiigaLive;