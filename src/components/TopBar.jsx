import React from 'react';

const TopBar = ({ onOpenSettings, onOpenSearch, language }) => {
    const isFi = language === 'fi';

    return (
        <header className="header-bar">
            <div className="header-brand">
                <img src="./icon-512.png" alt="" className="header-logo" width="38" height="38" />
                <span className="header-title">
                    <span className="header-wordmark">Aamujää</span>
                    <span className="header-subtitle">NHL</span>
                </span>
            </div>

            <div className="header-controls">
                <button
                    type="button"
                    className="top-icon-btn"
                    onClick={onOpenSearch}
                    aria-label={isFi ? 'Hae pelaajaa tai joukkuetta' : 'Search players and teams'}
                >
                    🔍
                </button>
                <button
                    type="button"
                    className="top-icon-btn"
                    onClick={onOpenSettings}
                    aria-label={isFi ? 'Asetukset' : 'Settings'}
                >
                    ⚙️
                </button>
            </div>
        </header>
    );
};

export default TopBar;
