import React from 'react';
import { teamColors, DEFAULT_TEAM_COLORS } from '../../utils/teamColors';
import { shortenPlayerName } from '../../utils/names';
import { teamNickname } from '../../utils/teams';
import { positionLabel } from '../../utils/positions';

const dotColour = (abbrev) => (teamColors[abbrev] ?? DEFAULT_TEAM_COLORS)[0];

/** Pelaaja taulukon nimisarakkeessa: joukkueen väri, lyhennetty nimi, joukkue · paikka. */
export function PlayerIdentity({ row, language = 'fi' }) {
    const fi = language !== 'en';
    return (
        <span className="dt-person">
            <span className="dt-dot" style={{ background: dotColour(row.team) }} aria-hidden="true" />
            <span className="dt-person-text">
                <span className="dt-name" title={row.name}>
                    {shortenPlayerName(row.name)}
                    {row.rookie && (
                        <span className="dt-tag" title={fi ? 'Tulokas' : 'Rookie'}>{fi ? 'T' : 'R'}</span>
                    )}
                </span>
                <span className="dt-meta">
                    {[row.team, positionLabel(row.pos, language)].filter(Boolean).join(' · ')}
                </span>
            </span>
        </span>
    );
}

/**
 * Joukkue taulukon nimisarakkeessa: väri, lyhenne ja lempinimi (kaupunki on
 * jo lyhenteessä). `tag` on esim. sarjataulukon varmistustunnus (x, y, z, p).
 */
export function TeamIdentity({ row, tag, tagTitle }) {
    return (
        <span className="dt-person">
            <span className="dt-dot" style={{ background: dotColour(row.team) }} aria-hidden="true" />
            <span className="dt-person-text">
                <span className="dt-name">
                    {row.team}
                    {tag && <span className="dt-tag" title={tagTitle}>{tag}</span>}
                </span>
                <span className="dt-meta">{teamNickname(row.team)}</span>
            </span>
        </span>
    );
}
