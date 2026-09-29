import React from 'react';
import { translations } from '../utils/translations';
import Sheet from './Sheet';

const NOTE_KEYS = ['updNote1', 'updNote2', 'updNote3', 'updNote4', 'updNote5'];

const UpdatesModal = ({ isOpen, onClose, language, zIndex = 99000 }) => {
    const t = translations[language] || translations.fi;

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            zIndex={zIndex}
            accent="var(--gold)"
            title={t.updTitle}
            subtitle={t.updVersion2 || 'Versio 2.0'}
        >
            <ul className="update-list">
                {NOTE_KEYS.map((key) => t[key] && <li key={key}>{t[key]}</li>)}
            </ul>
        </Sheet>
    );
};

export default UpdatesModal;
