import React from 'react';

const LiigaGameCard = ({ game, onClick, favTeams }) => {
    if (!game || !game.homeTeam || !game.awayTeam) return null;

    const away = game.awayTeam;
    const home = game.homeTeam;

    // POMMINVARMA SUOSIKKITUTKA (Totesit juuri, että tämä toimii!)
    const isFavMatch = (rawName, teamId) => {
        if (!favTeams || !Array.isArray(favTeams)) return false;
        
        let n = String(rawName || '').toUpperCase().trim();
        let id = String(teamId || '').toUpperCase().trim();
        
        if (n.includes(':')) n = n.split(':').pop().trim();
        if (id.includes(':')) id = id.split(':').pop().trim();
        
        const map = {
            "KAL": "KALPA", "TAP": "TAPPARA", "KOO": "KOOKOO", "LUK": "LUKKO",
            "JUK": "JUKURIT", "ILV": "ILVES", "PEL": "PELICANS", "SAI": "SAIPA",
            "SPO": "SPORT", "ÄSS": "ÄSSÄT", "KÄR": "KÄRPÄT", "K-ESPOO": "KIEKKO-ESPOO", 
            "HIFK": "HIFK", "HPK": "HPK", "JYP": "JYP", "TPS": "TPS"
        };
        
        const normName = map[n] || n;
        const normId = map[id] || id;

        return favTeams.some(fav => {
            let f = String(fav).toUpperCase().trim();
            const normFav = map[f] || f;
            return (
                (normName && (normName === normFav || normName.includes(normFav) || normFav.includes(normName))) ||
                (normId && (normId === normFav || normId.includes(normFav) || normFav.includes(normId)))
            );
        });
    };

    const isFavHome = isFavMatch(home.teamName, home.teamId);
    const isFavAway = isFavMatch(away.teamName, away.teamId);
    const isFav = isFavHome || isFavAway;

    const formatName = (rawName, tId) => {
        let s = String(rawName || tId || '').toUpperCase().trim();
        if (s.includes(':')) s = s.split(':').pop().trim();
        const map = { "KAL": "KALPA", "TAP": "TAPPARA", "KOO": "KOOKOO", "LUK": "LUKKO", "JUK": "JUKURIT", "ILV": "ILVES", "PEL": "PELICANS", "SAI": "SAIPA", "SPO": "SPORT", "ÄSS": "ÄSSÄT", "KÄR": "KÄRPÄT", "K-ESPOO": "KIEKKO-ESPOO" };
        return map[s] || s;
    };

    const homeName = formatName(home.teamName, home.teamId);
    const awayName = formatName(away.teamName, away.teamId);

    let statusText = "TULOSSA";
    let isLive = false;

    if (game.ended) {
        statusText = "LOPPUTULOS";
        if (game.finishedType === "ENDED_DURING_EXTENDED_GAME_TIME") statusText = "LOPPUTULOS (JA)";
        if (game.finishedType === "ENDED_DURING_WINNING_SHOT_COMPETITION") statusText = "LOPPUTULOS (VL)";
    } else if (game.started && !game.ended) {
        isLive = true;
        const m = Math.floor(game.gameTime / 60);
        const s = game.gameTime % 60;
        const timeStr = `${m}:${s < 10 ? '0' : ''}${s}`;
        statusText = `🔴 ${game.currentPeriod}. ERÄ - ${timeStr}`;
    } else {
        const startTime = new Date(game.start).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
        statusText = `ALKAA ${startTime}`;
    }

    return (
        <div 
            className={`game-card ${isLive && !isFav ? 'live liiga-card-border' : ''}`} 
            onClick={onClick} 
            style={{
                cursor: 'pointer', 
                padding: '10px 8px',
                borderRadius: '8px',
                marginBottom: '10px',
                background: '#111',
                transition: 'transform 0.2s',
                // CSS HACK: Outline ja tärkeät borderit varmistavat kultareunat riippumatta global.css tiedostosta!
                outline: isFav ? '2px solid #ffd700' : 'none',
                outlineOffset: '-2px',
                borderColor: isFav ? '#ffd700' : '#333',
                boxShadow: isFav ? '0 0 15px rgba(255, 215, 0, 0.4)' : 'none'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
            <div className="compact-header">
                <span className={`compact-status ${isLive ? 'liiga-text-orange' : ''}`} style={isLive ? { animation: 'pulse 2s infinite' } : {}}>
                    {statusText}
                </span>
            </div>

            {/* KOTIJOUKKUE */}
            <div className="compact-team-row">
                <img src={home.logos?.lightBg || home.logos?.darkBg} className="compact-logo" style={{ width: '24px', height: '24px', marginLeft: '4px', objectFit: 'contain' }} alt={homeName} />
                <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '4px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    <span className="compact-name" style={{ color: isFavHome ? '#ffd700' : '#fff', textShadow: isFavHome ? '0 0 8px rgba(255,215,0,0.5)' : 'none' }}>
                        {homeName}
                    </span>
                    <span style={{ fontSize: '0.6rem', color: '#666' }}>(🏠)</span>
                </div>
                <span className="compact-score" style={{ fontWeight: 'bold' }}>{game.started ? home.goals : '-'}</span>
            </div>

            {/* VIERASJOUKKUE */}
            <div className="compact-team-row" style={{ marginTop: '8px' }}>
                <img src={away.logos?.lightBg || away.logos?.darkBg} className="compact-logo" style={{ width: '24px', height: '24px', marginLeft: '4px', objectFit: 'contain' }} alt={awayName} />
                <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '4px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    <span className="compact-name" style={{ color: isFavAway ? '#ffd700' : '#fff', textShadow: isFavAway ? '0 0 8px rgba(255,215,0,0.5)' : 'none' }}>
                        {awayName}
                    </span>
                    <span style={{ fontSize: '0.6rem', color: '#666' }}>(🚌)</span>
                </div>
                <span className="compact-score" style={{ fontWeight: 'bold' }}>{game.started ? away.goals : '-'}</span>
            </div>

        </div>
    );
};

export default LiigaGameCard;