import React from 'react';
import Logo from './Logo';

/**
 * Yläpalkki: pelkkä tunnus.
 *
 * Haku ja asetukset siirtyivät alapalkin Lisää-valikkoon. Yläpalkki pysyy
 * siksi kevyenä lasiraitana, joka ei vie tilaa sisällöltä.
 */
export default function TopBar({ onHome }) {
    return (
        <header className="topbar">
            <button type="button" className="topbar-home" onClick={onHome} aria-label="pucknower — etusivulle">
                <Logo />
            </button>
        </header>
    );
}
