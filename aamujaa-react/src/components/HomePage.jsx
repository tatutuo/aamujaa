import React, { useState, useEffect, useRef } from 'react';
import DateNavigation from './DateNavigation';
import GameCard from './GameCard';
import PlayerCard from './PlayerCard';
import { translations } from '../utils/translations'; 

const HomePage = ({ 
    onPlayerClick, onGameClick, onFantasyClick,
    favTeams, toggleFavTeam,
    favPlayers, toggleFavPlayer,
    fantasyTeam, toggleFantasyPlayer,
    language 
}) => {
    const t = translations[language] || translations.fi;

    const getAamujaaDate = () => {
        const d = new Date();
        d.setHours(d.getHours() - 12);
        return d;
    };
    
    const [currentDateObj, setCurrentDateObj] = useState(getAamujaaDate());
    const [games, setGames] = useState([]);
    const [isGamesLoading, setIsGamesLoading] = useState(true);
    const [players, setPlayers] = useState([]);
    const [isPlayersLoading, setIsPlayersLoading] = useState(true);
    
    const [allPlayersToday, setAllPlayersToday] = useState([]);
    const [extraPlayerData, setExtraPlayerData] = useState({}); 

    const previousScores = useRef({}); 
    const [goalAlert, setGoalAlert] = useState(null); 

    const muotoilePvm = (date) => `${date.getDate()}.${date.getMonth() + 1}.`;
    const muotoileApiPvm = (date) => date.toISOString().split('T')[0];

    const sortPlayers = (playersList) => {
        return [...playersList].sort((a, b) => {
            const aPlays = a.isPlayingToday !== false;
            const bPlays = b.isPlayingToday !== false;
            
            if (aPlays && !bPlays) return -1;
            if (!aPlays && bPlays) return 1;

            const isGoalieA = a.position === 'G' || a.position === 'Goalie';
            const isGoalieB = b.position === 'G' || b.position === 'Goalie';
            if (isGoalieA && !isGoalieB) return 1;
            if (!isGoalieA && isGoalieB) return -1;
            
            if (isGoalieA && isGoalieB) {
                const aSv = aPlays ? (a.stats?.saves || 0) : (a.seasonStats?.wins || 0);
                const bSv = bPlays ? (b.stats?.saves || 0) : (b.seasonStats?.wins || 0);
                return bSv - aSv;
            }

            const getP = (p, key) => p.stats?.skaterStats?.[key] ?? p.stats?.[key] ?? 0;
            const ptsA = aPlays ? (getP(a, 'goals') + getP(a, 'assists')) : (a.seasonStats?.points || 0);
            const ptsB = bPlays ? (getP(b, 'goals') + getP(b, 'assists')) : (b.seasonStats?.points || 0);
            
            if (ptsB !== ptsA) return ptsB - ptsA; 
            
            const glsA = aPlays ? getP(a, 'goals') : (a.seasonStats?.goals || 0);
            const glsB = bPlays ? getP(b, 'goals') : (b.seasonStats?.goals || 0);
            return glsB - glsA;
        });
    };

    const fetchAndSetPlayerStats = (fetchedGames) => {
        if (!fetchedGames || fetchedGames.length === 0) {
            setAllPlayersToday([]);
            return;
        }
        
        Promise.all(fetchedGames.map(g => 
            Promise.all([
                fetch(`/api/nhl/boxscore/${g.id}`).then(r=>r.json()).catch(()=>null),
                fetch(`/api/nhl/game/${g.id}`).then(r=>r.json()).catch(()=>null)
            ])
        ))
        .then(results => {
            let allSkaters = [];
            results.forEach(([box, game], idx) => {
                if (!box || !box.playerByGameStats) return;
                const gameInfo = fetchedGames[idx];
                
                ['awayTeam', 'homeTeam'].forEach(teamType => {
                    const teamAbbrev = teamType === 'awayTeam' ? gameInfo.awayTeam.abbrev : gameInfo.homeTeam.abbrev;
                    ['forwards', 'defense', 'goalies'].forEach(posGroup => {
                        const rosterPlayers = box.playerByGameStats[teamType][posGroup] || [];
                        rosterPlayers.forEach(p => {
                            const rosterSpot = game?.rosterSpots?.find(rs => rs.playerId === p.playerId);
                            const fName = rosterSpot?.firstName?.default || p.firstName?.default || p.firstName || '';
                            const lName = rosterSpot?.lastName?.default || p.lastName?.default || p.lastName || '';
                            const finalName = (fName && lName) ? `${fName} ${lName}` : (p.name?.default || p.name || '');

                            allSkaters.push({
                                id: p.playerId,
                                name: finalName,
                                position: p.position || (posGroup === 'goalies' ? 'G' : 'F'),
                                team: teamAbbrev,
                                stats: p,
                                fullGameData: game 
                            });
                        });
                    });
                });
            });
            setAllPlayersToday(allSkaters);
        });
    };

    const fetchData = () => {
        const apiPvm = muotoileApiPvm(currentDateObj);
        setIsGamesLoading(true);
        setIsPlayersLoading(true);
        setGoalAlert(null); 

        fetch(`/api/nhl/score?date=${apiPvm}`)
            .then(res => res.json())
            .then(data => {
                const fetchedGames = data.games || [];
                setGames(fetchedGames);
                setIsGamesLoading(false);

                fetchedGames.forEach(g => {
                    previousScores.current[g.id] = { away: g.awayTeam.score || 0, home: g.homeTeam.score || 0 };
                });

                fetchAndSetPlayerStats(fetchedGames);
            })
            .catch(() => setIsGamesLoading(false));

        fetch(`/api/nhl/suomalaiset?date=${apiPvm}&alue=${language}`)
            .then(res => res.json())
            .then(data => {
                setPlayers(Array.isArray(data) ? data : []);
                setIsPlayersLoading(false);
            })
            .catch(() => setIsPlayersLoading(false));
    };

    useEffect(() => {
        fetchData();
    }, [currentDateObj, language]); 

    // --- KAUSIDATAN HAKU ---
    useEffect(() => {
        const allTrackedIds = [...new Set([
            ...favPlayers, 
            ...(fantasyTeam || []).map(f => f.id),
            ...players.map(p => p.id)
        ])];
        
        const missingIds = allTrackedIds.filter(id => !extraPlayerData[id]);
        
        missingIds.forEach(id => {
            if (String(id).length === 7) {
                fetch(`/api/nhl/player/${id}`)
                    .then(r => r.json())
                    .then(data => {
                        setExtraPlayerData(prev => ({ ...prev, [id]: data }));
                    })
                    .catch(err => console.error("Virhe NHL-pelaajan haussa:", err));
            }
        });
    }, [favPlayers, fantasyTeam, players]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            if (muotoileApiPvm(currentDateObj) !== muotoileApiPvm(getAamujaaDate())) return;

            const apiPvm = muotoileApiPvm(currentDateObj);
            fetch(`/api/nhl/score?date=${apiPvm}`)
                .then(res => res.json())
                .then(data => {
                    const fetchedGames = data.games || [];
                    let newGoals = [];

                    fetchedGames.forEach(game => {
                        const oldMatch = previousScores.current[game.id];
                        if (oldMatch) {
                            const awayScored = (game.awayTeam.score || 0) > oldMatch.away;
                            const homeScored = (game.homeTeam.score || 0) > oldMatch.home;
                            if (awayScored || homeScored) {
                                newGoals.push(`🚨 ${game.awayTeam.abbrev} ${game.awayTeam.score} - ${game.homeTeam.score} ${game.homeTeam.abbrev} 🚨`);
                            }
                        }
                        previousScores.current[game.id] = { away: game.awayTeam.score || 0, home: game.homeTeam.score || 0 };
                    });

                    if (newGoals.length > 0) {
                        setGoalAlert(newGoals.join('  |  '));
                        setTimeout(() => setGoalAlert(null), 8000);
                        fetchAndSetPlayerStats(fetchedGames);
                    }
                    setGames(fetchedGames);
                });
        }, 30000);
        return () => clearInterval(intervalId);
    }, [currentDateObj]);

    const handlePrevDay = () => {
        const uusiPvm = new Date(currentDateObj);
        uusiPvm.setDate(uusiPvm.getDate() - 1);
        setCurrentDateObj(uusiPvm);
    }; 
    const handleNextDay = () => {
        const uusiPvm = new Date(currentDateObj);
        uusiPvm.setDate(uusiPvm.getDate() + 1);
        setCurrentDateObj(uusiPvm);
    };

    const hotPlayers = allPlayersToday.filter(p => {
        const getP = (key) => p.stats?.skaterStats?.[key] ?? p.stats?.[key] ?? 0;
        if (p.position === 'G' || p.position === 'Goalie') {
            const sv = getP('saves');
            const sa = getP('shotsAgainst');
            if (sa === 0) return false;
            return sv > 25 && (sv / sa) >= 0.935;
        } else {
            return (getP('goals') + getP('assists')) >= 3;
        }
    });

    const myFavPlayersList = favPlayers
        .filter(id => String(id).length === 7)
        .map(id => {
        const todayData = allPlayersToday.find(p => p.id === id);
        const extra = extraPlayerData[id];
        const ss = extra?.featuredStats?.regularSeason?.subSeason || {};

        if (todayData) return { ...todayData, isPlayingToday: true, seasonStats: ss };
        
        if (extra) {
            const teamAbbrev = extra.currentTeamAbbrev || extra.teamAbbrev || '';
            const isTeamPlaying = games.some(g => g.homeTeam.abbrev === teamAbbrev || g.awayTeam.abbrev === teamAbbrev);
            
            return {
                id: extra.playerId || id,
                name: `${extra.firstName?.default || ''} ${extra.lastName?.default || ''}`.trim(),
                team: teamAbbrev,
                position: extra.position,
                isPlayingToday: isTeamPlaying,
                seasonStats: ss,
                stats: {} 
            };
        }
        return { id, name: t.loading, isLoading: true };
    });

    const fantasyDisplayList = (fantasyTeam || []).map(fPlayer => {
        const todayData = allPlayersToday.find(p => p.id === fPlayer.id);
        const extra = extraPlayerData[fPlayer.id];
        const ss = extra?.featuredStats?.regularSeason?.subSeason || {};

        if (todayData) return { ...todayData, name: fPlayer.name, isPlayingToday: true, seasonStats: ss };

        if (extra) {
            const teamAbbrev = extra.currentTeamAbbrev || extra.teamAbbrev || '';
            const isTeamPlaying = games.some(g => g.homeTeam.abbrev === teamAbbrev || g.awayTeam.abbrev === teamAbbrev);

            return {
                id: extra.playerId || fPlayer.id,
                name: fPlayer.name,
                team: teamAbbrev,
                position: extra.position || fPlayer.position,
                isPlayingToday: isTeamPlaying, 
                seasonStats: ss,
                stats: {} 
            };
        }
        return { ...fPlayer, isPlayingToday: false, isLoading: true };
    });

    return (
        <div className="container" style={{ position: 'relative' }}>
            
            {goalAlert && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', 
                    background: 'linear-gradient(90deg, #ff0000, #b30000, #ff0000)', 
                    color: '#fff', padding: '15px', textAlign: 'center', 
                    fontWeight: 'bold', fontSize: '1.5rem', zIndex: 999999,
                    boxShadow: '0 5px 20px rgba(255,0,0,0.6)',
                    animation: 'pulse 1s infinite'
                }}>
                    {goalAlert}
                </div>
            )}

            <DateNavigation 
                currentDateObj={currentDateObj} 
                language={language}
                onPrevDay={handlePrevDay} 
                onNextDay={handleNextDay} 
                onRefresh={fetchData} 
                isRefreshing={isGamesLoading} 
            />

            <div className="games-container">
                {isGamesLoading ? (
                    <div className="loading" style={{ color: 'var(--accent-blue)', padding: '20px' }}>{t.homeLoading}</div>
                ) : games.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)' }}>{t.homeNoGames}</div>
                ) : (
                    games.map((game) => (
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

            {fantasyDisplayList.length > 0 && (
                <div className="finns-section" style={{ marginBottom: '20px' }}>
                    <h3 className="otsikko-fantasy" style={{ margin: '0 0 10px 10px', fontSize: '1.2rem' }}>
                        {t.homeFantasyTitle}
                    </h3>
                    <div className="h-scroll-wrapper">
                        {sortPlayers(fantasyDisplayList).map(player => (
                            <PlayerCard 
                                key={player.id} player={player} variant="fantasy" 
                                onClick={() => onFantasyClick ? onFantasyClick(player.id) : onPlayerClick(player.id)} 
                                favPlayers={favPlayers} toggleFavPlayer={toggleFavPlayer}
                                fantasyTeam={fantasyTeam} toggleFantasyPlayer={toggleFantasyPlayer}
                                language={language}
                            />
                        ))}
                    </div>
                </div>
            )}

            {myFavPlayersList.length > 0 && (
                <div className="finns-section">
                    <h3 className="otsikko-suosikit" style={{ margin: '0 0 10px 10px', fontSize: '1.2rem' }}>
                        {t.homeFavTitle}
                    </h3>
                    <div className="h-scroll-wrapper">
                        {sortPlayers(myFavPlayersList).map((player) => (
                            <PlayerCard 
                                key={player.id} player={player} variant="fav" onClick={() => onPlayerClick(player.id)} 
                                favPlayers={favPlayers} toggleFavPlayer={toggleFavPlayer}
                                fantasyTeam={fantasyTeam} toggleFantasyPlayer={toggleFantasyPlayer}
                                language={language} 
                            />
                        ))}
                    </div>
                </div>
            )}

            {hotPlayers.length > 0 && (
                <div className="finns-section">
                    <h3 className="otsikko-tulikuumat" style={{ margin: '0 0 10px 10px', fontSize: '1.2rem' }}>
                        {t.homeHotTitle} ({muotoilePvm(currentDateObj)})
                    </h3>
                    <div className="h-scroll-wrapper">
                        {sortPlayers(hotPlayers).map((player) => {
                            const extra = extraPlayerData[player.id];
                            const pWithStats = { ...player, seasonStats: extra?.featuredStats?.regularSeason?.subSeason || {} };
                            return (
                                <PlayerCard 
                                    key={`hot-${player.id}`} player={pWithStats} variant="hot" onClick={() => onPlayerClick(player.id)} 
                                    favPlayers={favPlayers} toggleFavPlayer={toggleFavPlayer}
                                    fantasyTeam={fantasyTeam} toggleFantasyPlayer={toggleFantasyPlayer}
                                    language={language}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
            
            <div className="finns-section">
                <h3 className="otsikko-suomalaiset" style={{ margin: '0 0 10px 10px', fontSize: '1.2rem' }}>
                    {t.homeFinnsTitle} ({muotoilePvm(currentDateObj)})
                </h3>
                <div className="h-scroll-wrapper">
                    {isPlayersLoading ? (
                        <div className="loading" style={{ color: 'var(--accent-blue)', padding: '20px' }}>{t.homeFinnsLoading}</div>
                    ) : players.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', padding: '10px' }}>{t.homeNoFinns}</div>
                    ) : (
                        sortPlayers(players).map((player) => {
                            // Yhdistetään myös suomalaisille kausidata lennosta!
                            const extra = extraPlayerData[player.id];
                            const pWithStats = { ...player, seasonStats: extra?.featuredStats?.regularSeason?.subSeason || {} };
                            
                            return (
                                <PlayerCard 
                                    key={`fin-${player.id}`} player={pWithStats} variant="fin" onClick={() => onPlayerClick(player.id)} 
                                    favPlayers={favPlayers} toggleFavPlayer={toggleFavPlayer}
                                    fantasyTeam={fantasyTeam} toggleFantasyPlayer={toggleFantasyPlayer}
                                    language={language} 
                                />
                            );
                        })
                    )}
                </div>
            </div>

        </div>
    );
};

export default HomePage;