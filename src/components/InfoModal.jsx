import React, { useState } from 'react';
import { translations } from '../utils/translations';
import Sheet from './Sheet';

const GUIDE_SECTIONS = [
    { titleKey: 'guideHomeTitle', textKey: 'guideHomeText', tone: 'live' },
    { titleKey: 'guideStatsTitle', textKey: 'guideStatsText', tone: 'accent' },
    { titleKey: 'guideStandingsTitle', textKey: 'guideStandingsText', tone: 'positive' },
    { titleKey: 'guideCalendarTitle', textKey: 'guideCalendarText', tone: 'gold' },
];

const InfoModal = ({ isOpen, onClose, language, zIndex = 99000 }) => {
    const [showGuide, setShowGuide] = useState(false);
    const t = translations[language] || translations.fi;

    return (
        <Sheet isOpen={isOpen} onClose={onClose} zIndex={zIndex} title={t.infoTitle}>
            <div className="prose">
                <p>{t.infoLine1}</p>
                <p>{t.infoLine2}</p>
            </div>

            <button
                type="button"
                className={`block-btn ${showGuide ? 'active' : ''}`}
                onClick={() => setShowGuide((v) => !v)}
                aria-expanded={showGuide}
            >
                {t.guideBtn || '📖 Käyttöohjeet'}
            </button>

            {showGuide && (
                <div className="guide-list">
                    {GUIDE_SECTIONS.map(({ titleKey, textKey, tone }) => (
                        <section key={titleKey} className={`guide-item guide-${tone}`}>
                            <h4>{t[titleKey]}</h4>
                            <p>{t[textKey]}</p>
                        </section>
                    ))}
                </div>
            )}

            <footer className="info-footer">
                <p className="info-dev">{t.infoDev}</p>
                <p className="info-thanks">{t.infoThanks}</p>
            </footer>
        </Sheet>
    );
};

export default InfoModal;
