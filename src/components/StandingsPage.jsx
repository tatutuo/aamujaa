import React, { useState, useEffect } from 'react';
import { translations } from '../utils/translations';
import TeamBadge from './TeamBadge';
import { api } from '../utils/api';

const StandingsPage = ({ onTeamClick, favTeams, language }) => {
    const t = translations[language] || translations.fi;

    const [filter, setFilter] = useState('east');
    const [standings, setStandings] = useState([]);
    const [liveData, setLiveData] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const [activeTab, setActiveTab] = useState('standings');
    const [schedules, setSchedules] = useState({});
    const [isFormLoading, setIsFormLoading] = useState(false);
    const [formLimit, setFormLimit] = useState(6);

    useEffect(() => {
        const controller = new AbortController();
        setIsLoading(true);

        Promise.all([
            api.standings({ signal: controller.signal }),
            api.score(undefined, { signal: controller.signal }).catch(() => ({ games: [] })),
        ])
        .then(([standingsData, scoreData]) => {
            const kaikkiJoukkueet = [...(standingsData.eastern || []), ...(standingsData.western || [])];
            setStandings(kaikkiJoukkueet);

            const liveMap = {};
            if (scoreData && scoreData.games) {
                const liveGames = scoreData.games.filter(g => g.gameState === 'LIVE' || g.gameState === 'CRIT');

                liveGames.forEach(game => {
                    const homeTeam = game.homeTeam.abbrev;
                    const awayTeam = game.awayTeam.abbrev;
                    const homeScore = game.homeTeam.score || 0;
                    const awayScore = game.awayTeam.score || 0;
                    
                    const isOT = game.periodDescriptor?.number > 3;
                    const homeDiff = homeScore - awayScore;
                    const awayDiff = awayScore - homeScore;

                    if (homeScore > awayScore) {
                        liveMap[homeTeam] = { pts: 2, text: '+2p', color: 'var(--positive)', isWin: true, isRegWin: !isOT, diff: homeDiff, addedGp: 1 };
                        liveMap[awayTeam] = { pts: isOT ? 1 : 0, text: isOT ? '+1p' : '+0p', color: isOT ? 'var(--gold)' : 'var(--negative)', isWin: false, isRegWin: false, diff: awayDiff, addedGp: 1 };
                    } else if (awayScore > homeScore) {
                        liveMap[awayTeam] = { pts: 2, text: '+2p', color: 'var(--positive)', isWin: true, isRegWin: !isOT, diff: awayDiff, addedGp: 1 };
                        liveMap[homeTeam] = { pts: isOT ? 1 : 0, text: isOT ? '+1p' : '+0p', color: isOT ? 'var(--gold)' : 'var(--negative)', isWin: false, isRegWin: false, diff: homeDiff, addedGp: 1 };
                    } else {
                        liveMap[homeTeam] = { pts: 1, text: '+1p', color: 'var(--gold)', isWin: false, isRegWin: false, diff: 0, addedGp: 1 };
                        liveMap[awayTeam] = { pts: 1, text: '+1p', color: 'var(--gold)', isWin: false, isRegWin: false, diff: 0, addedGp: 1 };
                    }
                });
            }
            setLiveData(liveMap);
            setError(null);
            setIsLoading(false);
        })
        .catch(err => {
            if (err.name === 'AbortError') return;
            setError(err.message);
            setIsLoading(false);
        });

        return () => controller.abort();
    }, []);

    // Muoto-välilehti hakee 32 joukkueen ohjelmat. Haetaan vasta kun välilehti
    // avataan, ja vain kerran — ei joka renderöinnillä.
    useEffect(() => {
        if (activeTab !== 'form' || Object.keys(schedules).length > 0 || standings.length === 0) return undefined;

        const controller = new AbortController();
        setIsFormLoading(true);

        const abbrevs = standings.map(team => team.teamAbbrev?.default || team.teamAbbrev);

        Promise.all(
            abbrevs.map(abbrev =>
                api.teamSchedule(abbrev, { signal: controller.signal }).catch(() => null)
            )
        ).then(results => {
            const newScheds = {};
            results.forEach((res, i) => {
                if (res) newScheds[abbrevs[i]] = res;
            });
            setSchedules(newScheds);
            setIsFormLoading(false);
        }).catch(() => setIsFormLoading(false));

        return () => controller.abort();
    }, [activeTab, standings, schedules]);

    const sortTeamsAdvanced = (a, b) => {
        const abbrevA = a.teamAbbrev?.default || a.teamAbbrev;
        const abbrevB = b.teamAbbrev?.default || b.teamAbbrev;
        const liveA = liveData[abbrevA] || { pts: 0, addedGp: 0, isWin: false, isRegWin: false, diff: 0 };
        const liveB = liveData[abbrevB] || { pts: 0, addedGp: 0, isWin: false, isRegWin: false, diff: 0 };

        const ptsA = a.points + liveA.pts;
        const ptsB = b.points + liveB.pts;
        if (ptsB !== ptsA) return ptsB - ptsA;

        const gpA = a.gamesPlayed + liveA.addedGp;
        const gpB = b.gamesPlayed + liveB.addedGp;
        const pctA = gpA > 0 ? (ptsA / (gpA * 2)) : 0;
        const pctB = gpB > 0 ? (ptsB / (gpB * 2)) : 0;
        if (pctB !== pctA) return pctB - pctA;

        const rwA = (a.regulationWins || 0) + (liveA.isRegWin ? 1 : 0);
        const rwB = (b.regulationWins || 0) + (liveB.isRegWin ? 1 : 0);
        if (rwB !== rwA) return rwB - rwA;

        const wA = a.wins + (liveA.isWin ? 1 : 0);
        const wB = b.wins + (liveB.isWin ? 1 : 0);
        if (wB !== wA) return wB - wA;

        const diffA = a.goalDifferential + liveA.diff;
        const diffB = b.goalDifferential + liveB.diff;
        if (diffB !== diffA) return diffB - diffA;

        return (b.goalsFor || 0) - (a.goalsFor || 0);
    };

    const getPlayoffTeams = (confAbbrev) => {
        const confTeams = standings.filter(t => t.conferenceAbbrev === confAbbrev);
        confTeams.sort(sortTeamsAdvanced);

        const inPlayoffs = new Set();
        if(confTeams.length === 0) return inPlayoffs;

        const div1Name = confTeams[0].divisionName;
        const div1Teams = confTeams.filter(t => t.divisionName === div1Name);
        const div2Teams = confTeams.filter(t => t.divisionName !== div1Name);

        div1Teams.slice(0, 3).forEach(t => inPlayoffs.add(t.teamAbbrev?.default || t.teamAbbrev));
        div2Teams.slice(0, 3).forEach(t => inPlayoffs.add(t.teamAbbrev?.default || t.teamAbbrev));

        const wildcards = confTeams.filter(t => !inPlayoffs.has(t.teamAbbrev?.default || t.teamAbbrev));
        wildcards.slice(0, 2).forEach(t => inPlayoffs.add(t.teamAbbrev?.default || t.teamAbbrev));

        return inPlayoffs;
    };

    const allPlayoffTeams = new Set([
        ...getPlayoffTeams('E'),
        ...getPlayoffTeams('W')
    ]);

    let data = [];
    if (filter === 'east') data = standings.filter(team => team.conferenceAbbrev === 'E');
    else if (filter === 'west') data = standings.filter(team => team.conferenceAbbrev === 'W');
    else if (filter === 'atlantic') data = standings.filter(team => team.divisionName === 'Atlantic');
    else if (filter === 'metro') data = standings.filter(team => team.divisionName === 'Metropolitan');
    else if (filter === 'central') data = standings.filter(team => team.divisionName === 'Central');
    else if (filter === 'pacific') data = standings.filter(team => team.divisionName === 'Pacific');

    data.sort(sortTeamsAdvanced);

    let lastPlayoffIndex = -1;
    data.forEach((team, index) => {
        const abbrev = team.teamAbbrev?.default || team.teamAbbrev;
        if (allPlayoffTeams.has(abbrev)) {
            lastPlayoffIndex = index;
        }
    });

    const getFormData = (confAbbrev) => {
        const confTeams = standings.filter(t => t.conferenceAbbrev === confAbbrev);
        
        const formData = confTeams.map(team => {
            const abbrev = team.teamAbbrev?.default || team.teamAbbrev;
            const sched = schedules[abbrev];
            let w = 0, l = 0, otl = 0, gf = 0, ga = 0, gp = 0;

            if (sched && sched.games) {
                const pastGames = sched.games.filter(g => g.gameState === "FINAL" || g.gameState === "OFF").reverse();
                const recent = pastGames.slice(0, formLimit);
                gp = recent.length;

                recent.forEach(g => {
                    const isHome = g.homeTeam.abbrev === abbrev;
                    const myScore = isHome ? g.homeTeam.score : g.awayTeam.score;
                    const oppScore = isHome ? g.awayTeam.score : g.homeTeam.score;
                    const period = g.periodDescriptor.periodType;

                    gf += myScore;
                    ga += oppScore;

                    if (myScore > oppScore) {
                        w++;
                    } else {
                        if (period === 'REG') l++;
                        else otl++;
                    }
                });
            }

            return {
                abbrev, formGP: gp, formW: w, formL: l, formOTL: otl,
                formGF: gf, formGA: ga, formDiff: gf - ga, formPts: (w * 2) + otl
            };
        });

        return formData.sort((a, b) => {
            if (b.formPts !== a.formPts) return b.formPts - a.formPts;
            if (b.formDiff !== a.formDiff) return b.formDiff - a.formDiff;
            return b.formGF - a.formGF;
        });
    };

    const renderFormTable = (confAbbrev, title) => {
        const formData = getFormData(confAbbrev);
        return (
            <div style={{ marginBottom: '20px', animation: 'fadeIn 0.4s' }}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', fontWeight: 'bold', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '5px', marginBottom: '5px', letterSpacing: '1px' }}>
                    {title}
                </div>
                <div style={{ width: '100%', overflowX: 'auto', paddingBottom: '5px' }}>
                    <table className="standings-table">
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-strong)', color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>
                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>#</th>
                                <th style={{ padding: '4px 2px', textAlign: 'left', fontWeight: 'normal' }}>{t.standTeam || 'TEAM'}</th>
                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>{t.stColGP || 'O'}</th>
                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>{t.stColW || 'V'}</th>
                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>{t.stColL || 'T'}</th>
                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>{t.stColOT || 'JA'}</th>
                                <th style={{ padding: '4px 1px', fontWeight: 'bold', color: 'var(--text-tertiary)' }}>{t.stColPts || 'P'}</th>
                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>{t.stColDiff || 'ME'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {formData.map((team, i) => {
                                const diffSign = team.formDiff > 0 ? '+' : '';
                                return (
                                    <tr key={team.abbrev} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: i < 8 ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: 'bold' }}>
                                            {i + 1}.
                                        </td>
                                        <td 
                                            style={{ padding: '6px 2px', textAlign: 'left', fontSize: '0.85rem', whiteSpace: 'nowrap', cursor: 'pointer' }}
                                            onClick={() => onTeamClick(team.abbrev)}
                                        >
                                            <TeamBadge abbrev={team.abbrev} size={18} showText={false} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                                            <span style={{ fontWeight: 'bold', color: 'var(--text-secondary)', verticalAlign: 'middle' }}>{team.abbrev}</span>
                                        </td>
                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{team.formGP}</td>
                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--positive)' }}>{team.formW}</td>
                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--negative)' }}>{team.formL}</td>
                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--gold)' }}>{team.formOTL}</td>
                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--accent-text)' }}>
                                            {team.formPts}
                                        </td>
                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: team.formDiff > 0 ? 'var(--positive)' : team.formDiff < 0 ? 'var(--negative)' : 'var(--text-tertiary)' }}>
                                            {diffSign}{team.formDiff}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // PIENENNETTY PADDINGIA JA FONTTIA, JOTTA KAIKKI 6 MAHTUVAT YHDELLE RIVILLE!
    const getFilterBtnStyle = (isActive) => ({
        padding: '5px 8px', 
        fontSize: '0.7rem',
        fontWeight: 'bold',
        borderRadius: '20px',
        border: isActive ? '1px solid #00d4ff' : '1px solid #333',
        background: isActive ? 'var(--accent-text)' : 'rgba(255,255,255,0.05)',
        color: isActive ? '#000' : 'var(--text-tertiary)',
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        textTransform: 'uppercase'
    });

    return (
        <div className="container" style={{ paddingTop: '5px' }}>
            <h2 className="page-main-title" style={{ marginTop: '0', marginBottom: '7px', fontSize: '0.95rem' }}>
                {t.standTitle || "TAULUKOT"}
            </h2>
            
            <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                <button 
                    onClick={() => setActiveTab('standings')}
                    style={{ flex: 1, padding: '2px 4px', fontSize: '0.70rem', borderRadius: '6px', background: 'var(--surface-sunken)', color: activeTab === 'standings' ? 'var(--accent-text)' : 'var(--text-tertiary)', border: activeTab === 'standings' ? '1px solid #00d4ff' : '1px solid transparent', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                    {language === 'fi' ? 'SARJATAULUKKO' : 'STANDINGS'}
                </button>
                <button 
                    onClick={() => setActiveTab('form')}
                    style={{ flex: 1, padding: '2px 4px', fontSize: '0.70rem', borderRadius: '6px', background: 'var(--surface-sunken)', color: activeTab === 'form' ? 'var(--accent-text)' : 'var(--text-tertiary)', border: activeTab === 'form' ? '1px solid #00d4ff' : '1px solid transparent', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                    🔥 {t.stTabForm || "KUNTO"}
                </button>
            </div>

            {isLoading ? (
                <div className="loading" style={{ textAlign: 'center', padding: '40px', color: 'var(--accent-blue)' }}>{t.standLoading}</div>
            ) : error ? (
                <div className="error-state">
                    <p>{error}</p>
                    <button type="button" className="sched-filter-btn" onClick={() => window.location.reload()}>
                        {language === 'fi' ? 'Yritä uudelleen' : 'Try again'}
                    </button>
                </div>
            ) : (
                <>
                    {activeTab === 'standings' && (
                        <div style={{ animation: 'fadeIn 0.3s' }}>
                            
                            {/* KAIKKI 6 NAPPIA YHDESSÄ RIVISSÄ HALUTUSSA JÄRJESTYKSESSÄ */}
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '7px', flexWrap: 'wrap', marginBottom: '5px' }}>
                                <button style={getFilterBtnStyle(filter === 'atlantic')} onClick={() => setFilter('atlantic')}>ATL</button>
                                <button style={getFilterBtnStyle(filter === 'metro')} onClick={() => setFilter('metro')}>MET</button>
                                
                                <button style={getFilterBtnStyle(filter === 'east')} onClick={() => setFilter('east')}>{t.standEast}</button>
                                <button style={getFilterBtnStyle(filter === 'west')} onClick={() => setFilter('west')}>{t.standWest}</button>
                                
                                <button style={getFilterBtnStyle(filter === 'central')} onClick={() => setFilter('central')}>CEN</button>
                                <button style={getFilterBtnStyle(filter === 'pacific')} onClick={() => setFilter('pacific')}>PAC</button>
                            </div>

                            <div className="standings-table-container">
                                <div style={{ width: '100%', overflowX: 'hidden', paddingBottom: '6px' }}>
                                    <table className="standings-table">
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border-strong)', color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>
                                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>#</th>
                                                <th style={{ padding: '4px 2px', textAlign: 'left', fontWeight: 'normal' }}>{t.standTeam}</th>
                                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>{t.standGP}</th>
                                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>{t.standW}</th>
                                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>{t.standL}</th>
                                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>{t.standOTL}</th>
                                                <th style={{ padding: '4px 1px', fontWeight: 'bold', color: 'var(--text-tertiary)' }}>{t.standPts}</th>
                                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>{t.standDiff}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.map((team, i) => {
                                                const abbrev = team.teamAbbrev?.default || team.teamAbbrev;
                                                const borderBottom = i === lastPlayoffIndex ? '2px dashed #ff4444' : '1px solid #222';
                                                
                                                const live = liveData[abbrev];
                                                const totalDiff = team.goalDifferential + (live?.diff || 0);
                                                const diffSign = totalDiff > 0 ? '+' : '';

                                                const displayGP = team.gamesPlayed + (live?.addedGp || 0);
                                                const isFav = favTeams?.includes(abbrev);

                                                // Suosikkijoukkue erottuu kullalla, käynnissä oleva ottelu vaalealla.
                                                const rowBg = isFav
                                                    ? 'rgba(255, 204, 0, 0.08)'
                                                    : live ? 'rgba(255, 255, 255, 0.05)' : 'transparent';

                                                return (
                                                    <tr key={abbrev} style={{ borderBottom: borderBottom, background: rowBg }}>
                                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                                            {i + 1}.
                                                        </td>

                                                        <td
                                                            style={{ padding: '6px 2px', textAlign: 'left', fontSize: '0.85rem', whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                            onClick={() => onTeamClick(abbrev)}
                                                        >
                                                            <TeamBadge abbrev={abbrev} size={18} showText={false} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                                                            <span style={{ fontWeight: 'bold', color: isFav ? 'var(--gold)' : 'var(--text-secondary)', verticalAlign: 'middle' }}>
                                                                {isFav && '★ '}{abbrev}
                                                            </span>
                                                        </td>
                                                        
                                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: live ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                                            {displayGP}
                                                        </td>
                                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{team.wins}</td>
                                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{team.losses}</td>
                                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{team.otLosses}</td>
                                                        
                                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                                            <div style={{ color: 'var(--accent-blue)' }}>{team.points}</div>
                                                            {live && (
                                                                <div style={{ fontSize: '0.65rem', color: live.color, marginTop: '-2px', animation: 'pulse 1.5s infinite' }}>
                                                                    {live.text}
                                                                </div>
                                                            )}
                                                        </td>
                                                        
                                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: totalDiff > 0 ? 'var(--positive)' : 'var(--negative)' }}>
                                                            {diffSign}{totalDiff}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'form' && (
                        <div style={{ animation: 'fadeIn 0.3s' }}>
                            <div style={{ background: 'rgba(0, 212, 255, 0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(0, 212, 255, 0.2)', marginBottom: '15px', textAlign: 'center' }}>
                                <div style={{ color: 'var(--accent-text)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>
                                    {t.stFormLimit || "Valitse ajanjakso:"}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                    {[3, 6, 9].map(num => (
                                        <button 
                                            key={num}
                                            onClick={() => setFormLimit(num)}
                                            style={{ padding: '4px 12px', fontSize: '0.8rem', borderRadius: '15px', border: '1px solid #00d4ff', background: formLimit === num ? 'var(--accent-text)' : 'transparent', color: formLimit === num ? '#000' : 'var(--accent-text)', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                                        >
                                            {num} {t.stFormGames || "ottelua"}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {isFormLoading ? (
                                <div style={{ textAlign: 'center', color: 'var(--accent-text)', margin: '40px 0', animation: 'pulse 1.5s infinite' }}>
                                    {t.stFormLoading || "Lasketaan kuntopuntaria (haetaan dataa)..."}
                                </div>
                            ) : (
                                <div className="standings-table-container">
                                    {renderFormTable('E', language === 'fi' ? 'ITÄINEN KONFERENSSI' : 'EASTERN CONFERENCE')}
                                    {renderFormTable('W', language === 'fi' ? 'LÄNTINEN KONFERENSSI' : 'WESTERN CONFERENCE')}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default StandingsPage;