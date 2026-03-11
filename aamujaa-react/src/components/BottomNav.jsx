import React from 'react';
import { translations } from '../utils/translations';

const BottomNav = ({ currentView, setCurrentView, language }) => {
    const t = translations[language] || translations.fi;

    return (
        <nav className="bottom-nav">
            <button 
                className={`nav-item ${currentView === 'home' ? 'active' : ''}`} 
                onClick={() => setCurrentView('home')}
            >
                <span className="nav-icon">🏠</span>
                <span className="nav-label">{t.navHome}</span>
            </button>

            <button 
                className={`nav-item ${currentView === 'calendar' ? 'active' : ''}`} 
                onClick={() => setCurrentView('calendar')}
            >
                <span className="nav-icon">📅</span>
                <span className="nav-label">{t.navCalendar}</span>
            </button>

            <button 
                className={`nav-item ${currentView === 'standings' ? 'active' : ''}`} 
                onClick={() => setCurrentView('standings')}
            >
                <span className="nav-icon">🏆</span>
                <span className="nav-label">{t.navStandings}</span>
            </button>

            <button 
                className={`nav-item ${currentView === 'stats' ? 'active' : ''}`} 
                onClick={() => setCurrentView('stats')}
            >
                <span className="nav-icon">📊</span>
                <span className="nav-label">{t.navStats}</span>
            </button>
        </nav>
    );
};

export default BottomNav;