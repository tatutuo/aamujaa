import React, { useState, useEffect } from 'react';

const LiigaPlayerCard = ({ isOpen, onClose, playerId, favPlayers, toggleFavPlayer }) => {
    const [playerData, setPlayerData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !playerId) return;
        setIsLoading(true);

        fetch('/api/liiga/players')
            .then(res => res.json())
            .then(data => {
                const found = data.find(p => String(p.id) === String(playerId));
                setPlayerData(found || null);
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Liigan pelaajadataa ei saatu", err);
                setIsLoading(false);
            });
    }, [isOpen, playerId]);

    if (!isOpen) return null;

    const isFav = favPlayers?.includes(playerId);

    return (
        <div className="modal-overlay" style={{ display: 'block', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 99999 }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ margin: '15% auto', width: '90%', maxWidth: '300px', background: '#111', borderRadius: '12px', border: '1px solid #ff6600', position: 'relative', overflow: 'hidden' }}>
                
                <span onClick={onClose} style={{ position: 'absolute', right: '15px', top: '5px', fontSize: '2.5rem', cursor: 'pointer', color: '#888', zIndex: 2, lineHeight: 1 }}>&times;</span>
                
                <button 
                    onClick={() => toggleFavPlayer(playerId)}
                    style={{ position: 'absolute', left: '15px', top: '10px', fontSize: '1.8rem', background: 'none', border: 'none', cursor: 'pointer', color: isFav ? '#ff4444' : '#555', zIndex: 2 }}
                >
                    {isFav ? '♥' : '♡'}
                </button>

                <div style={{ background: 'linear-gradient(135deg, #2a1100, #111)', padding: '35px 20px 20px 20px', borderBottom: '2px solid #ff6600', textAlign: 'center' }}>
                    {isLoading ? (
                        <div style={{ color: '#ff6600', animation: 'pulse 1s infinite' }}>Ladataan dataa...</div>
                    ) : playerData ? (
                        <>
                            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🛡️</div>
                            <h2 style={{ margin: 0, color: '#fff', fontSize: '1.6rem', letterSpacing: '1px' }}>
                                {playerData.firstName} {playerData.lastName}
                            </h2>
                            <div style={{ color: '#ff6600', fontWeight: 'bold', letterSpacing: '2px', fontSize: '0.9rem', marginTop: '5px', textTransform: 'uppercase' }}>
                                {playerData.teamId || "LIIGA"}
                            </div>
                        </>
                    ) : (
                        <div style={{ color: '#888' }}>Pelaajaa ei löytynyt.</div>
                    )}
                </div>

                {playerData && !isLoading && (
                    <div style={{ padding: '20px' }}>
                        <h4 style={{ color: '#888', textAlign: 'center', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '15px', letterSpacing: '1px' }}>
                            Runkosarja {new Date().getFullYear()}
                        </h4>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <StatBox label="MAALIT" val={playerData.goals || 0} />
                            <StatBox label="SYÖTÖT" val={playerData.assists || 0} />
                        </div>
                        <div style={{ marginTop: '10px' }}>
                            <StatBox label="KOKONAISPISTEET" val={playerData.points || 0} valColor="#ff6600" bg="#1a1a1a" size="large" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const StatBox = ({ label, val, valColor = '#fff', bg = '#151515', size = 'normal' }) => (
    <div style={{ background: bg, borderRadius: '6px', padding: '12px', textAlign: 'center', border: '1px solid #333' }}>
        <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '5px', letterSpacing: '1px' }}>{label}</div>
        <div style={{ fontSize: size === 'large' ? '1.8rem' : '1.3rem', fontWeight: 'bold', color: valColor }}>{val}</div>
    </div>
);

export default LiigaPlayerCard;