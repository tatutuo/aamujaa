import React from 'react';
import Sheet from './Sheet';

const SettingsModal = ({ isOpen, onClose, onChangeModal, currentTheme, onToggleTheme, language, setLanguage, zIndex = 99000 }) => {
    const isFi = language === 'fi';
    const isDark = currentTheme === 'dark';

    const links = [
        { id: 'updates', icon: '📢', label: isFi ? 'Päivitykset' : 'Updates', tone: 'gold' },
        { id: 'info', icon: 'ℹ️', label: isFi ? 'Tietoa sovelluksesta' : 'About the app', tone: 'accent' },
        { id: 'feedback', icon: '📮', label: isFi ? 'Lähetä palautetta' : 'Send feedback', tone: 'positive' },
    ];

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            zIndex={zIndex}
            title={isFi ? 'Asetukset' : 'Settings'}
        >
            <div className="settings-row">
                <span className="settings-label">{isFi ? 'Kieli' : 'Language'}</span>
                <div className="segmented">
                    <button
                        type="button"
                        className={`segmented-btn ${isFi ? 'active' : ''}`}
                        onClick={() => setLanguage('fi')}
                        aria-pressed={isFi}
                    >
                        🇫🇮 Suomi
                    </button>
                    <button
                        type="button"
                        className={`segmented-btn ${!isFi ? 'active' : ''}`}
                        onClick={() => setLanguage('en')}
                        aria-pressed={!isFi}
                    >
                        🇬🇧 English
                    </button>
                </div>
            </div>

            <div className="settings-row">
                <span className="settings-label">{isFi ? 'Teema' : 'Theme'}</span>
                <div className="segmented">
                    <button
                        type="button"
                        className={`segmented-btn ${isDark ? 'active' : ''}`}
                        onClick={() => !isDark && onToggleTheme()}
                        aria-pressed={isDark}
                    >
                        🌙 {isFi ? 'Tumma' : 'Dark'}
                    </button>
                    <button
                        type="button"
                        className={`segmented-btn ${!isDark ? 'active' : ''}`}
                        onClick={() => isDark && onToggleTheme()}
                        aria-pressed={!isDark}
                    >
                        ☀️ {isFi ? 'Vaalea' : 'Light'}
                    </button>
                </div>
            </div>

            <nav className="settings-links">
                {links.map(({ id, icon, label, tone }) => (
                    <button
                        key={id}
                        type="button"
                        className={`settings-link settings-link-${tone}`}
                        onClick={() => onChangeModal(id)}
                    >
                        <span className="settings-link-icon" aria-hidden="true">{icon}</span>
                        <span>{label}</span>
                        <span className="settings-link-chevron" aria-hidden="true">›</span>
                    </button>
                ))}
            </nav>
        </Sheet>
    );
};

export default SettingsModal;
