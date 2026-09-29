import React from 'react';
import { translations } from '../utils/translations';

const VIEWS = [
    { id: 'home', icon: '🏠', labelKey: 'navHome' },
    { id: 'calendar', icon: '📅', labelKey: 'navCalendar' },
    { id: 'standings', icon: '🏆', labelKey: 'navStandings' },
    { id: 'stats', icon: '📊', labelKey: 'navStats' },
];

const BottomNav = ({ currentView, setCurrentView, language }) => {
    const t = translations[language] || translations.fi;

    return (
        <nav className="bottom-nav" aria-label={language === 'fi' ? 'Päänavigaatio' : 'Main navigation'}>
            {VIEWS.map(({ id, icon, labelKey }) => (
                <button
                    key={id}
                    type="button"
                    className={`nav-item ${currentView === id ? 'active' : ''}`}
                    onClick={() => setCurrentView(id)}
                    // Teksti voi olla piilotettu kapealla näytöllä, joten
                    // ruudunlukija tarvitsee nimen erikseen.
                    aria-label={t[labelKey]}
                    aria-current={currentView === id ? 'page' : undefined}
                >
                    <span className="nav-icon" aria-hidden="true">{icon}</span>
                    <span className="nav-label">{t[labelKey]}</span>
                </button>
            ))}
        </nav>
    );
};

export default BottomNav;
