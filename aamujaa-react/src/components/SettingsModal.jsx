import React from 'react';

const SettingsModal = ({ isOpen, onClose, onChangeModal, currentTheme, onToggleTheme, language, setLanguage }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{ display: 'block', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 99999 }}>
            <div className="modal-content" style={{ margin: '20% auto', padding: '20px', width: '90%', maxWidth: '400px', position: 'relative' }}>
                
                <span onClick={onClose} style={{ position: 'absolute', right: '15px', top: '10px', fontSize: '2rem', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</span>
                <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                    ⚙️ {language === 'fi' ? 'Asetukset' : 'Settings'}
                </h2>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    
                    {/* KIELI / LANGUAGE KYTKIN */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Kieli / Language</span>
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <button 
                                onClick={() => setLanguage('fi')}
                                className={`lang-btn ${language === 'fi' ? 'active' : ''}`} 
                                style={{ fontSize: '1.8rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, filter: language === 'fi' ? 'none' : 'grayscale(0.8)' }}
                            >
                                🇫🇮
                            </button>
                            <button 
                                onClick={() => setLanguage('en')}
                                className={`lang-btn ${language === 'en' ? 'active' : ''}`} 
                                style={{ fontSize: '1.8rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, filter: language === 'en' ? 'none' : 'grayscale(0.8)' }}
                            >
                                🇬🇧
                            </button>
                        </div>
                    </div>

                    {/* TEEMAKYTKIN */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Teema / Theme</span>
                        <button 
                            onClick={onToggleTheme}
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            {currentTheme === 'dark' 
                                ? (language === 'fi' ? '☀️ Vaalea' : '☀️ Light') 
                                : (language === 'fi' ? '🌙 Tumma' : '🌙 Dark')}
                        </button>
                    </div>
                    
                    <button onClick={() => onChangeModal('updates')} style={{ textAlign: 'left', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: '#ffcc00', padding: '15px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' }}>
                        📢 {language === 'fi' ? 'Päivitykset & Uutiset' : 'Updates & News'}
                    </button>
                    
                    <button onClick={() => onChangeModal('info')} style={{ textAlign: 'left', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: '#00d4ff', padding: '15px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' }}>
                        ℹ️ {language === 'fi' ? 'Tietoa sovelluksesta' : 'About the app'}
                    </button>
                    
                    <button onClick={() => onChangeModal('feedback')} style={{ textAlign: 'left', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: '#4ade80', padding: '15px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' }}>
                        📮 {language === 'fi' ? 'Lähetä palautetta' : 'Send feedback'}
                    </button>

                </div>
            </div>
        </div>
    );
};

export default SettingsModal;