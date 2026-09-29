import React, { useState, useEffect } from 'react';
import { translations } from '../utils/translations';
import TeamBadge from './TeamBadge';
import { api } from '../utils/api';
import { useFetchWhenOpen } from '../hooks/useModal';
import Sheet from './Sheet';

/** "20252026" -> "2025–26" */
const formatSeason = (seasonId) =>
    seasonId ? `${seasonId.slice(0, 4)}–${seasonId.slice(6)}` : '';

/** Mitkä sivut järjestetään millä tilastolla. */
const SORT_BY_PAGE = {
    all: 'points',
    finns: 'points',
    goals: 'goals',
    assists: 'assists',
    plusMinus: 'plusMinus',
    penaltyMinutes: 'penaltyMinutes',
    timeOnIcePerGame: 'timeOnIcePerGame',
};

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

const haeNykyinenJoukkue = (teamAbbrevs) => {
    if (!teamAbbrevs) return "";
    const joukkueet = teamAbbrevs.split(',');
    return joukkueet[joukkueet.length - 1].trim();
};

const TeletextModal = ({ isOpen, onClose, pageType, onPlayerClick, language, zIndex = 99000 }) => {
    const t = translations[language] || translations.fi;
    const [activeTab, setActiveTab] = useState('skaters');

    // 'finns'-sivu näyttää suomalaiset (tai eurooppalaiset englanniksi), muut koko liigan.
    const region = pageType === 'finns' ? language : 'all';

    const { data: response, isLoading } = useFetchWhenOpen(
        isOpen && Boolean(pageType),
        (signal) => api.leaders({ region, sort: SORT_BY_PAGE[pageType] ?? 'points', limit: 100 }, { signal }),
        [pageType, region],
    );

    const data = {
        skaters: response?.skaters ?? [],
        goalies: response?.goalies ?? [],
    };

    useEffect(() => {
        setActiveTab('skaters');
    }, [pageType]);

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
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            zIndex={zIndex}
            size="full"
            title={otsikko}
            subtitle={response?.isPreviousSeason
                ? (language === 'fi' ? `Kausi ${formatSeason(response.season)}` : `Season ${formatSeason(response.season)}`)
                : undefined}
        >
            <>

                {(pageType === 'all' || pageType === 'finns') && (
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', justifyContent: 'center' }}>
                        <button className={`sched-filter-btn ${activeTab === 'skaters' ? 'active' : ''}`} onClick={() => setActiveTab('skaters')}>{t.ttvSkatersBtn}</button>
                        <button className={`sched-filter-btn ${activeTab === 'goalies' ? 'active' : ''}`} onClick={() => setActiveTab('goalies')}>{t.ttvGoaliesBtn}</button>
                    </div>
                )}

                <div style={{ 
                    border: '1px solid rgba(0, 212, 255, 0.4)', background: 'var(--surface-sunken)', borderRadius: '12px', 
                    padding: '15px 10px', minHeight: '70vh', boxShadow: '0 4px 15px rgba(0, 212, 255, 0.15)', 
                    color: 'var(--text-primary)', overflowX: 'hidden' 
                }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--positive)', fontWeight: 'bold', marginBottom: '15px', borderBottom: '1px dashed #333', paddingBottom: '8px', fontSize: '0.85rem' }}>
                        <span>{sivuNumero}</span>
                        <span>d4nyyy.fi TextTV</span>
                        <span>{pvm}</span>
                    </div>

                    {isLoading ? (
                        <div style={{ color: 'var(--accent-text)', textAlign: 'center', marginTop: '50px' }}>{t.loading}</div>
                    ) : (
                        <div style={{ margin: 0, padding: 0, fontSize: 'clamp(0.7rem, 3.5vw, 1.1rem)', lineHeight: '1.6', fontFamily: "'Courier New', Courier, monospace" }}>
                            
                            <div style={{ color: 'var(--gold)', fontWeight: 'bold', marginBottom: '15px', textAlign: 'center' }}>
                                {otsikko} {pageType === 'finns' ? '' : '(TOP 50)'}
                            </div>

                            {/* Kesällä ja ennen kauden avausta näytetään edellisen kauden luvut.
                                Kerrotaan se selvästi, ettei käyttäjä luule niitä tämän kauden luvuiksi. */}
                            {response?.isPreviousSeason && (
                                <div style={{ color: 'var(--gold)', textAlign: 'center', marginBottom: '15px', fontSize: '0.8rem' }}>
                                    {language === 'fi'
                                        ? `KAUSI ${formatSeason(response.season)} — UUSI KAUSI EI OLE VIELÄ ALKANUT`
                                        : `SEASON ${formatSeason(response.season)} — NEW SEASON HAS NOT STARTED YET`}
                                </div>
                            )}


                            {activeTab === 'skaters' ? (
                                <>
                                    <div style={{ display: 'flex', gap: '1ch', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-strong)', paddingBottom: '4px', marginBottom: '8px', fontWeight: 'bold' }}>
                                        <div style={{ width: '3ch' }}></div>
                                        <div style={{ width: '22px' }}></div> 
                                        <div style={{ flex: 1 }}>{language === 'fi' ? 'PELAAJAT' : 'PLAYERS'}</div>
                                        <div style={{ width: c1, textAlign: 'right' }}>{h1}</div>
                                        <div style={{ width: c2, textAlign: 'right' }}>{h2}</div>
                                        {h3 && <div style={{ width: c3, textAlign: 'right' }}>{h3}</div>}
                                        {h4 && <div style={{ width: c4, textAlign: 'right' }}>{h4}</div>}
                                    </div>

                                    {data.skaters.slice(0, 50).map((p, i) => {
                                        const lippu = (pageType === 'finns') ? '' : haeLippu(p.nationalityCode);
                                        const nimi = muotoileNimi(p.skaterFullName);
                                        const isD = p.positionCode === 'D';
                                        const teamAbbrev = haeNykyinenJoukkue(p.teamAbbrevs);
                                        
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
                                                onClick={() => onPlayerClick(p.playerId)} 
                                                style={{ display: 'flex', gap: '1ch', cursor: 'pointer', padding: '4px 0', color: isD ? 'var(--accent-text)' : 'var(--text-primary)', alignItems: 'center' }}
                                                onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-sunken)'}
                                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <div style={{ width: '3ch', textAlign: 'right', color: 'var(--text-tertiary)' }}>{i + 1}.</div>
                                                
                                                {/* NHL LOGO KORVATTU TEAMBADGELLA */}
                                                <div style={{ width: '22px', display: 'flex', justifyContent: 'center' }}>
                                                    {teamAbbrev ? <TeamBadge abbrev={teamAbbrev} size={18} /> : null}
                                                </div>

                                                <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span>{nimi}</span>
                                                    {pageType !== 'finns' && lippu && <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{lippu}</span>}
                                                </div>

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
                                    <div style={{ display: 'flex', gap: '1ch', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-strong)', paddingBottom: '4px', marginBottom: '8px', fontWeight: 'bold' }}>
                                        <div style={{ width: '3ch' }}></div>
                                        <div style={{ width: '22px' }}></div> 
                                        <div style={{ flex: 1 }}>{language === 'fi' ? 'MAALIVAHDIT' : 'GOALIES'}</div>
                                        <div style={{ width: '3ch', textAlign: 'right' }}>{g_h1}</div>
                                        <div style={{ width: '5ch', textAlign: 'right' }}>{g_h2}</div>
                                        <div style={{ width: '5ch', textAlign: 'right' }}>{g_h3}</div>
                                    </div>

                                    {data.goalies.slice(0, 50).map((g, i) => {
                                        const lippu = (pageType === 'finns') ? '' : haeLippu(g.nationalityCode);
                                        const nimi = muotoileNimi(g.goalieFullName);
                                        const gaa = g.goalsAgainstAverage.toFixed(2);
                                        const sv = (g.savePct * 100).toFixed(1);
                                        const teamAbbrev = haeNykyinenJoukkue(g.teamAbbrevs);

                                        return (
                                            <div 
                                                key={g.playerId} 
                                                onClick={() => onPlayerClick(g.playerId)} 
                                                style={{ display: 'flex', gap: '1ch', cursor: 'pointer', padding: '4px 0', color: 'var(--text-primary)', alignItems: 'center' }}
                                                onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-sunken)'}
                                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <div style={{ width: '3ch', textAlign: 'right', color: 'var(--text-tertiary)' }}>{i + 1}.</div>
                                                
                                                {/* NHL LOGO KORVATTU TEAMBADGELLA */}
                                                <div style={{ width: '22px', display: 'flex', justifyContent: 'center' }}>
                                                    {teamAbbrev ? <TeamBadge abbrev={teamAbbrev} size={18} /> : null}
                                                </div>

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
            </>
        </Sheet>
    );
};

export default TeletextModal;