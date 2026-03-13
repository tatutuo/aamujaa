import React, { useState, useEffect } from 'react';
import { translations } from '../utils/translations';
import TeamBadge from './TeamBadge'; // LISÄTTY TURVALLINEN KOMPONENTTI

const PlayerModal = ({ isOpen, onClose, playerId, favPlayers, toggleFavPlayer, fantasyTeam, toggleFantasyPlayer, language }) => {
    const t = translations[language] || translations.fi;
    const [player, setPlayer] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!isOpen || !playerId) return;

        setIsLoading(true);
        setError(false);

        fetch(`/api/nhl/player/${playerId}`)
            .then(res => {
                if (!res.ok) throw new Error('Verkkovirhe');
                return res.json();
            })
            .then(data => {
                setPlayer(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Virhe pelaajan haussa:", err);
                setError(true);
                setIsLoading(false);
            });
    }, [playerId, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{ display: 'block', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 99999 }}>
            <div style={{ display: 'block', position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '95%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#1a1a1a', borderRadius: '10px', boxShadow: '0 10px 40px rgba(0,0,0,0.9)', padding: '20px', boxSizing: 'border-box' }}>
                
                <span className="close-card-btn" onClick={onClose} style={{ position: 'absolute', right: '15px', top: '10px', fontSize: '2rem', cursor: 'pointer', color: '#888', lineHeight: 1 }}>&times;</span>
                
                {isLoading ? (
                    <div className="loading" style={{ textAlign: 'center', padding: '40px', color: 'var(--accent-blue)' }}>{t.pmLoading}</div>
                ) : error || !player ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#ff4444' }}>{t.pmError}</div>
                ) : (
                    <PlayerCardContent 
                        p={player} 
                        favPlayers={favPlayers} 
                        toggleFavPlayer={toggleFavPlayer}
                        fantasyTeam={fantasyTeam}
                        toggleFantasyPlayer={toggleFantasyPlayer}
                        t={t}
                    />
                )}
            </div>
        </div>
    );
};

const PlayerCardContent = ({ p, favPlayers, toggleFavPlayer, fantasyTeam, toggleFantasyPlayer, t }) => {
    const [seasonType, setSeasonType] = useState('regular'); 

    const isGoalie = p.position === 'G' || p.position === 'Goalie';
    
    const stats = p.featuredStats?.regularSeason?.subSeason || {};
    const career = p.featuredStats?.regularSeason?.career || {};
    
    const targetGameTypeId = seasonType === 'regular' ? 2 : 3;
    
    const nhlSeasons = (p.seasonTotals || [])
        .filter(s => s.leagueAbbrev === 'NHL' && s.gameTypeId === targetGameTypeId)
        .reverse();

    const currentId = p.playerId || p.id;
    const isFav = favPlayers?.includes(currentId);
    const isFantasy = fantasyTeam?.some(f => f.id === currentId);

    return (
        <>
            <div style={{ textAlign: 'center', position: 'relative', paddingBottom: '10px' }}>
                
                {/* 1. KORJATTU: POISTETTU teamLogo JA KORVATTU TeamBadge-komponentilla */}
                <div style={{ position: 'absolute', left: 0, top: 0, opacity: 0.8 }}>
                    {p.currentTeamAbbrev && <TeamBadge abbrev={p.currentTeamAbbrev} size={40} />}
                </div>

                {/* 2. KORJATTU: POISTETTU headshot-kuva JA KORVATTU TYYLITELLYLLÄ IKONILLA */}
                <div style={{ 
                    width: '90px', 
                    height: '90px', 
                    borderRadius: '50%', 
                    border: '2px solid #333', 
                    margin: '10px auto 0 auto', 
                    backgroundColor: '#222',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '3rem',
                    color: '#555'
                }}>
                    👤
                </div>
                
                <h2 style={{ margin: '10px 0 5px 0', color: '#fff', fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                    <button 
                        className={`fav-sydan ${isFav ? 'aktiivinen' : ''}`} 
                        onClick={() => toggleFavPlayer(currentId)}
                        style={{ fontSize: '1.8rem' }}
                    >
                        {isFav ? '♥' : '♡'}
                    </button>
                    
                    #{p.sweaterNumber} {p.firstName?.default} {p.lastName?.default}
                    
                    <button 
                        className={`fav-tahti ${isFantasy ? 'aktiivinen' : ''}`} 
                        onClick={() => toggleFantasyPlayer({ id: currentId, name: `${p.firstName?.default} ${p.lastName?.default}`, position: p.position })}
                        style={{ fontSize: '1.6rem' }}
                    >
                        {isFantasy ? '★' : '☆'}
                    </button>
                </h2>
                <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '20px' }}>
                    {p.position} | {p.heightInCentimeters} cm | {p.weightInKilograms} kg | {p.birthCountry}
                </div>
            </div>
            
            <div style={{ color: 'var(--accent-blue)', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.9rem' }}>{t.pmLatest} (Runkosarja)</div>
            <div style={{ display: 'flex', justifyContent: 'space-around', background: '#222', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #333' }}>
                {isGoalie ? (
                    <>
                        <StatBox value={stats.gamesPlayed} label="GP" />
                        <StatBox value={stats.wins} label="W" color="#4ade80" />
                        <StatBox value={(stats.goalsAgainstAverage || 0).toFixed(2)} label="GAA" />
                        <StatBox value={(stats.savePctg || 0).toFixed(3)} label="SV%" color="var(--accent-blue)" />
                    </>
                ) : (
                    <>
                        <StatBox value={stats.goals} label={t.pmGoals} />
                        <StatBox value={stats.assists} label={t.pmAssists} />
                        <StatBox value={stats.points} label={t.pmPoints} color="var(--accent-blue)" />
                    </>
                )}
            </div>
            
            <div style={{ color: '#ffcc00', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.9rem' }}>{t.pmCareer} (Runkosarja)</div>
            <div style={{ display: 'flex', justifyContent: 'space-around', background: '#222', padding: '12px', borderRadius: '8px', border: '1px solid #333' }}>
                {isGoalie ? (
                    <>
                        <StatBox value={career.gamesPlayed} label="GP" />
                        <StatBox value={career.wins} label="W" color="#4ade80" />
                        <StatBox value={(career.goalsAgainstAverage || 0).toFixed(2)} label="GAA" />
                        <StatBox value={(career.savePctg || 0).toFixed(3)} label="SV%" color="var(--accent-blue)" />
                    </>
                ) : (
                    <>
                        <StatBox value={career.goals} label={t.pmGoals} />
                        <StatBox value={career.assists} label={t.pmAssists} />
                        <StatBox value={career.points} label={t.pmPoints} color="#ffcc00" />
                        <StatBox value={career.gamesPlayed} label={t.pmGames} />
                    </>
                )}
            </div>
            
            <div style={{ marginTop: '30px' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: '0', fontSize: '0.9rem', color: '#aaa', textTransform: 'uppercase' }}>{t.pmSeasonBySeason}</h3>
                    <div style={{ display: 'flex', gap: '5px', background: '#222', padding: '3px', borderRadius: '6px' }}>
                        <button 
                            onClick={() => setSeasonType('regular')}
                            style={{ background: seasonType === 'regular' ? 'var(--accent-blue)' : 'transparent', color: seasonType === 'regular' ? '#000' : '#888', border: 'none', padding: '4px 8px', fontSize: '0.7rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            {t.pmRegularSeason || "RUNKOSARJA"}
                        </button>
                        <button 
                            onClick={() => setSeasonType('playoffs')}
                            style={{ background: seasonType === 'playoffs' ? 'var(--accent-blue)' : 'transparent', color: seasonType === 'playoffs' ? '#000' : '#888', border: 'none', padding: '4px 8px', fontSize: '0.7rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            {t.pmPlayoffs || "PLAYOFF"}
                        </button>
                    </div>
                </div>

                <div style={{ width: '100%', overflowX: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #444', color: '#888', fontSize: '0.7rem' }}>
                                <th style={{ padding: '4px 1px', fontWeight: 'normal', textAlign: 'left' }}>{t.pmSeason}</th>
                                <th style={{ padding: '4px 1px', fontWeight: 'normal', textAlign: 'left' }}>{t.pmTeam}</th>
                                <th style={{ padding: '4px 1px', fontWeight: 'normal', textAlign: 'center' }}>GP</th>
                                {isGoalie ? (
                                    <>
                                        <th style={{ padding: '4px 1px', fontWeight: 'normal', textAlign: 'center' }}>W</th>
                                        <th style={{ padding: '4px 1px', fontWeight: 'normal', textAlign: 'center' }}>GAA</th>
                                        <th style={{ padding: '4px 1px', fontWeight: 'bold', color: '#aaa', textAlign: 'center' }}>SV%</th>
                                    </>
                                ) : (
                                    <>
                                        <th style={{ padding: '4px 1px', fontWeight: 'normal', textAlign: 'center' }}>M</th>
                                        <th style={{ padding: '4px 1px', fontWeight: 'normal', textAlign: 'center' }}>S</th>
                                        <th style={{ padding: '4px 1px', fontWeight: 'bold', color: '#aaa', textAlign: 'center' }}>P</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {nhlSeasons.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#555', fontStyle: 'italic' }}>
                                        Ei tilastoja tästä kategoriasta.
                                    </td>
                                </tr>
                            ) : (
                                nhlSeasons.map((s, index) => {
                                    const seasonStr = s.season.toString();
                                    const shortSeason = seasonStr.substring(2, 4) + '-' + seasonStr.substring(6, 8);

                                    return (
                                        <tr key={index} style={{ borderBottom: '1px dashed #333' }}>
                                            <td style={{ padding: '5px 1px', fontSize: '0.8rem', color: '#aaa', textAlign: 'left' }}>{shortSeason}</td>
                                            <td style={{ padding: '5px 1px', fontSize: '0.85rem', fontWeight: 'bold', color: '#ddd', textAlign: 'left' }}>{s.teamName?.default}</td>
                                            <td style={{ padding: '5px 1px', fontSize: '0.8rem', color: '#888', textAlign: 'center' }}>{s.gamesPlayed || 0}</td>
                                            
                                            {isGoalie ? (
                                                <>
                                                    <td style={{ padding: '5px 1px', fontSize: '0.8rem', color: '#4ade80', textAlign: 'center' }}>{s.wins || 0}</td>
                                                    <td style={{ padding: '5px 1px', fontSize: '0.8rem', color: '#ddd', textAlign: 'center' }}>{(s.goalsAgainstAverage || 0).toFixed(2)}</td>
                                                    <td style={{ padding: '5px 1px', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--accent-blue)', textAlign: 'center' }}>{(s.savePctg || 0).toFixed(3)}</td>
                                                </>
                                            ) : (
                                                <>
                                                    <td style={{ padding: '5px 1px', fontSize: '0.8rem', color: '#ddd', textAlign: 'center' }}>{s.goals || 0}</td>
                                                    <td style={{ padding: '5px 1px', fontSize: '0.8rem', color: '#ddd', textAlign: 'center' }}>{s.assists || 0}</td>
                                                    <td style={{ padding: '5px 1px', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--accent-blue)', textAlign: 'center' }}>{s.points || 0}</td>
                                                </>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
};

const StatBox = ({ value, label, color = '#fff' }) => (
    <div style={{ textAlign: 'center' }}>
        <span style={{ display: 'block', fontSize: '1.2rem', fontWeight: 'bold', color: color }}>{value || 0}</span>
        <span style={{ fontSize: '0.7rem', color: '#888' }}>{label}</span>
    </div>
);

export default PlayerModal;