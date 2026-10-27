import React from 'react';

/**
 * puckoodi-tunnus: kiekkopää silmälaseilla ja nimi.
 *
 * Sovelluksen ikonissa (public/icon.svg) hahmolla on myös kädet ja laskin;
 * yläpalkin pieneen kokoon niistä jää vain pää, jotta lasit erottuvat.
 * Kiekon väri tulee korostuksesta, joten tunnus vaihtaa sävyä
 * suosikkijoukkueen mukana siinä missä muukin sovellus.
 */
export function PuckMark({ size = 24 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="puck-mark">
            <path d="M2 7v8.4c0 2.3 4.5 4.1 10 4.1s10-1.8 10-4.1V7" fill="var(--accent-strong)" />
            <ellipse cx="12" cy="7" rx="10" ry="3.9" fill="var(--accent)" />
            <ellipse cx="12" cy="7" rx="5.6" ry="2" fill="none" stroke="var(--on-accent)" strokeOpacity="0.3" strokeWidth="0.9" />
            {/* Silmälasit */}
            <circle cx="8.7" cy="13" r="2.7" fill="#eaf6ff" stroke="#0b1b27" strokeWidth="1.1" />
            <circle cx="15.3" cy="13" r="2.7" fill="#eaf6ff" stroke="#0b1b27" strokeWidth="1.1" />
            <path d="M11.4 12.8 Q12 12.3 12.6 12.8" fill="none" stroke="#0b1b27" strokeWidth="1" strokeLinecap="round" />
            <circle cx="9.1" cy="13.3" r="1" fill="#0b1b27" />
            <circle cx="14.9" cy="13.3" r="1" fill="#0b1b27" />
            <path d="M10.6 17.1 Q12 18 13.4 17.1" fill="none" stroke="#0b1b27" strokeWidth="0.9" strokeLinecap="round" />
        </svg>
    );
}

export default function Logo() {
    return (
        <span className="logo" aria-label="puckoodi">
            <PuckMark />
            <span className="logo-word" aria-hidden="true">
                puck<span className="logo-accent">oodi</span>
            </span>
        </span>
    );
}
