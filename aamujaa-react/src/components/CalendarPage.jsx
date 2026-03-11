import React, { useState, useEffect } from 'react';
import { translations } from '../utils/translations';

const CalendarPage = ({ onTeamClick, language }) => {
    const t = translations[language] || translations.fi; 
    
    const [days, setDays] = useState(7);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]); 

    const [scheduleData, setScheduleData] = useState({ dates: [], teams: [] });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);

        const fetchMultipleWeeks = async () => {
            let currentFetchDate = startDate;
            let allDays = [];
            let daysFetched = 0;

            try {
                while (daysFetched < days) {
                    const res = await fetch(`/api/nhl/calendar/${currentFetchDate}`);
                    const data = await res.json();
                    
                    const weekDays = data.gameWeek || [];
                    allDays = [...allDays, ...weekDays];
                    daysFetched += weekDays.length;

                    if (data.nextStartDate) {
                        currentFetchDate = data.nextStartDate;
                    } else {
                        break; 
                    }
                }

                allDays = allDays.slice(0, days);

                const dates = [];
                const teamMap = {};

                allDays.forEach(day => {
                    const d = new Date(day.date);
                    const shortDate = `${d.getDate()}.${d.getMonth() + 1}.`;
                    dates.push(shortDate);

                    day.games.forEach(game => {
                        const homeAbbrev = game.homeTeam?.abbrev || game.homeTeam?.placeName?.default;
                        const awayAbbrev = game.awayTeam?.abbrev || game.awayTeam?.placeName?.default;

                        if (!homeAbbrev || !awayAbbrev) return;

                        if (!teamMap[homeAbbrev]) teamMap[homeAbbrev] = { abbrev: homeAbbrev, schedule: {}, gamesCount: 0, homeGames: 0, awayGames: 0 };
                        if (!teamMap[awayAbbrev]) teamMap[awayAbbrev] = { abbrev: awayAbbrev, schedule: {}, gamesCount: 0, homeGames: 0, awayGames: 0 };

                        teamMap[homeAbbrev].schedule[shortDate] = { isHome: true, opponent: awayAbbrev };
                        teamMap[homeAbbrev].gamesCount++;
                        teamMap[homeAbbrev].homeGames++;

                        teamMap[awayAbbrev].schedule[shortDate] = { isHome: false, opponent: homeAbbrev };
                        teamMap[awayAbbrev].gamesCount++;
                        teamMap[awayAbbrev].awayGames++;
                    });
                });

                const teams = Object.values(teamMap).sort((a, b) => a.abbrev.localeCompare(b.abbrev));
                setScheduleData({ dates, teams });
                setIsLoading(false);

            } catch (err) {
                console.error("Virhe kalenterin kelaamisessa:", err);
                setIsLoading(false);
            }
        };

        fetchMultipleWeeks();

    }, [startDate, days]); 

    const scrollToTeam = (abbrev) => {
        const element = document.getElementById(`team-card-${abbrev}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    return (
        <div className="container">
            <h2 className="page-main-title">
                {t.calTitle}
            </h2>
            
            <div className="sched-filter-container" style={{ marginBottom: '10px' }}>
                <button className={`sched-filter-btn ${days === 7 ? 'active' : ''}`} onClick={() => setDays(7)}>- 7 -</button>
                <button className={`sched-filter-btn ${days === 14 ? 'active' : ''}`} onClick={() => setDays(14)}>- 14 -</button>
                <button className={`sched-filter-btn ${days === 30 ? 'active' : ''}`} onClick={() => setDays(30)}>- 30 -</button>
                <button className={`sched-filter-btn ${days === 60 ? 'active' : ''}`} onClick={() => setDays(60)}>- 60 -</button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '10px', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', border: '1px solid #333' }}>
                <span style={{ fontSize: '1.5rem', marginRight: '5px' }}>📅</span>
                <input 
                    type="date" 
                    className="date-input" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ background: '#222', color: '#fff', border: '1px solid #444', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                />
            </div>

            {isLoading ? (
                <div className="loading" style={{ textAlign: 'center', padding: '40px', color: 'var(--accent-blue)' }}>
                    {t.calLoading}
                </div>
            ) : (
                <>
                    <div className="quick-jump-row">
                        {scheduleData.teams.map(team => (
                            <img 
                                key={`jump-${team.abbrev}`}
                                src={`https://assets.nhle.com/logos/nhl/svg/${team.abbrev}_light.svg`} 
                                className="quick-logo" 
                                alt={team.abbrev}
                                title={team.abbrev}
                                onClick={() => scrollToTeam(team.abbrev)}
                            />
                        ))}
                    </div>

                    <div id="schedule-container">
                        {scheduleData.teams.map(team => (
                            <div className="sched-card" id={`team-card-${team.abbrev}`} key={team.abbrev}>
                                
                                <div 
                                    className="sched-header" 
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => onTeamClick && onTeamClick(team.abbrev)}
                                >
                                    <img src={`https://assets.nhle.com/logos/nhl/svg/${team.abbrev}_light.svg`} className="sched-logo" alt={team.abbrev} />
                                    <span className="sched-team-name">{team.abbrev}</span>
                                    <span className="sched-stats">
                                        🏒 {team.gamesCount} | 🏠 {team.homeGames} | ✈️ {team.awayGames}
                                    </span>
                                </div>

                                <div className="sched-days">
                                    {scheduleData.dates.map(date => {
                                        const game = team.schedule[date];
                                        
                                        if (!game) {
                                            return (
                                                <div key={date} className="sched-day-box day-off">
                                                    <span className="sched-date">{date}</span>-
                                                </div>
                                            );
                                        } else if (game.isHome) {
                                            return (
                                                <div key={date} className="sched-day-box day-home">
                                                    <span className="sched-date">{date}</span>vs {game.opponent}
                                                </div>
                                            );
                                        } else {
                                            return (
                                                <div key={date} className="sched-day-box day-away">
                                                    <span className="sched-date">{date}</span>@ {game.opponent}
                                                </div>
                                            );
                                        }
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default CalendarPage;