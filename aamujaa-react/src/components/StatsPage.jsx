import React from 'react';
import { translations } from '../utils/translations';

const StatsPage = ({ onOpenTeletext, language }) => {
    const t = translations[language] || translations.fi;

    return (
        <div className="container">
            <h2 className="page-main-title">{t.statsTitle}</h2>
            
            {/* PERUSTILASTOT */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', padding: '5px', marginTop: '10px' }}>
                <button className="porssi-btn" onClick={() => onOpenTeletext('all')}>
                    <span style={{ fontSize: '1.8rem' }}>🏆</span> {t.statsPoints}
                </button>
                <button className="porssi-btn" onClick={() => onOpenTeletext('finns')}>
                    <span style={{ fontSize: '1.8rem' }}>{language === 'fi' ? '🇫🇮' : '🇪🇺'}</span> {t.statsFinns}
                </button>
                <button className="porssi-btn" onClick={() => onOpenTeletext('goals')}>
                    <span style={{ fontSize: '1.8rem' }}>🚨</span> {t.statsGoals}
                </button>
                <button className="porssi-btn" onClick={() => onOpenTeletext('assists')}>
                    <span style={{ fontSize: '1.8rem' }}>🏒</span> {t.statsAssists}
                </button>
            </div>

            {/* ERIKOISTILASTOT */}
            <div style={{ marginTop: '35px' }}>
                <h3 style={{ color: '#aaa', textAlign: 'center', marginBottom: '15px', fontSize: '1rem', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                    {t.statsSpecial}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', padding: '5px' }}>
                    
                    <button 
                        onClick={() => onOpenTeletext('ai_predictions')} 
                        style={{ 
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px',
                            background: 'linear-gradient(135deg, #1a0b2e 0%, #30104a 100%)',
                            border: '1px solid #ffcc00', borderRadius: '12px', padding: '15px', 
                            color: '#fff', cursor: 'pointer',
                            boxShadow: '0 0 10px rgba(255, 204, 0, 0.2)', transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 0 18px rgba(255, 204, 0, 0.5)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 0 10px rgba(255, 204, 0, 0.2)';
                        }}
                    >
                        <span style={{ fontSize: '1.8rem' }}>🔮</span>
                        <span style={{ fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase' }}>{t.statsAi}</span>
                    </button>

                    {/* 2. JÄÄHYT */}
                    <button className="porssi-btn" onClick={() => onOpenTeletext('penaltyMinutes')}>
                        <span style={{ fontSize: '1.8rem' }}>🥊</span> {t.statsPenalties}
                    </button>

                    {/* 3. PLUS/MIINUS */}
                    <button className="porssi-btn" onClick={() => onOpenTeletext('plusMinus')}>
                        <span style={{ fontSize: '1.8rem' }}>⚖️</span> {t.statsPlusMinus}
                    </button>

                    {/* 4. PELIAIKA */}
                    <button className="porssi-btn" onClick={() => onOpenTeletext('timeOnIcePerGame')}>
                        <span style={{ fontSize: '1.8rem' }}>⏱️</span> {t.statsTOI}
                    </button>

                </div>
            </div>

        </div>
    );
};

export default StatsPage;