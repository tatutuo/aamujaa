import React, { useState } from 'react';
import { translations } from '../utils/translations';
import { api } from '../utils/api';
import Sheet from './Sheet';

const MAX_LENGTH = 2000;

const FeedbackModal = ({ isOpen, onClose, language, zIndex = 99000 }) => {
    const t = translations[language] || translations.fi;

    const [lahettaja, setLahettaja] = useState('');
    const [viesti, setViesti] = useState('');
    const [status, setStatus] = useState(null); // { text, type }
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!viesti.trim()) {
            setStatus({ text: t.fbErrEmpty, type: 'error' });
            return;
        }

        setIsSubmitting(true);
        setStatus({ text: t.fbSending, type: 'info' });

        try {
            await api.sendFeedback(viesti, lahettaja);
            setStatus({ text: t.fbSuccess, type: 'success' });
            setViesti('');
            setLahettaja('');
            setTimeout(() => { setStatus(null); onClose(); }, 1800);
        } catch (error) {
            // Palvelimen viesti kertoo enemmän kuin yleinen virheteksti
            // (esim. liian pitkä viesti tai liikaa lähetyksiä).
            setStatus({ text: error.message || t.fbErrSend, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setStatus(null);
        setViesti('');
        setLahettaja('');
        onClose();
    };

    return (
        <Sheet
            isOpen={isOpen}
            onClose={handleClose}
            zIndex={zIndex}
            accent="var(--positive)"
            title={t.fbTitle}
        >
            <form className="form" onSubmit={handleSubmit}>
                <label className="field">
                    <span className="field-label">{language === 'fi' ? 'Nimi tai sähköposti' : 'Name or email'}</span>
                    <input
                        type="text"
                        className="field-input"
                        placeholder={t.fbNamePh}
                        value={lahettaja}
                        onChange={(e) => setLahettaja(e.target.value)}
                        disabled={isSubmitting}
                    />
                </label>

                <label className="field">
                    <span className="field-label">
                        {language === 'fi' ? 'Viesti' : 'Message'}
                        <span className="field-count">{viesti.length}/{MAX_LENGTH}</span>
                    </span>
                    <textarea
                        rows="6"
                        className="field-input field-textarea"
                        placeholder={t.fbMsgPh}
                        value={viesti}
                        maxLength={MAX_LENGTH}
                        onChange={(e) => setViesti(e.target.value)}
                        disabled={isSubmitting}
                    />
                </label>

                {status && (
                    <p className={`form-status is-${status.type}`} role="status">
                        {status.text}
                    </p>
                )}

                <button type="submit" className="primary-btn" disabled={isSubmitting}>
                    {isSubmitting ? t.fbBtnSending : t.fbBtnSend}
                </button>
            </form>
        </Sheet>
    );
};

export default FeedbackModal;
