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
                
                {/* TYYLITELLTY NHL-TEKSTILOGO CSS:LLÄ */}
                <div 
                    onClick={() => setActiveLeague('NHL')}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: '900', fontStyle: 'italic', fontFamily: 'Impact, sans-serif', fontSize: '1.2rem',
                        padding: '2px 10px', borderRadius: '4px',
                        background: 'linear-gradient(135deg, #2a2a2a, #000)',
                        border: '2px solid #555',
                        color: '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', 
                        boxShadow: activeLeague === 'NHL' ? '0px 0px 12px rgba(0, 212, 255, 0.6)' : 'none',
                        borderColor: activeLeague === 'NHL' ? 'rgba(0, 212, 255, 0.8)' : '#333',
                        opacity: activeLeague === 'NHL' ? 1 : 0.4,
                        transform: activeLeague === 'NHL' ? 'scale(1.1)' : 'scale(0.85)',
                        pointerEvents: activeLeague === 'NHL' ? 'none' : 'auto' 
                    }}
                >
                    NHL
                </div>

                {/* TYYLITELLTY LIIGA-TEKSTILOGO CSS:LLÄ */}
                <div 
                    onClick={() => setActiveLeague('LIIGA')}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: '900', fontFamily: 'Arial, sans-serif', fontSize: '1.1rem', letterSpacing: '1px',
                        padding: '4px 10px', borderRadius: '4px',
                        background: 'linear-gradient(135deg, #2a2a2a, #000)',
                        border: '2px solid #555',
                        color: '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        boxShadow: activeLeague === 'LIIGA' ? '0px 0px 12px rgba(255, 102, 0, 0.8)' : 'none',
                        borderColor: activeLeague === 'LIIGA' ? 'rgba(255, 102, 0, 0.8)' : '#333',
                        opacity: activeLeague === 'LIIGA' ? 1 : 0.4,
                        transform: activeLeague === 'LIIGA' ? 'scale(1.15)' : 'scale(0.9)',
                        pointerEvents: activeLeague === 'LIIGA' ? 'none' : 'auto'
                    }}
                >
                    LIIGA
                </div>

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