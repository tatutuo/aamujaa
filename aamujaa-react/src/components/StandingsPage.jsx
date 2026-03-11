import React, { useState, useEffect } from 'react';
import { translations } from '../utils/translations';

const StandingsPage = ({ onTeamClick, language }) => {
    const t = translations[language] || translations.fi;
    
    // Alkuperäiset tilat
    const [filter, setFilter] = useState('east');
    const [standings, setStandings] = useState([]);
    const [liveData, setLiveData] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    // Uudet tilat Kuntopuntaria varten
    const [activeTab, setActiveTab] = useState('standings'); // 'standings' tai 'form'
    const [schedules, setSchedules] = useState({});
    const [isFormLoading, setIsFormLoading] = useState(false);
    const [formLimit, setFormLimit] = useState(6); 

    // 1. HAETAAN PERUSTAULUKKO JA LIVE-PISTEET
    useEffect(() => {
        setIsLoading(true);
        Promise.all([
            fetch('/api/nhl/standings').then(res => res.json()),
            fetch('/api/nhl/score').then(res => res.json()).catch(() => ({ games: [] }))
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
                        liveMap[homeTeam] = { pts: 2, text: '+2p', color: '#4ade80', isWin: true, isRegWin: !isOT, diff: homeDiff, addedGp: 1 };
                        liveMap[awayTeam] = { pts: isOT ? 1 : 0, text: isOT ? '+1p' : '+0p', color: isOT ? '#ffd700' : '#ff4444', isWin: false, isRegWin: false, diff: awayDiff, addedGp: 1 };
                    } else if (awayScore > homeScore) {
                        liveMap[awayTeam] = { pts: 2, text: '+2p', color: '#4ade80', isWin: true, isRegWin: !isOT, diff: awayDiff, addedGp: 1 };
                        liveMap[homeTeam] = { pts: isOT ? 1 : 0, text: isOT ? '+1p' : '+0p', color: isOT ? '#ffd700' : '#ff4444', isWin: false, isRegWin: false, diff: homeDiff, addedGp: 1 };
                    } else {
                        liveMap[homeTeam] = { pts: 1, text: '+1p', color: '#ffd700', isWin: false, isRegWin: false, diff: 0, addedGp: 1 };
                        liveMap[awayTeam] = { pts: 1, text: '+1p', color: '#ffd700', isWin: false, isRegWin: false, diff: 0, addedGp: 1 };
                    }
                });
            }
            setLiveData(liveMap);
            setIsLoading(false);
        })
        .catch(err => {
            console.error("Virhe sarjataulukon haussa:", err);
            setIsLoading(false);
        });
    }, []);

    // 2. HAETAAN OTTELUOHJELMAT KUNTOPUNTARIA VARTEN
    useEffect(() => {
        if (activeTab === 'form' && Object.keys(schedules).length === 0 && standings.length > 0) {
            setIsFormLoading(true);
            const promises = standings.map(team => {
                const abbrev = team.teamAbbrev?.default || team.teamAbbrev;
                return fetch(`/api/nhl/team-schedule/${abbrev}`)
                    .then(r => r.json())
                    .catch(() => null);
            });

            Promise.all(promises).then(results => {
                const newScheds = {};
                results.forEach((res, i) => {
                    const abbrev = standings[i].teamAbbrev?.default || standings[i].teamAbbrev;
                    if (res) newScheds[abbrev] = res;
                });
                setSchedules(newScheds);
                setIsFormLoading(false);
            });
        }
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
                abbrev,
                formGP: gp,
                formW: w,
                formL: l,
                formOTL: otl,
                formGF: gf,
                formGA: ga,
                formDiff: gf - ga,
                formPts: (w * 2) + otl,
                logoUrl: `https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg`
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
            <div style={{ marginBottom: '30px', animation: 'fadeIn 0.4s' }}>
                <div style={{ color: '#aaa', fontSize: '0.85rem', fontWeight: 'bold', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '10px', letterSpacing: '1px' }}>
                    {title}
                </div>
                <div style={{ width: '100%', overflowX: 'auto', paddingBottom: '10px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #444', color: '#888', fontSize: '0.7rem' }}>
                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>#</th>
                                <th style={{ padding: '4px 2px', textAlign: 'left', fontWeight: 'normal' }}>{t.standTeam || 'TEAM'}</th>
                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>{t.stColGP || 'O'}</th>
                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>{t.stColW || 'V'}</th>
                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>{t.stColL || 'T'}</th>
                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>{t.stColOT || 'JA'}</th>
                                <th style={{ padding: '4px 1px', fontWeight: 'bold', color: '#aaa' }}>{t.stColPts || 'P'}</th>
                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>{t.stColDiff || 'ME'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {formData.map((team, i) => {
                                const diffSign = team.formDiff > 0 ? '+' : '';
                                return (
                                    <tr key={team.abbrev} style={{ borderBottom: '1px solid #222' }}>
                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: i < 8 ? '#fff' : '#888', fontWeight: 'bold' }}>
                                            {i + 1}.
                                        </td>
                                        <td 
                                            style={{ padding: '6px 2px', textAlign: 'left', fontSize: '0.85rem', whiteSpace: 'nowrap', cursor: 'pointer' }}
                                            onClick={() => onTeamClick(team.abbrev)}
                                        >
                                            <img src={team.logoUrl} style={{ width: '18px', height: '18px', verticalAlign: 'middle', marginRight: '6px' }} alt={team.abbrev} />
                                            <span style={{ fontWeight: 'bold', color: '#ddd', verticalAlign: 'middle' }}>{team.abbrev}</span>
                                        </td>
                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: '#bbb' }}>{team.formGP}</td>
                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: '#4ade80' }}>{team.formW}</td>
                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: '#ff4444' }}>{team.formL}</td>
                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: '#ffaa00' }}>{team.formOTL}</td>
                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 'bold', color: '#00d4ff' }}>
                                            {team.formPts}
                                        </td>
                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: team.formDiff > 0 ? '#4ade80' : team.formDiff < 0 ? '#ff4444' : '#888' }}>
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

    // --- UUSI APUFUNKTIO PIENILLE NAPEILLE ---
    const getFilterBtnStyle = (isActive) => ({
        padding: '5px 14px',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        borderRadius: '20px',
        border: isActive ? '1px solid #00d4ff' : '1px solid #333',
        background: isActive ? '#00d4ff' : 'rgba(255,255,255,0.05)',
        color: isActive ? '#000' : '#aaa',
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        textTransform: 'uppercase'
    });

    return (
        <div className="container">
            <h2 className="page-main-title">
                {t.standTitle || "TAULUKOT"}
            </h2>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <button 
                    onClick={() => setActiveTab('standings')}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#222', color: activeTab === 'standings' ? '#00d4ff' : '#888', border: activeTab === 'standings' ? '1px solid #00d4ff' : '1px solid transparent', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                    {language === 'fi' ? 'SARJATAULUKKO' : 'STANDINGS'}
                </button>
                <button 
                    onClick={() => setActiveTab('form')}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#222', color: activeTab === 'form' ? '#00d4ff' : '#888', border: activeTab === 'form' ? '1px solid #00d4ff' : '1px solid transparent', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                    🔥 {t.stTabForm || "KUNTO"}
                </button>
            </div>

            {isLoading ? (
                <div className="loading" style={{ textAlign: 'center', padding: '40px', color: 'var(--accent-blue)' }}>{t.standLoading}</div>
            ) : (
                <>
                    {activeTab === 'standings' && (
                        <div style={{ animation: 'fadeIn 0.3s' }}>
                            
                            {/* UUDET PIENET JA TYYLIKKÄÄT NAPIT */}
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                                <button style={getFilterBtnStyle(filter === 'east')} onClick={() => setFilter('east')}>{t.standEast}</button>
                                <button style={getFilterBtnStyle(filter === 'west')} onClick={() => setFilter('west')}>{t.standWest}</button>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
                                <button style={getFilterBtnStyle(filter === 'atlantic')} onClick={() => setFilter('atlantic')}>ATL</button>
                                <button style={getFilterBtnStyle(filter === 'metro')} onClick={() => setFilter('metro')}>MET</button>
                                <button style={getFilterBtnStyle(filter === 'central')} onClick={() => setFilter('central')}>CEN</button>
                                <button style={getFilterBtnStyle(filter === 'pacific')} onClick={() => setFilter('pacific')}>PAC</button>
                            </div>

                            <div className="standings-table-container">
                                <div style={{ width: '100%', overflowX: 'hidden', paddingBottom: '10px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid #444', color: '#888', fontSize: '0.7rem' }}>
                                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>#</th>
                                                <th style={{ padding: '4px 2px', textAlign: 'left', fontWeight: 'normal' }}>{t.standTeam}</th>
                                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>{t.standGP}</th>
                                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>{t.standW}</th>
                                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>{t.standL}</th>
                                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>{t.standOTL}</th>
                                                <th style={{ padding: '4px 1px', fontWeight: 'bold', color: '#aaa' }}>{t.standPts}</th>
                                                <th style={{ padding: '4px 1px', fontWeight: 'normal' }}>{t.standDiff}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.map((team, i) => {
                                                const abbrev = team.teamAbbrev?.default || team.teamAbbrev;
                                                const logoUrl = `https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg`;
                                                
                                                const borderBottom = i === lastPlayoffIndex ? '2px dashed #ff4444' : '1px solid #222';
                                                
                                                const live = liveData[abbrev];
                                                const totalDiff = team.goalDifferential + (live?.diff || 0);
                                                const diffSign = totalDiff > 0 ? '+' : '';
                                                
                                                const displayGP = team.gamesPlayed + (live?.addedGp || 0);
                                                const rowBg = live ? 'rgba(255, 255, 255, 0.05)' : 'transparent';

                                                return (
                                                    <tr key={abbrev} style={{ borderBottom: borderBottom, background: rowBg }}>
                                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: '#888' }}>
                                                            {i + 1}.
                                                        </td>
                                                        
                                                        <td 
                                                            style={{ padding: '6px 2px', textAlign: 'left', fontSize: '0.85rem', whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                            onClick={() => onTeamClick(abbrev)}
                                                        >
                                                            <img src={logoUrl} style={{ width: '18px', height: '18px', verticalAlign: 'middle', marginRight: '6px' }} alt={abbrev} />
                                                            <span style={{ fontWeight: 'bold', color: '#ddd', verticalAlign: 'middle' }}>{abbrev}</span>
                                                        </td>
                                                        
                                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: live ? '#fff' : '#bbb' }}>
                                                            {displayGP}
                                                        </td>
                                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: '#ddd' }}>{team.wins}</td>
                                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: '#ddd' }}>{team.losses}</td>
                                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: '#ddd' }}>{team.otLosses}</td>
                                                        
                                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                                            <div style={{ color: 'var(--accent-blue)' }}>{team.points}</div>
                                                            {live && (
                                                                <div style={{ fontSize: '0.65rem', color: live.color, marginTop: '-2px', animation: 'pulse 1.5s infinite' }}>
                                                                    {live.text}
                                                                </div>
                                                            )}
                                                        </td>
                                                        
                                                        <td style={{ padding: '6px 1px', textAlign: 'center', fontSize: '0.8rem', color: totalDiff > 0 ? '#4ade80' : '#ff4444' }}>
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
                            <div style={{ background: 'rgba(0, 212, 255, 0.05)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(0, 212, 255, 0.2)', marginBottom: '20px', textAlign: 'center' }}>
                                <div style={{ color: '#00d4ff', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 'bold' }}>
                                    {t.stFormLimit || "Valitse ajanjakso:"}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                                    {[3, 6, 9].map(num => (
                                        <button 
                                            key={num}
                                            onClick={() => setFormLimit(num)}
                                            style={{ padding: '6px 15px', borderRadius: '20px', border: '1px solid #00d4ff', background: formLimit === num ? '#00d4ff' : 'transparent', color: formLimit === num ? '#000' : '#00d4ff', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                                        >
                                            {num} {t.stFormGames || "ottelua"}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {isFormLoading ? (
                                <div style={{ textAlign: 'center', color: '#00d4ff', margin: '40px 0', animation: 'pulse 1.5s infinite' }}>
                                    {t.stFormLoading || "Lasketaan kuntopuntaria (haetaan dataa)..."}
                                </div>
                            ) : (
                                <div>
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