import { useState, useEffect } from 'react';

/**
 * localStorage-tila, joka ei kaada sovellusta jos tallennettu arvo on rikki
 * tai selain ei salli tallennusta (yksityinen selaus, täysi kiintiö).
 *
 * `legacyKeys`: vanhat avaimet, joista arvo luetaan jos uutta ei vielä ole.
 * pucknower toimii samassa osoitteessa kuin Aamujää (d4nyyy.fi/hockey), joten
 * sama selainmuisti on käytössä — käyttäjän suosikit ja asetukset siirtyvät
 * mukana eikä niitä tarvitse valita uudelleen.
 */
export function usePersistentState(key, fallback, { legacyKeys = [] } = {}) {
    const [value, setValue] = useState(() => {
        try {
            for (const candidate of [key, ...legacyKeys]) {
                const stored = localStorage.getItem(candidate);
                if (stored !== null) return JSON.parse(stored);
            }
        } catch {
            // Rikki tallennettu arvo — palataan oletukseen.
        }
        return typeof fallback === 'function' ? fallback() : fallback;
    });

    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // Tallennus ei onnistu — sovellus toimii silti, arvo vain ei säily.
        }
    }, [key, value]);

    return [value, setValue];
}
