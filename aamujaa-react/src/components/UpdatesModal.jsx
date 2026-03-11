import React from 'react';
import { translations } from '../utils/translations';

const UpdatesModal = ({ isOpen, onClose, language }) => {
    if (!isOpen) return null;
    const t = translations[language] || translations.fi;

    return (
        <div className="modal-overlay" style={{ display: 'block', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 99999 }}>
            <div className="modal-content" style={{ background: '#1a1a1a', margin: '20% auto', padding: '20px', width: '90%', maxWidth: '450px', borderRadius: '12px', border: '1px solid #ffcc00', position: 'relative', maxHeight: '70vh', overflowY: 'auto' }}>
                <span onClick={onClose} style={{ position: 'absolute', right: '15px', top: '10px', fontSize: '2rem', cursor: 'pointer', color: '#888' }}>&times;</span>
                <h2 style={{ color: '#ffcc00', marginTop: 0, marginBottom: '20px', fontSize: '1.2rem', borderBottom: '1px solid #333', paddingBottom: '10px' }}>{t.updTitle}</h2>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', color: '#ccc', fontSize: '0.95rem' }}>
                    <div style={{ background: '#000', padding: '15px', borderRadius: '8px', borderLeft: '3px solid #ffcc00' }}>
                        <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: '10px', fontSize: '1.1rem' }}>
                            {t.updVersion2 || "Versio 2.0"}
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '20px', color: '#aaa', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <li>{t.updNote1}</li>
                            <li>{t.updNote2}</li>
                            <li>{t.updNote3}</li>
                            <li>{t.updNote4}</li>
                            <li>{t.updNote5}</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UpdatesModal;