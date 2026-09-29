import React from 'react';
import { recentSeasons } from '../../utils/season';
import { seasonLabel } from '../../utils/format';

/**
 * Kauden ja ottelutyypin valinta. Natiivi select: puhelimessa se avaa
 * laitteen oman valitsimen, joka on nopeampi kuin mikään itse tehty lista.
 *
 * `value` on null kun käytössä on oletus (kuluva kausi), jotta palvelin saa
 * päättää varakaudesta ennen kauden avausta.
 */
export default function SeasonPicker({ season, onSeason, gameType, onGameType, language }) {
    const fi = language !== 'en';
    const seasons = recentSeasons(12);

    return (
        <div className="season-picker">
            <select
                className="select"
                value={season ?? ''}
                onChange={(e) => onSeason(e.target.value || null)}
                aria-label={fi ? 'Kausi' : 'Season'}
            >
                <option value="">{fi ? 'Kuluva kausi' : 'Current season'}</option>
                {seasons.map((s) => (
                    <option key={s} value={s}>{seasonLabel(s)}</option>
                ))}
            </select>
            {onGameType && (
                <select
                    className="select"
                    value={gameType}
                    onChange={(e) => onGameType(Number(e.target.value))}
                    aria-label={fi ? 'Ottelutyyppi' : 'Game type'}
                >
                    <option value={2}>{fi ? 'Runkosarja' : 'Regular season'}</option>
                    <option value={3}>{fi ? 'Pudotuspelit' : 'Playoffs'}</option>
                </select>
            )}
        </div>
    );
}
