import React from 'react';
import { teamColors, DEFAULT_TEAM_COLORS } from '../utils/teamColors';

/**
 * Joukkuemerkki ilman tekijänoikeuden alaisia logoja — pelkkä lyhenne joukkueen väreissä.
 *
 * showText={false} piirtää pelkän värillisen merkin. Sitä käytetään paikoissa,
 * joissa lyhenne luetaan jo merkin vieressä (esim. sarjataulukko), jottei sama
 * teksti toistu kahdesti peräkkäin.
 */
const TeamBadge = ({ abbrev, className = '', onClick, size = 40, showText = true, style = {} }) => {
    const [background, borderColor] = teamColors[abbrev] ?? DEFAULT_TEAM_COLORS;

    const badgeStyle = {
        '--badge-size': `${size}px`,
        '--badge-font-size': `${Math.max(10, size / 2.5)}px`,
        backgroundColor: background,
        borderColor,
        ...style,
    };

    const label = showText ? abbrev : '';

    // Klikattava merkki on nappi, ei div — näppäimistö ja ruudunlukija tarvitsevat sen.
    if (onClick) {
        return (
            <button
                type="button"
                className={`team-badge ${className}`}
                onClick={onClick}
                style={badgeStyle}
                aria-label={abbrev}
            >
                {label}
            </button>
        );
    }

    return (
        <span className={`team-badge ${className}`} style={badgeStyle} title={abbrev} aria-label={abbrev}>
            {label}
        </span>
    );
};

export default TeamBadge;
