import React, { useState } from 'react';
import { translations } from '../utils/translations';

const InfoModal = ({ isOpen, onClose, language }) => {
    const [showGuide, setShowGuide] = useState(false);

    if (!isOpen) return null;
    const t = translations[language] || translations.fi;

    return (
        <div className="modal-overlay" style={{ display: 'block', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 99999 }}>
            <div className="modal-content" style={{ 
                background: '#1a1a1a', 
                margin: '10% auto', 
                padding: '20px', 
                width: '90%', 
                maxWidth: '450px', 
                borderRadius: '12px', 
                border: '1px solid #00d4ff', 
                position: 'relative',
                maxHeight: '80vh', 
                overflowY: 'auto' 
            }}>
                <span onClick={() => { onClose(); setShowGuide(false); }} style={{ position: 'absolute', right: '15px', top: '10px', fontSize: '2rem', cursor: 'pointer', color: '#888', zIndex: 10 }}>&times;</span>
                
                <h2 style={{ color: '#00d4ff', marginTop: 0, marginBottom: '20px', fontSize: '1.2rem', borderBottom: '1px solid #333', paddingBottom: '10px', paddingRight: '20px' }}>
                    {t.infoTitle}
                </h2>
                
                <div style={{ color: '#ccc', fontSize: '0.95rem', lineHeight: 1.5 }}>
                    <p>{t.infoLine1}</p>
                    <p>{t.infoLine2}</p>
                    
                    {/* Käyttöohjeet-nappi */}
                    <button 
                        onClick={() => setShowGuide(!showGuide)}
                        style={{
                            width: '100%',
                            padding: '12px',
                            marginTop: '15px',
                            background: showGuide ? '#00d4ff' : '#222',
                            color: showGuide ? '#000' : '#00d4ff',
                            border: '1px solid #00d4ff',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontSize: '1rem'
                        }}
                    >
                        {t.guideBtn || "📖 KÄYTTÖOHJEET"}
                    </button>

                    {/* Laajentuva ohjeosio */}
                    {showGuide && (
                        <div style={{ marginTop: '15px', animation: 'fadeIn 0.3s', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #ff4444' }}>
                                <h4 style={{ margin: '0 0 5px 0', color: '#fff' }}>{t.guideHomeTitle}</h4>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#aaa' }}>{t.guideHomeText}</p>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #00d4ff' }}>
                                <h4 style={{ margin: '0 0 5px 0', color: '#fff' }}>{t.guideStatsTitle}</h4>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#aaa' }}>{t.guideStatsText}</p>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #4ade80' }}>
                                <h4 style={{ margin: '0 0 5px 0', color: '#fff' }}>{t.guideStandingsTitle}</h4>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#aaa' }}>{t.guideStandingsText}</p>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #ffcc00' }}>
                                <h4 style={{ margin: '0 0 5px 0', color: '#fff' }}>{t.guideCalendarTitle}</h4>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#aaa' }}>{t.guideCalendarText}</p>
                            </div>

                        </div>
                    )}
                    
                    <div style={{ marginTop: '25px', padding: '15px', background: '#000', borderRadius: '8px', textAlign: 'center' }}>
                        <p style={{ marginTop: 0, color: '#fff', fontWeight: 'bold' }}>{t.infoDev}</p>
                        <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>{t.infoThanks}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InfoModal;