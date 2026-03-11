import React, { useState, useEffect } from 'react';
import { translations } from '../utils/translations';

const PredictionModal = ({ isOpen, onClose, onPlayerClick, language }) => {
    const t = translations[language] || translations.fi;
    const [data, setData] = useState({ players: [], teams: [] });
    const [matches, setMatches] = useState([]);
    const [actualScores, setActualScores] = useState([]); 
    const [isLoading, setIsLoading] = useState(true);
    
    const [view, setView] = useState('matches'); 
    
    const [availableDates, setAvailableDates] = useState([]);
    const [currentDateIndex, setCurrentDateIndex] = useState(0);

    useEffect(() => {
        if (!isOpen) return;
        fetch('/api/nhl/predictions/dates')
            .then(res => res.json())
            .then(dates => {
                if (dates && dates.length > 0) {
                    setAvailableDates(dates);
                    setCurrentDateIndex(0);
                }
            })
            .catch(err => console.error("Virhe päivämäärien haussa:", err));
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || availableDates.length === 0) return;
        
        setIsLoading(true);
        const selectedDate = availableDates[currentDateIndex] || '';
        
        Promise.all([
            fetch(`/api/nhl/predictions?date=${selectedDate}`).then(r => r.json()),
            fetch(`/api/nhl/score?date=${selectedDate}`).then(r => r.json()) 
        ])
        .then(([predData, scoreData]) => {
            setData(predData);
            setMatches(predData.matches || []); 
            setActualScores(scoreData.games || []);
            setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
            
    }, [isOpen, currentDateIndex, availableDates]);

    if (!isOpen) return null;

    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        const parts = dateStr.split('-'); 
        return `${parts[2]}.${parts[1]}.${parts[0]}`; 
    };

    const handlePrevDate = () => {
        if (currentDateIndex < availableDates.length - 1) setCurrentDateIndex(currentDateIndex + 1); 
    };

    const handleNextDate = () => {
        if (currentDateIndex > 0) setCurrentDateIndex(currentDateIndex - 1); 
    };

    const currentDisplayDate = availableDates[currentDateIndex] ? formatDate(availableDates[currentDateIndex]) : '';
    const isOldData = currentDateIndex > 0; 

    return (
        <div className="modal-overlay" style={{ display: 'block', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.95)', zIndex: 100000, overflowY: 'auto' }}>
            <div style={{ padding: '15px', maxWidth: '800px', margin: '0 auto' }}>
                
                <span onClick={onClose} style={{ position: 'fixed', right: '20px', top: '15px', fontSize: '2.5rem', cursor: 'pointer', color: '#ffcc00', zIndex: 100001 }}>&times;</span>

                <div style={{ background: '#0a0a0a', border: '1px solid #ffcc00', borderRadius: '15px', padding: '20px', minHeight: '80vh' }}>
                    <h2 style={{ color: '#ffcc00', textAlign: 'center', fontFamily: "'Teko', sans-serif", fontSize: '2.2rem', margin: '0', letterSpacing: '1px' }}>
                        {t.predTitle}
                    </h2>
                    
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginBottom: '20px', marginTop: '5px' }}>
                        <button onClick={handlePrevDate} disabled={currentDateIndex >= availableDates.length - 1} style={{ background: 'none', border: 'none', color: currentDateIndex >= availableDates.length - 1 ? '#333' : '#00d4ff', fontSize: '1.5rem', cursor: currentDateIndex >= availableDates.length - 1 ? 'default' : 'pointer' }}>&laquo;</button>
                        <div style={{ textAlign: 'center', minWidth: '120px' }}>
                            <div style={{ color: isOldData ? '#ffaa00' : '#4ade80', fontWeight: 'bold', fontSize: '1rem', letterSpacing: '1px' }}>
                                {currentDisplayDate || "Ladataan..."}
                            </div>
                            {isOldData && <div style={{ fontSize: '0.65rem', color: '#ffaa00', textTransform: 'uppercase' }}>{language === 'fi' ? 'Historiadata' : 'Historical Data'}</div>}
                        </div>
                        <button onClick={handleNextDate} disabled={currentDateIndex === 0} style={{ background: 'none', border: 'none', color: currentDateIndex === 0 ? '#333' : '#00d4ff', fontSize: '1.5rem', cursor: currentDateIndex === 0 ? 'default' : 'pointer' }}>&raquo;</button>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', flexWrap: 'wrap' }}>
                        <button onClick={() => setView('matches')} style={{ flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none', background: view === 'matches' ? '#ffcc00' : '#222', color: view === 'matches' ? '#000' : '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>
                            {t.predTabMatches || 'OTTELUT'}
                        </button>
                        <button onClick={() => setView('players')} style={{ flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none', background: view === 'players' ? '#ffcc00' : '#222', color: view === 'players' ? '#000' : '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>
                            {language === 'fi' ? 'PISTEPÖRSSI' : 'SCORING'}
                        </button>
                        <button onClick={() => setView('teams')} style={{ flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none', background: view === 'teams' ? '#ffcc00' : '#222', color: view === 'teams' ? '#000' : '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>
                            {language === 'fi' ? 'SARJATAULUKKO' : 'STANDINGS'}
                        </button>
                        <button onClick={() => setView('info')} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: view === 'info' ? '#ffcc00' : '#222', color: view === 'info' ? '#000' : '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>
                            ℹ️
                        </button>
                    </div>

                    {isLoading ? (
                        <div style={{ textAlign: 'center', color: '#ffcc00', marginTop: '50px', fontSize: '1.2rem', animation: 'pulse 1.5s infinite' }}>
                            {t.predLoading}
                        </div>
                    ) : (
                        <div>
                            {view === 'matches' && <MatchView matches={matches} actualScores={actualScores} t={t} />}
                            {view === 'players' && <PlayerView players={data.players || []} t={t} onPlayerClick={onPlayerClick} onClose={onClose} />}
                            {view === 'teams' && <TeamView teams={data.teams || []} language={language} />}
                            {view === 'info' && <InfoView t={t} />}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ==========================================
// OTTELUENNUSTE NÄKYMÄ (Ei arvaa enää tarkkaa tulosta!)
// ==========================================
const MatchView = ({ matches, actualScores, t }) => {
    if (!matches || matches.length === 0) {
        return <div style={{ textAlign: 'center', color: '#666', padding: '40px 0' }}>{t.predNoMatches || "Ei otteluita tälle yölle."}</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {matches.map((m, i) => {
                const homeAbbrev = m.home;
                const awayAbbrev = m.away;

                const actualGame = actualScores.find(g => g.id === m.gameId || (g.homeTeam.abbrev === homeAbbrev && g.awayTeam.abbrev === awayAbbrev));
                const isFinal = actualGame && (actualGame.gameState === 'FINAL' || actualGame.gameState === 'OFF');
                
                const realHomeScore = actualGame?.homeTeam?.score;
                const realAwayScore = actualGame?.awayTeam?.score;
                
                let isHit = false;
                if (isFinal) {
                    // NYT TARKISTETAAN OSUVATKO PROSENTIT (Suosikki vs Voittaja)
                    const predictedHomeWin = m.homeWinProb > m.awayWinProb;
                    const actualHomeWin = realHomeScore > realAwayScore;
                    // Jos prosentit tasan (50-50), katsotaan kumpaa xG oikeasti suosi piilossa (m.homeScore > m.awayScore)
                    if (m.homeWinProb === m.awayWinProb) {
                         isHit = (m.homeScore > m.awayScore) === actualHomeWin;
                    } else {
                         isHit = predictedHomeWin === actualHomeWin;
                    }
                }

                // Käännös-apufunktio perusteluille
                const renderReason = (r) => {
                    let text = t[r.key] || r.key; 
                    if (r.val) text = `${text} (${r.val})`;
                    return text;
                };

                return (
                    <div key={i} style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #111 100%)', border: `1px solid ${isFinal ? (isHit ? '#4ade80' : '#ff4444') : '#333'}`, borderRadius: '12px', padding: '15px', position: 'relative' }}>
                        
                        {isFinal && (
                            <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: isHit ? '#4ade80' : '#ff4444', color: '#000', padding: '2px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                {isHit ? '✅ OSUI' : '❌ HUTI'}
                            </div>
                        )}

                        {/* VOITTOPROSENTIT */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px', marginTop: isFinal ? '8px' : '0' }}>
                            <div style={{ width: '85%', background: '#000', borderRadius: '20px', overflow: 'hidden', display: 'flex', border: '1px solid #333', position: 'relative', height: '22px' }}>
                                <div style={{ width: `${m.homeWinProb}%`, background: m.homeWinProb > m.awayWinProb ? '#00d4ff' : '#444', transition: 'width 1s' }}></div>
                                <div style={{ width: `${m.awayWinProb}%`, background: m.awayWinProb > m.homeWinProb ? '#00d4ff' : '#444', transition: 'width 1s' }}></div>
                                
                                <div style={{ position: 'absolute', width: '100%', height: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px', fontSize: '0.75rem', fontWeight: 'bold', color: '#fff', textShadow: '1px 1px 2px #000' }}>
                                    <span>{m.homeWinProb}%</span>
                                    <span style={{ color: '#aaa', fontSize: '0.65rem' }}>{t.predWinProb || 'VOITTO %'}</span>
                                    <span>{m.awayWinProb}%</span>
                                </div>
                            </div>
                        </div>

                        {/* 1X2 JA O/U */}
                        <div style={{ display: 'flex', justifyContent: 'space-around', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '5px 10px', marginBottom: '15px', fontSize: '0.7rem', color: '#ccc', textAlign: 'center' }}>
                            <div>
                                <span style={{ color: '#888', display: 'block', fontSize: '0.6rem' }}>{t.predRegTime || '1X2'}</span>
                                <span>{m.homeRegProb}% - <span style={{color: '#ffaa00'}}>{m.otProb}%</span> - {m.awayRegProb}%</span>
                            </div>
                            <div style={{ borderLeft: '1px solid #333', paddingLeft: '15px' }}>
                                <span style={{ color: '#888', display: 'block', fontSize: '0.6rem' }}>{t.predOver55 || 'O/U 5.5'}</span>
                                <span>YLI: <span style={{color: m.over55Prob > 50 ? '#4ade80' : '#ccc'}}>{m.over55Prob}%</span> / ALLE: <span style={{color: m.over55Prob <= 50 ? '#4ade80' : '#ccc'}}>{100 - m.over55Prob}%</span></span>
                            </div>
                        </div>

                        {/* JOUKKUEET JA KESKILAATIKKO (SUOSIKKI TAI LOPPUTULOS) */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,204,0,0.2)', paddingBottom: '12px', marginBottom: '12px' }}>
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <img src={`https://assets.nhle.com/logos/nhl/svg/${homeAbbrev}_light.svg`} style={{ width: '45px', height: '45px' }} alt={homeAbbrev} />
                                <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '1.1rem', marginTop: '4px' }}>{homeAbbrev}</div>
                            </div>
                            
                            <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                
                                {!isFinal ? (
                                    <div style={{ background: 'rgba(255, 204, 0, 0.1)', padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(255, 204, 0, 0.3)', width: '100%' }}>
                                        <div style={{ fontSize: '0.6rem', color: '#ffcc00', letterSpacing: '1px' }}>{t.predFav || 'SUOSIKKI'}</div>
                                        <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#ffcc00', fontFamily: "'Teko', sans-serif", lineHeight: 1 }}>
                                            {m.homeWinProb > m.awayWinProb ? homeAbbrev : m.awayWinProb > m.homeWinProb ? awayAbbrev : '50 - 50'}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.2)', width: '100%' }}>
                                        <div style={{ fontSize: '0.6rem', color: '#aaa', letterSpacing: '1px' }}>{t.predActual || 'TOTEUTUNUT'}</div>
                                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fff', fontFamily: "'Teko', sans-serif", lineHeight: 1 }}>
                                            {realHomeScore} - {realAwayScore}
                                        </div>
                                    </div>
                                )}

                            </div>

                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <img src={`https://assets.nhle.com/logos/nhl/svg/${awayAbbrev}_light.svg`} style={{ width: '45px', height: '45px' }} alt={awayAbbrev} />
                                <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '1.1rem', marginTop: '4px' }}>{awayAbbrev}</div>
                            </div>
                        </div>

                        {/* PERUSTELUT LÄPI KÄÄNTÄJÄN */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                            <div style={{ flex: 1, paddingRight: '5px' }}>
                                {m.homeReasons.map((r, idx) => (
                                    <div key={idx} style={{ color: r.type === 'plus' ? '#4ade80' : '#ff4444', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <span style={{ fontWeight: 'bold', fontSize: '1rem', width: '12px' }}>{r.type === 'plus' ? '+' : '-'}</span> {renderReason(r)}
                                    </div>
                                ))}
                            </div>
                            
                            <div style={{ width: '1px', background: '#333' }}></div> 
                            
                            <div style={{ flex: 1, paddingLeft: '5px', textAlign: 'right' }}>
                                {m.awayReasons.map((r, idx) => (
                                    <div key={idx} style={{ color: r.type === 'plus' ? '#4ade80' : '#ff4444', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
                                        {renderReason(r)} <span style={{ fontWeight: 'bold', fontSize: '1rem', width: '12px', textAlign: 'right' }}>{r.type === 'plus' ? '+' : '-'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                );
            })}
        </div>
    );
};

// --- APUKOMPONENTTI: INFO-NÄKYMÄ ---
const InfoView = ({ t }) => {
    const p2SplitIndex = t.predInfoP2.indexOf(':');
    const p2Title = t.predInfoP2.substring(0, p2SplitIndex);
    const p2Text = t.predInfoP2.substring(p2SplitIndex + 1);

    const p3SplitIndex = t.predInfoP3.indexOf(':');
    const p3Title = t.predInfoP3.substring(0, p3SplitIndex);
    const p3Text = t.predInfoP3.substring(p3SplitIndex + 1);

    const p5SplitIndex = (t.predInfoP5 || "").indexOf(':');
    const p5Title = (t.predInfoP5 || "").substring(0, p5SplitIndex);
    const p5Text = (t.predInfoP5 || "").substring(p5SplitIndex + 1);

    return (
        <div style={{ color: '#ccc', lineHeight: '1.6', fontSize: '0.95rem', padding: '0 10px' }}>
            <h3 style={{ color: '#ffcc00', borderBottom: '1px solid #333', paddingBottom: '8px', marginBottom: '15px' }}>
                {t.predInfoTitle}
            </h3>
            <p style={{ marginBottom: '20px' }}>{t.predInfoP1}</p>
            
            <h4 style={{ color: '#fff', marginBottom: '10px' }}>🏒 {t.predInfoMethod}</h4>
            <div style={{ background: 'rgba(255, 204, 0, 0.05)', padding: '15px', borderRadius: '8px', borderLeft: '3px solid #ffcc00', marginBottom: '20px' }}>
                <p style={{ margin: '0 0 10px 0' }}><strong>1. {p2Title}:</strong>{p2Text}</p>
                <p style={{ margin: '0 0 10px 0' }}><strong>2. {p3Title}:</strong>{p3Text}</p>
                {p5Title && <p style={{ margin: '0' }}><strong>3. {p5Title}:</strong>{p5Text}</p>}
            </div>

            {/* UUSI KOKOONPANO-DISCLAIMER */}
            {t.predInfoP6 && (
                <div style={{ background: 'rgba(0, 212, 255, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(0, 212, 255, 0.2)', color: '#00d4ff', fontSize: '0.85rem', marginBottom: '20px' }}>
                    ℹ️ {t.predInfoP6}
                </div>
            )}

            <div style={{ background: 'rgba(255, 68, 68, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 68, 68, 0.3)', color: '#ff8888', fontSize: '0.85rem' }}>
                {t.predInfoP4}
            </div>
        </div>
    );
};

// --- APUKOMPONENTTI: JOUKKUENÄKYMÄ ---
const TeamView = ({ teams = [], language }) => {
    const safeTeams = Array.isArray(teams) ? teams : [];
    const east = safeTeams.filter(t => t.conference === 'Eastern');
    const west = safeTeams.filter(t => t.conference === 'Western');

    const renderConference = (list, title) => (
        <div style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#ffcc00', borderBottom: '1px solid #333', paddingBottom: '5px' }}>{title}</h3>
            {list.map((t, i) => (
                <div key={t.teamAbbrev} style={{ 
                    display: 'flex', alignItems: 'center', padding: '10px 5px', 
                    borderBottom: '1px solid #222',
                    background: i === 7 ? 'rgba(255, 204, 0, 0.05)' : 'transparent' 
                }}>
                    <span style={{ width: '25px', color: i < 8 ? '#4ade80' : '#ff4444', fontSize: '0.8rem' }}>{i + 1}.</span>
                    <img src={`https://assets.nhle.com/logos/nhl/svg/${t.teamAbbrev}_light.svg`} style={{ width: '24px', height: '24px', marginRight: '10px' }} alt={t.teamAbbrev} />
                    <span style={{ flex: 1, fontWeight: 'bold', fontSize: '0.9rem', color: '#fff' }}>{t.teamName}</span>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#ffcc00', fontWeight: 'bold' }}>{t.projectedPoints} P</div>
                        <div style={{ fontSize: '0.7rem', color: '#666' }}>{language === 'fi' ? 'NYT' : 'NOW'}: {t.currentPoints}</div>
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div>
            {renderConference(east, language === 'fi' ? 'ITÄINEN KONFERENSSI' : 'EASTERN CONFERENCE')}
            {renderConference(west, language === 'fi' ? 'LÄNTINEN KONFERENSSI' : 'WESTERN CONFERENCE')}
        </div>
    );
};

// --- APUKOMPONENTTI: PELAAJANÄKYMÄ ---
const lyhennaNimi = (kokoNimi) => {
    if (!kokoNimi) return "";
    const osat = kokoNimi.split(' ');
    if (osat.length > 1) {
        return `${osat[0].charAt(0)}. ${osat.slice(1).join(' ')}`;
    }
    return kokoNimi;
};

const PlayerView = ({ players = [], t, onPlayerClick, onClose }) => {
    const safePlayers = Array.isArray(players) ? players : [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', color: '#888', fontSize: '0.7rem', textTransform: 'uppercase', paddingBottom: '8px', borderBottom: '1px solid rgba(255, 204, 0, 0.3)', marginBottom: '5px' }}>
                <div style={{ width: '22px', textAlign: 'center' }}>#</div>
                <div style={{ flex: 1, paddingLeft: '6px' }}>{t.predPlayer}</div>
                <div style={{ width: '65px', textAlign: 'center' }}>{t.predCurrent}</div>
                <div style={{ width: '70px', textAlign: 'center', color: '#ffcc00', fontWeight: 'bold' }}>{t.predProj}</div>
            </div>

            {safePlayers.map((p, i) => (
                <div key={p.id} onClick={() => { onClose(); onPlayerClick(p.id); }} style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '8px 2px', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ width: '22px', textAlign: 'center', color: i < 3 ? '#ffcc00' : '#888', fontWeight: i < 3 ? 'bold' : 'normal', fontSize: '0.95rem', flexShrink: 0 }}>
                        {i + 1}.
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '4px', overflow: 'hidden' }}>
                        <img src={`https://assets.nhle.com/logos/nhl/svg/${p.team}_light.svg`} style={{ width: '20px', height: '20px', flexShrink: 0 }} alt={p.team} />
                        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {lyhennaNimi(p.name)}
                        </span>
                    </div>
                    <div style={{ width: '65px', textAlign: 'center', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                        <span style={{ color: '#ccc', fontSize: '0.85rem', fontWeight: 'bold' }}>{p.currentStats?.p || 0} {t.predP}</span>
                        <span style={{ color: '#666', fontSize: '0.65rem' }}>{p.currentStats?.g || 0}+{p.currentStats?.a || 0} ({p.currentStats?.gp || 0} O)</span>
                    </div>
                    <div style={{ width: '70px', textAlign: 'center', display: 'flex', flexDirection: 'column', background: 'rgba(255, 204, 0, 0.08)', padding: '4px 2px', borderRadius: '6px', marginLeft: '4px', flexShrink: 0 }}>
                        <span style={{ color: '#ffcc00', fontSize: '1.05rem', fontWeight: 'bold' }}>{p.predictedStats?.p || 0}</span>
                        <span style={{ color: '#aaa', fontSize: '0.65rem' }}>{p.predictedStats?.g || 0}+{p.predictedStats?.a || 0}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default PredictionModal;