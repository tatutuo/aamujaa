import React, { useState } from 'react';
import { translations } from '../utils/translations';

const FeedbackModal = ({ isOpen, onClose, language }) => {
    const t = translations[language] || translations.fi;

    const [lahettaja, setLahettaja] = useState('');
    const [viesti, setViesti] = useState('');
    const [statusText, setStatusText] = useState('');
    const [statusType, setStatusType] = useState(''); 
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault(); 
        
        if (!viesti.trim()) {
            setStatusText(t.fbErrEmpty);
            setStatusType('error');
            return;
        }

        setIsSubmitting(true);
        setStatusText(t.fbSending);
        setStatusType(''); 

        try {
            const response = await fetch('/api/palaute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ viesti, lahettaja })
            });

            const data = await response.json();

            if (data.status === "ok") {
                setStatusText(t.fbSuccess);
                setStatusType('success');
                setViesti(''); 
                setLahettaja('');
                
                setTimeout(() => {
                    setStatusText('');
                    onClose(); 
                }, 2000);
            } else {
                throw new Error(data.error || 'Tuntematon virhe');
            }
        } catch (error) {
            console.error("Palautteen lähetysvirhe:", error);
            setStatusText(t.fbErrSend);
            setStatusType('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setStatusText('');
        setViesti('');
        setLahettaja('');
        onClose();
    };

    return (
        <div className="modal-overlay" style={{ display: 'block', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 99999 }}>
            <div className="modal-content" style={{ background: '#1a1a1a', margin: '10% auto', padding: '20px', width: '90%', maxWidth: '500px', borderRadius: '15px', border: '1px solid #444', position: 'relative' }}>
                <span onClick={handleClose} style={{ position: 'absolute', right: '15px', top: '10px', fontSize: '2rem', cursor: 'pointer', color: '#888' }}>&times;</span>
                <h2 style={{ color: '#00d4ff', fontFamily: "'Teko', sans-serif", fontSize: '2rem', marginTop: 0 }}>
                    {t.fbTitle}
                </h2>
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <input 
                        type="text" 
                        placeholder={t.fbNamePh} 
                        value={lahettaja}
                        onChange={(e) => setLahettaja(e.target.value)}
                        disabled={isSubmitting}
                        style={{ padding: '10px', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '5px' }} 
                    />
                    
                    <textarea 
                        rows="5" 
                        placeholder={t.fbMsgPh} 
                        value={viesti}
                        onChange={(e) => setViesti(e.target.value)}
                        disabled={isSubmitting}
                        style={{ padding: '10px', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '5px', resize: 'vertical' }}
                    ></textarea>
                    
                    {statusText && (
                        <div style={{ color: statusType === 'success' ? '#4ade80' : '#ff4444', textAlign: 'center', fontWeight: 'bold' }}>
                            {statusText}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={isSubmitting} 
                        style={{ 
                            background: isSubmitting ? '#555' : '#00d4ff', 
                            color: '#000', padding: '12px', border: 'none', borderRadius: '5px', 
                            fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            transition: 'background 0.2s'
                        }}
                    >
                        {isSubmitting ? t.fbBtnSending : t.fbBtnSend}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default FeedbackModal;