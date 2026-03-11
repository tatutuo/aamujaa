import React from 'react';

const TopBar = ({ onOpenSettings, onOpenSearch, activeLeague, setActiveLeague }) => {
    return (
        <header className="header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            
            {/* 1. OMA LOGO */}
            <div className="logo-area" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img 
                    src="./icon-512.png" 
                    alt="Aamujää Logo" 
                    style={{ 
                        height: '38px', 
                        width: '38px', 
                        borderRadius: '8px', 
                        objectFit: 'cover',
                        boxShadow: activeLeague === 'LIIGA' ? '0 0 10px #ff6600' : '0 0 10px var(--accent-blue)',
                        transition: 'box-shadow 0.3s ease'
                    }} 
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
                
                {/* NHL LOGO */}
                <img 
                    src="./nhl-logo.png"
                    alt="NHL"
                    onClick={() => setActiveLeague('NHL')}
                    style={{
                        height: '32px', 
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', 
                        filter: activeLeague === 'NHL' ? 'drop-shadow(0px 0px 8px rgba(0, 212, 255, 0.6))' : 'grayscale(1) opacity(0.25)',
                        transform: activeLeague === 'NHL' ? 'scale(1.1)' : 'scale(0.85)',
                        pointerEvents: activeLeague === 'NHL' ? 'none' : 'auto' 
                    }}
                />

                {/* LIIGA LOGO */}
                <img 
                    src="./liiga-logo.png"
                    alt="Liiga"
                    onClick={() => setActiveLeague('LIIGA')}
                    style={{
                        height: '32px', 
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        filter: activeLeague === 'LIIGA' ? 'drop-shadow(0px 0px 8px rgba(255, 102, 0, 0.8))' : 'grayscale(1) brightness(2) opacity(0.3)',
                        transform: activeLeague === 'LIIGA' ? 'scale(1.15)' : 'scale(0.9)',
                        pointerEvents: activeLeague === 'LIIGA' ? 'none' : 'auto'
                    }}
                />

            </div>
            
            {/* 3. KONTROLLIT (Haku ja Asetukset) */}
            <div className="header-controls">
                <button className="top-icon-btn" onClick={onOpenSearch} title="Hae">🔍</button>
                <button className="top-icon-btn" onClick={onOpenSettings} title="Asetukset">⚙️</button>
            </div>
        </header>
    );
};

export default TopBar;