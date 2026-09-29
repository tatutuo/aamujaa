import React from 'react';
import { translations } from '../utils/translations';

/**
 * Tilastovalikko.
 *
 * Napit ovat nyt yhtenäisiä kortteja CSS-luokilla. Aiemmin jokainen nappi oli
 * oma inline-tyyliviritelmänsä, ja "Kristallipallo" oli lisäksi kokonaan eri
 * näköinen violetilla liukuvärillä ja omilla hover-käsittelijöillään.
 */
const StatsPage = ({ onOpenTeletext, language }) => {
    const t = translations[language] || translations.fi;

    const primary = [
        { id: 'all', icon: '🏆', label: t.statsPoints },
        { id: 'finns', icon: language === 'fi' ? '🇫🇮' : '🇪🇺', label: t.statsFinns },
        { id: 'goals', icon: '🚨', label: t.statsGoals },
        { id: 'assists', icon: '🏒', label: t.statsAssists },
    ];

    const secondary = [
        { id: 'penaltyMinutes', icon: '🥊', label: t.statsPenalties },
        { id: 'plusMinus', icon: '⚖️', label: t.statsPlusMinus },
        { id: 'timeOnIcePerGame', icon: '⏱️', label: t.statsTOI },
    ];

    const renderTile = ({ id, icon, label }, featured = false) => (
        <button
            key={id}
            type="button"
            className={`stat-tile ${featured ? 'is-featured' : ''}`}
            onClick={() => onOpenTeletext(id)}
        >
            <span className="stat-tile-icon" aria-hidden="true">{icon}</span>
            <span className="stat-tile-label">{label}</span>
        </button>
    );

    return (
        <div className="container">
            <h2 className="page-title">{t.statsTitle}</h2>

            <div className="stat-grid">
                {primary.map((item) => renderTile(item))}
            </div>

            <h3 className="section-title">{t.statsSpecial}</h3>

            <div className="stat-grid">
                {renderTile({ id: 'ai_predictions', icon: '🔮', label: t.statsAi }, true)}
                {renderTile({
                    id: 'advanced',
                    icon: '📐',
                    label: language === 'fi' ? 'Edistyneet' : 'Advanced',
                })}
                {secondary.map((item) => renderTile(item))}
            </div>
        </div>
    );
};

export default StatsPage;
