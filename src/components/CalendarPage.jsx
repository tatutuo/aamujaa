import React, { useState, useEffect } from 'react';
import { translations } from '../utils/translations';
import TeamBadge from './TeamBadge';
import { api } from '../utils/api';
import { toApiDate } from '../utils/dates';

/**
 * Otteluruudukko: kenellä on eniten pelejä valitulla aikavälillä.
 *
 * Ennen tämä komponentti haki NHL:n kalenterin viikko kerrallaan silmukassa
 * (60 päivän valinnalla ~9 peräkkäistä pyyntöä) ja rakensi ruudukon selaimessa.
 * Backend osaa saman yhdellä välimuistitetulla kutsulla.
 *
 * Samalla korjattu alkupäivä: new Date().toISOString() antoi UTC-päivän, joten
 * illalla klo 22 jälkeen kalenteri avautui jo huomiseen.
 */
const CalendarPage = ({ onTeamClick, language }) => {
    const t = translations[language] || translations.fi;

    const [days, setDays] = useState(7);
    const [startDate, setStartDate] = useState(() => toApiDate(new Date()));

    const [scheduleData, setScheduleData] = useState({ dates: [], teams: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    // Kasvatetaan uudelleenyrityksessä, jotta efekti ajetaan vaikka muut
    // riippuvuudet pysyisivät samoina.
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        setIsLoading(true);

        api.schedule({ startDate, days }, { signal: controller.signal })
            .then(data => {
                // Backend palauttaa päivät ISO-muodossa; ruudukko näyttää ne lyhyinä.
                const dates = data.dates.map(iso => {
                    const d = new Date(`${iso}T12:00:00Z`);
                    return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
                });

                const teams = data.teams.map(team => ({
                    ...team,
                    schedule: Object.fromEntries(
                        data.dates.map((iso, i) => [dates[i], team.schedule[iso]]),
                    ),
                }));

                setScheduleData({ dates, teams });
                setError(null);
                setIsLoading(false);
            })
            .catch(err => {
                if (err.name === 'AbortError') return;
                setError(err.message);
                setIsLoading(false);
            });

        return () => controller.abort();
    }, [startDate, days, retry]);

    const scrollToTeam = (abbrev) => {
        const element = document.getElementById(`team-card-${abbrev}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    return (
        <div className="container">
            <h2 className="page-title">{t.calTitle}</h2>

            <div className="sched-filter-container">
                <button className={`sched-filter-btn ${days === 7 ? 'active' : ''}`} onClick={() => setDays(7)}>- 7 -</button>
                <button className={`sched-filter-btn ${days === 14 ? 'active' : ''}`} onClick={() => setDays(14)}>- 14 -</button>
                <button className={`sched-filter-btn ${days === 30 ? 'active' : ''}`} onClick={() => setDays(30)}>- 30 -</button>
                <button className={`sched-filter-btn ${days === 60 ? 'active' : ''}`} onClick={() => setDays(60)}>- 60 -</button>
            </div>

            <div className="date-picker">
                <span aria-hidden="true">📅</span>
                <input 
                    type="date" 
                    className="date-input" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                />
            </div>

            {isLoading ? (
                <div className="loading">{t.calLoading}</div>
            ) : error ? (
                <div className="error-state">
                    <p>{error}</p>
                    <button type="button" className="sched-filter-btn" onClick={() => setRetry(n => n + 1)}>
                        {language === 'fi' ? 'Yritä uudelleen' : 'Try again'}
                    </button>
                </div>
            ) : (
                <>
                    <div className="quick-jump-row">
                        {scheduleData.teams.map(team => (
                            <TeamBadge
                                key={`jump-${team.abbrev}`}
                                abbrev={team.abbrev}
                                className="quick-logo"
                                size={35} // Pikavalikon pikkulogot
                                onClick={() => scrollToTeam(team.abbrev)}
                            />
                        ))}
                    </div>

                    <div id="schedule-container">
                        {scheduleData.teams.map(team => (
                            <div className="sched-card" id={`team-card-${team.abbrev}`} key={team.abbrev}>
                                
                                <button
                                    type="button"
                                    className="sched-header"
                                    onClick={() => onTeamClick && onTeamClick(team.abbrev)}
                                >
                                    <TeamBadge abbrev={team.abbrev} className="sched-logo" size={40} />
                                    
                                    <span className="sched-team-name">{team.abbrev}</span>
                                    <span className="sched-stats">
                                        🏒 {team.gamesCount} | 🏠 {team.homeGames} | ✈️ {team.awayGames}
                                    </span>
                                </button>

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