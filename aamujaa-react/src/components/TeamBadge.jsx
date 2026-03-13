import React from 'react';

// Viedään värit myös exportilla, jos satut tarvitsemaan niitä muualla!
export const teamColors = {
    // NHL
    BOS: '#FFB81C', BUF: '#002654', DET: '#CE1126', FLA: '#C8102E',
    MTL: '#AF1E2D', OTT: '#C52032', TBL: '#002868', TOR: '#00205B',
    CAR: '#CE1126', CBJ: '#002654', NJD: '#CE1126', NYI: '#00539B',
    NYR: '#0038A8', PHI: '#F74902', PIT: '#FCB514', WSH: '#041E42',
    CHI: '#CF0A2C', COL: '#6F263D', DAL: '#006847', MIN: '#154734',
    NSH: '#FFB81C', STL: '#002F87', WPG: '#041E42', UTA: '#01265b',
    ANA: '#F47A38', CGY: '#C8102E', EDM: '#FF4C00', LAK: '#111111',
    SJS: '#006D75', SEA: '#001628', VAN: '#00205B', VGK: '#B4975A',
    
    // LIIGA (Tukee sekä koko nimeä että lyhennettä)
    'HIFK': '#E60000', 'HPK': '#F58220', 'ILVES': '#00A650', 'ILV': '#00A650',
    'JUKURIT': '#003366', 'JUK': '#003366', 'JYP': '#E31837', 'KALPA': '#FFB81C', 
    'KAL': '#FFB81C', 'KIEKKO-ESPOO': '#0033A0', 'K-ESPOO': '#0033A0', 
    'KOOKOO': '#F37021', 'KOO': '#F37021', 'KÄRPÄT': '#FADB00', 'KÄR': '#FADB00',
    'LUKKO': '#0055A5', 'LUK': '#0055A5', 'PELICANS': '#00C1D5', 'PEL': '#00C1D5',
    'SAIPA': '#FFD700', 'SAI': '#FFD700', 'SPORT': '#ED1C24', 'SPO': '#ED1C24',
    'TAPPARA': '#FF6600', 'TAP': '#FF6600', 'TPS': '#000000', 'ÄSSÄT': '#E31837', 'ÄSS': '#E31837'
};

const TeamBadge = ({ abbrev, className, onClick, size = 40, style = {} }) => {
    const bgColor = teamColors[abbrev] || '#444'; 
    return (
        <div 
            className={className}
            onClick={onClick}
            title={abbrev}
            style={{
                backgroundColor: bgColor,
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                fontWeight: 'bold',
                cursor: onClick ? 'pointer' : 'default',
                border: '2px solid rgba(255,255,255,0.2)',
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                width: `${size}px`,
                height: `${size}px`,
                fontSize: `${Math.max(10, size / 2.5)}px`, // Skaalaa tekstin koon automaattisesti!
                flexShrink: 0,
                ...style // Sallii ylimääräisten tyylien (kuten marginaalien) antamisen
            }}
        >
            {abbrev}
        </div>
    );
};

export default TeamBadge;