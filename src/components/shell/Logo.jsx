import React from 'react';

/**
 * pucknower-tunnus: kiekko sivulta kuvattuna ja nimi.
 *
 * Kiekko piirretään itse, koska ikonikirjastossa ei ole jääkiekkoaiheita.
 * Väri tulee korostuksesta, joten tunnus vaihtaa sävyä suosikkijoukkueen
 * mukana siinä missä muukin sovellus.
 */
export function PuckMark({ size = 22 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="puck-mark">
            <path d="M3 9.5v5c0 2.2 4 4 9 4s9-1.8 9-4v-5" fill="var(--accent-strong)" />
            <ellipse cx="12" cy="9.5" rx="9" ry="4" fill="var(--accent)" />
            <ellipse cx="12" cy="9.5" rx="5.2" ry="2.1" fill="none" stroke="var(--on-accent)" strokeOpacity="0.35" strokeWidth="1" />
        </svg>
    );
}

export default function Logo() {
    return (
        <span className="logo" aria-label="pucknower">
            <PuckMark />
            <span className="logo-word" aria-hidden="true">
                puck<span className="logo-accent">nower</span>
            </span>
        </span>
    );
}
