import React, { useState, useEffect, useCallback } from 'react';

/**
 * Avausruutu.
 *
 * Korjatut asiat:
 *   - Kuva täyttää nyt koko ruudun. Aiemmin ympärillä oli 15 %:n täyte ja
 *     `object-fit: contain`, joten kuva jäi pieneksi laatikoksi mustan keskelle.
 *   - Napautus vie eteenpäin. Ennen ruutua joutui odottamaan kaksi sekuntia
 *     ilman mitään keinoa ohittaa se.
 *   - Zoomaus alkaa nyt hieman yli täyden koon ja rauhoittuu siihen, jolloin
 *     reunoille ei synny hetkeksikään tyhjää.
 */

const AUTO_DISMISS_MS = 1800;
const FADE_MS = 400;

const SplashScreen = ({ language = 'fi' }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [isLeaving, setIsLeaving] = useState(false);

    const dismiss = useCallback(() => {
        setIsLeaving(true);
        setTimeout(() => setIsVisible(false), FADE_MS);
    }, []);

    useEffect(() => {
        const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
        return () => clearTimeout(timer);
    }, [dismiss]);

    // Myös näppäimistöltä ohitettavissa.
    useEffect(() => {
        if (!isVisible) return undefined;
        const onKey = () => dismiss();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isVisible, dismiss]);

    if (!isVisible) return null;

    return (
        <button
            type="button"
            className={`splash ${isLeaving ? 'is-leaving' : ''}`}
            onClick={dismiss}
            aria-label={language === 'fi' ? 'Siirry sovellukseen' : 'Continue to app'}
        >
            <img src="./splash.png" alt="" className="splash-image" />

            <span className="splash-hint">
                {language === 'fi' ? 'Napauta jatkaaksesi' : 'Tap to continue'}
            </span>
        </button>
    );
};

export default SplashScreen;
