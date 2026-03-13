import React from 'react';
import { translations } from '../utils/translations';
import TeamBadge from './TeamBadge'; // Oletetaan että on samassa kansiossa!

const GameCard = ({ game, onClick, favTeams, toggleFavTeam, language }) => {
    if (!game || !game.homeTeam || !game.awayTeam) return null;
    const t = translations[language] || translations.fi;

    const awayAbbrev = game.awayTeam.abbrev;
    const homeAbbrev = game.homeTeam.abbrev;

    const isLive = game.gameState === "LIVE" || game.gameState === "CRIT";
    const isFavAway = favTeams?.includes(awayAbbrev);
    const isFavHome = favTeams?.includes(homeAbbrev);
    const hasFavTeam = isFavAway || isFavHome;

    let statusText = "";
    if (game.gameState === "FUT" || game.gameState === "PRE") {
        const aika = new Date(game.startTimeUTC);
        statusText = `${t.gameStarts} ${aika.toLocaleTimeString('fi-FI', {hour: '2-digit', minute:'2-digit'})}`;
    } else if (isLive) {
        let kelloText = t.gameLive;
        if (game.clock) {
            if (game.clock.inIntermission) kelloText = t.gameIntermission;
            else kelloText = `${t.gamePeriod} ${game.periodDescriptor?.number} - ${game.clock.timeRemaining}`;
        }
        statusText = `🔴 ${kelloText}`;
    } else {
        statusText = t.gameFinal;
        if (game.periodDescriptor && game.periodDescriptor.periodType !== "REG") {
            statusText += ` (${game.periodDescriptor.periodType})`; 
        }
    }

    return (
        <div className={`game-card ${isLive ? 'live' : ''} ${hasFavTeam ? 'kultareunus' : ''}`} onClick={onClick} style={{ cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', padding: '10px 8px' }}>
            <div className="compact-header" style={{ marginBottom: '8px' }}>
                <span className={`compact-status ${isLive ? 'live-text' : ''}`}>{statusText}</span>
            </div>

            {/* KOTIJOUKKUE */}
            <div className="compact-team-row" style={{ marginBottom: '6px', display: 'flex', alignItems: 'center' }}>
                <button 
                    className={`fav-sydan ${isFavHome ? 'aktiivinen' : ''}`} 
                    onClick={(e) => { e.stopPropagation(); toggleFavTeam(homeAbbrev); }}
                    style={{ padding: '0 4px 0 0', margin: 0, fontSize: '1.2rem' }}
                >
                    {isFavHome ? '♥' : '♡'}
                </button>

                {/* TURVALLINEN LOGO */}
                <TeamBadge abbrev={homeAbbrev} size={24} style={{ marginRight: '6px' }} />
                
                <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '4px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>{homeAbbrev}</span>
                    <span style={{ fontSize: '0.6rem', color: '#666', fontWeight: 'normal' }}>{t.gcHome || '(KOTI)'}</span>
                </div>
                
                <span className="compact-score" style={{ fontSize: '1.3rem', marginLeft: '4px' }}>{game.homeTeam.score !== undefined ? game.homeTeam.score : '-'}</span>
            </div>

            {/* VIERASJOUKKUE */}
            <div className="compact-team-row" style={{ display: 'flex', alignItems: 'center' }}>
                <button 
                    className={`fav-sydan ${isFavAway ? 'aktiivinen' : ''}`} 
                    onClick={(e) => { e.stopPropagation(); toggleFavTeam(awayAbbrev); }}
                    style={{ padding: '0 4px 0 0', margin: 0, fontSize: '1.2rem' }}
                >
                    {isFavAway ? '♥' : '♡'}
                </button>

                {/* TURVALLINEN LOGO */}
                <TeamBadge abbrev={awayAbbrev} size={24} style={{ marginRight: '6px' }} />
                
                <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '4px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>{awayAbbrev}</span>
                    <span style={{ fontSize: '0.6rem', color: '#666', fontWeight: 'normal' }}>{t.gcAway || '(VIERAS)'}</span>
                </div>

                <span className="compact-score" style={{ fontSize: '1.3rem', marginLeft: '4px' }}>{game.awayTeam.score !== undefined ? game.awayTeam.score : '-'}</span>
            </div>
        </div>
    );
};

export default GameCard;