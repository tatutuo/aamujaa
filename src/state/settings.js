import { createContext, useContext } from 'react';

/**
 * Käyttäjän asetukset ja suosikit.
 *
 * Konteksti ja hook ovat omassa tiedostossaan eivätkä Provider-komponentin
 * kanssa, jotta Viten fast refresh toimii (komponenttitiedosto saa viedä
 * vain komponentteja).
 */

/**
 * Etusivun osiot oletusjärjestyksessä. Käyttäjä voi piilottaa ja järjestää.
 * Fantasy näkyy vain, kun se on kytketty päälle asetuksista.
 */
export const HOME_SECTIONS = ['favourites', 'nationals', 'hot', 'fantasy'];

/** Seurattavaksi valittavat kansallisuudet (NHL:n ISO-maakoodit). */
export const NATIONALITIES = ['FIN', 'SWE', 'CZE', 'SVK', 'CHE', 'DEU', 'DNK', 'LVA', 'AUT', 'NOR', 'SVN', 'FRA', 'BLR', 'USA', 'CAN', 'RUS'];

/** Montako maata voi seurata kerralla (etusivun päiväkooste hakee jokaisen). */
export const MAX_NATIONALITIES = 6;

export const DEFAULT_SETTINGS = Object.freeze({
    theme: 'dark',
    language: 'fi',
    /** 'comfortable' | 'compact' — taulukoiden rivikorkeus. */
    density: 'comfortable',
    /**
     * Korostusvärin lähde:
     *   'auto' = ensimmäinen suosikkijoukkue, jos sellainen on; muuten jääsininen
     *   'ice'  = aina jääsininen
     *   'TOR' tms. = tietyn joukkueen väri
     */
    accentTeam: 'auto',
    nationalities: ['FIN'],
    /** Hockey GM -pisteisiin perustuva fantasy-joukkue. Oletuksena pois. */
    fantasy: false,
    homeSections: HOME_SECTIONS.map((id) => ({ id, visible: true })),
});

export const SettingsContext = createContext(null);

export function useSettings() {
    const value = useContext(SettingsContext);
    if (!value) throw new Error('useSettings vaatii SettingsProviderin');
    return value;
}
