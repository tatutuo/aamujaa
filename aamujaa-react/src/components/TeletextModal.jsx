import React, { useState, useEffect } from 'react';
import { translations } from '../utils/translations';

const haeLippu = (maaKoodi) => {
    const liput = {
        "FIN": "🇫🇮", "SWE": "🇸🇪", "RUS": "🇷🇺", "CZE": "🇨🇿",
        "USA": "🇺🇸", "CAN": "🇨🇦", "SVK": "🇸🇰", 
        "DEU": "🇩🇪", "CHE": "🇨🇭", "DNK": "🇩🇰",
        "LVA": "🇱🇻", "AUT": "🇦🇹", "FRA": "🇫🇷", "NOR": "🇳🇴", 
        "SVN": "🇸🇮", "BLR": "🇧🇾", "AUS": "🇦🇺", "GBR": "🇬🇧"
    };
    return liput[maaKoodi] || "🏴"; 
};

const muotoileNimi = (kokoNimi) => {
    if (!kokoNimi) return "";
    const osat = kokoNimi.split(' ');
    if (osat.length > 1) {
        const suku = osat.slice(1).join(' ');
        const eka = osat[0];
        return `${suku} ${eka.charAt(0)}.`;
    }
    return kokoNimi;
};

// Apufunktio joukkueen lyhenteen kaivamiseen 
const haeNykyinenJoukkue = (teamAbbrevs) => {
    if (!teamAbbrevs) return "";
    const joukkueet = teamAbbrevs.split(',');
    return joukkueet[joukkueet.length - 1].trim();
};

const TeletextModal = ({ isOpen, onClose, pageType, onPlayerClick, language }) => {
    const t = translations[language] || translations.fi;
    const [data, setData] = useState({ skaters: [], goalies: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('skaters');

    useEffect(() => {
        if (!isOpen || !pageType) return;
        
        setIsLoading(true);
        setActiveTab('skaters');

        let url = '';
        if (pageType === 'all') url = '/api/nhl/tekstitv-kaikki';
        else if (pageType === 'finns') url = `/api/nhl/tekstitv?alue=${language}`; 
        else if (['goals', 'assists', 'penaltyMinutes', 'timeOnIcePerGame', 'plusMinus'].includes(pageType)) {
            url = `/api/nhl/leaders/${pageType}`;
        }

        fetch(url)
            .then(res => res.json())
            .then(fetchedData => {
                if (['goals', 'assists', 'penaltyMinutes', 'timeOnIcePerGame', 'plusMinus'].includes(pageType)) {
                    setData({ skaters: fetchedData, goalies: [] });
                } else {
                    setData({ skaters: fetchedData.skaters || [], goalies: fetchedData.goalies || [] });
                }
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Teksti-TV virhe:", err);
                setIsLoading(false);
            });
    }, [isOpen, pageType, language]);

    if (!isOpen) return null;

    const pvm = new Date().toLocaleDateString('fi-FI');

    let sivuNumero = '235';
    let otsikko = t.ttvTitleFinns;

    if (pageType === 'all') { sivuNumero = '236'; otsikko = t.ttvTitleAll; }
    else if (pageType === 'goals') { sivuNumero = '237'; otsikko = t.ttvTitleGoals; }
    else if (pageType === 'assists') { sivuNumero = '238'; otsikko = t.ttvTitleAssists; }
    else if (pageType === 'plusMinus') { sivuNumero = '239'; otsikko = t.ttvTitlePm; }
    else if (pageType === 'penaltyMinutes') { sivuNumero = '240'; otsikko = t.ttvTitlePim; }
    else if (pageType === 'timeOnIcePerGame') { sivuNumero = '241'; otsikko = t.ttvTitleToi; }

    // --- DYNAAMISET SARAKKEET (FLEXBOX) ---
    let h1 = language === 'fi' ? 'O' : 'GP';
    let h2 = language === 'fi' ? 'M' : 'G';
    let h3 = language === 'fi' ? 'S' : 'A';
    let h4 = language === 'fi' ? 'P' : 'P';
    
    let c1 = '3ch', c2 = '3ch', c3 = '3ch', c4 = '3ch';

    if (pageType === 'plusMinus') {
        h2 = '+/-'; c2 = '4ch';
        h3 = ''; c3 = '0ch'; 
        h4 = ''; c4 = '0ch'; 
    } else if (pageType === 'penaltyMinutes') {
        h2 = 'PIM'; c2 = '4ch';
        h3 = ''; c3 = '0ch'; 
        h4 = ''; c4 = '0ch'; 
    } else if (pageType === 'timeOnIcePerGame') {
        h2 = 'TOI/G'; c2 = '6ch';
        h3 = '+/-'; c3 = '4ch';
        h4 = ''; c4 = '0ch';
    }

    const g_h1 = language === 'fi' ? 'O' : 'GP';
    const g_h2 = language === 'fi' ? 'PÄM' : 'GAA';
    const g_h3 = language === 'fi' ? 'T%' : 'SV%';

    return (
        <div className="modal-overlay" style={{ display: 'block', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.95)', zIndex: 100000, overflowY: 'auto' }}>
            <div style={{ padding: '15px', paddingBottom: '50px', maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
                
                <span onClick={onClose} style={{ position: 'fixed', right: '20px', top: '15px', fontSize: '2.5rem', cursor: 'pointer', color: '#888', lineHeight: 1, zIndex: 100000, background: 'rgba(0,0,0,0.8)', borderRadius: '50%', width: '40px', height: '40px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.5)' }}>&times;</span>
                
                <h2 style={{ color: '#00d4ff', textAlign: 'center', marginTop: '10px', marginBottom: '15px', fontSize: '1.5rem', borderBottom: '1px solid #333', paddingBottom: '10px', letterSpacing: '1px', fontFamily: "'Teko', sans-serif" }}>{t.statsTitle}</h2>

                {(pageType === 'all' || pageType === 'finns') && (
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', justifyContent: 'center' }}>
                        <button className={`sched-filter-btn ${activeTab === 'skaters' ? 'active' : ''}`} onClick={() => setActiveTab('skaters')}>{t.ttvSkatersBtn}</button>
                        <button className={`sched-filter-btn ${activeTab === 'goalies' ? 'active' : ''}`} onClick={() => setActiveTab('goalies')}>{t.ttvGoaliesBtn}</button>
                    </div>
                )}

                <div style={{ 
                    border: '1px solid rgba(0, 212, 255, 0.4)', background: '#0a0a0a', borderRadius: '12px', 
                    padding: '15px 10px', minHeight: '70vh', boxShadow: '0 4px 15px rgba(0, 212, 255, 0.15)', 
                    color: '#fff', overflowX: 'hidden' 
                }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#00ff00', fontWeight: 'bold', marginBottom: '15px', borderBottom: '1px dashed #333', paddingBottom: '8px', fontSize: '0.85rem' }}>
                        <span>{sivuNumero}</span>
                        <span>d4nyyy.fi TextTV</span>
                        <span>{pvm}</span>
                    </div>

                    {isLoading ? (
                        <div style={{ color: '#00d4ff', textAlign: 'center', marginTop: '50px' }}>{t.loading}</div>
                    ) : (
                        <div style={{ margin: 0, padding: 0, fontSize: 'clamp(0.7rem, 3.5vw, 1.1rem)', lineHeight: '1.6', fontFamily: "'Courier New', Courier, monospace" }}>
                            
                            <div style={{ color: '#ffff00', fontWeight: 'bold', marginBottom: '15px', textAlign: 'center' }}>
                                {otsikko} {pageType === 'finns' ? '' : '(TOP 50)'}
                            </div>
                            
                            {activeTab === 'skaters' ? (
                                <>
                                    {/* SKATERS OTSIKKORIVI */}
                                    <div style={{ display: 'flex', gap: '1ch', color: '#fff', borderBottom: '1px solid #444', paddingBottom: '4px', marginBottom: '8px', fontWeight: 'bold' }}>
                                        <div style={{ width: '3ch' }}></div>
                                        <div style={{ width: '22px' }}></div> {/* Tila logolle */}
                                        <div style={{ flex: 1 }}>{language === 'fi' ? 'PELAAJAT' : 'PLAYERS'}</div>
                                        <div style={{ width: c1, textAlign: 'right' }}>{h1}</div>
                                        <div style={{ width: c2, textAlign: 'right' }}>{h2}</div>
                                        {h3 && <div style={{ width: c3, textAlign: 'right' }}>{h3}</div>}
                                        {h4 && <div style={{ width: c4, textAlign: 'right' }}>{h4}</div>}
                                    </div>

                                    {/* SKATERS DATARIVIT */}
                                    {data.skaters.slice(0, 50).map((p, i) => {
                                        const lippu = (pageType === 'finns') ? '' : haeLippu(p.nationalityCode);
                                        const nimi = muotoileNimi(p.skaterFullName);
                                        const isD = p.positionCode === 'D';
                                        
                                        const teamAbbrev = haeNykyinenJoukkue(p.teamAbbrevs);
                                        const logoUrl = teamAbbrev ? `https://assets.nhle.com/logos/nhl/svg/${teamAbbrev}_light.svg` : null;
                                        
                                        let stat1 = p.goals;
                                        let stat2 = p.assists;
                                        let stat3 = p.points;

                                        if (pageType === 'penaltyMinutes') {
                                            stat1 = p.penaltyMinutes; 
                                        } else if (pageType === 'plusMinus') {
                                            stat1 = p.plusMinus > 0 ? `+${p.plusMinus}` : p.plusMinus;
                                        } else if (pageType === 'timeOnIcePerGame') {
                                            const mins = Math.floor(p.timeOnIcePerGame / 60);
                                            const secs = Math.round(p.timeOnIcePerGame % 60).toString().padStart(2, '0');
                                            stat1 = `${mins}:${secs}`;
                                            stat2 = p.plusMinus > 0 ? `+${p.plusMinus}` : p.plusMinus;
                                        }
                                        
                                        return (
                                            <div 
                                                key={p.playerId} 
                                                onClick={() => { onClose(); onPlayerClick(p.playerId); }} 
                                                style={{ display: 'flex', gap: '1ch', cursor: 'pointer', padding: '4px 0', color: isD ? '#00ffff' : '#fff', alignItems: 'center' }}
                                                onMouseOver={(e) => e.currentTarget.style.background = '#222'}
                                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <div style={{ width: '3ch', textAlign: 'right', color: '#888' }}>{i + 1}.</div>
                                                
                                                <div style={{ width: '22px', display: 'flex', justifyContent: 'center' }}>
                                                    {logoUrl && <img src={logoUrl} style={{ width: '18px', height: '18px', filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.2))' }} alt={teamAbbrev} />}
                                                </div>

                                                <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span>{nimi}</span>
                                                    {pageType !== 'finns' && lippu && <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{lippu}</span>}
                                                </div>

                                                {/* Tilastot */}
                                                <div style={{ width: c1, textAlign: 'right' }}>{p.gamesPlayed}</div>
                                                <div style={{ width: c2, textAlign: 'right' }}>{stat1}</div>
                                                {h3 && <div style={{ width: c3, textAlign: 'right' }}>{stat2}</div>}
                                                {h4 && <div style={{ width: c4, textAlign: 'right' }}>{stat3}</div>}
                                            </div>
                                        );
                                    })}
                                </>
                            ) : (
                                <>
                                    {/* GOALIES OTSIKKORIVI */}
                                    <div style={{ display: 'flex', gap: '1ch', color: '#fff', borderBottom: '1px solid #444', paddingBottom: '4px', marginBottom: '8px', fontWeight: 'bold' }}>
                                        <div style={{ width: '3ch' }}></div>
                                        <div style={{ width: '22px' }}></div> {/* Tila logolle */}
                                        <div style={{ flex: 1 }}>{language === 'fi' ? 'MAALIVAHDIT' : 'GOALIES'}</div>
                                        <div style={{ width: '3ch', textAlign: 'right' }}>{g_h1}</div>
                                        <div style={{ width: '5ch', textAlign: 'right' }}>{g_h2}</div>
                                        <div style={{ width: '5ch', textAlign: 'right' }}>{g_h3}</div>
                                    </div>

                                    {/* GOALIES DATARIVIT */}
                                    {data.goalies.slice(0, 50).map((g, i) => {
                                        const lippu = (pageType === 'finns') ? '' : haeLippu(g.nationalityCode);
                                        const nimi = muotoileNimi(g.goalieFullName);
                                        const gaa = g.goalsAgainstAverage.toFixed(2);
                                        const sv = (g.savePct * 100).toFixed(1);

                                        const teamAbbrev = haeNykyinenJoukkue(g.teamAbbrevs);
                                        const logoUrl = teamAbbrev ? `https://assets.nhle.com/logos/nhl/svg/${teamAbbrev}_light.svg` : null;

                                        return (
                                            <div 
                                                key={g.playerId} 
                                                onClick={() => { onClose(); onPlayerClick(g.playerId); }} 
                                                style={{ display: 'flex', gap: '1ch', cursor: 'pointer', padding: '4px 0', color: '#fff', alignItems: 'center' }}
                                                onMouseOver={(e) => e.currentTarget.style.background = '#222'}
                                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                {/* Sija */}
                                                <div style={{ width: '3ch', textAlign: 'right', color: '#888' }}>{i + 1}.</div>
                                                
                                                {/* Logo */}
                                                <div style={{ width: '22px', display: 'flex', justifyContent: 'center' }}>
                                                    {logoUrl && <img src={logoUrl} style={{ width: '18px', height: '18px', filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.2))' }} alt={teamAbbrev} />}
                                                </div>

                                                {/* Nimi ja pieni lippu perässä */}
                                                <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span>{nimi}</span>
                                                    {pageType !== 'finns' && lippu && <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{lippu}</span>}
                                                </div>

                                                <div style={{ width: '3ch', textAlign: 'right' }}>{g.gamesPlayed}</div>
                                                <div style={{ width: '5ch', textAlign: 'right' }}>{gaa}</div>
                                                <div style={{ width: '5ch', textAlign: 'right' }}>{sv}</div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TeletextModal;