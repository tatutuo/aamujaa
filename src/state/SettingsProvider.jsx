import React, { useCallback, useEffect, useMemo } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { SettingsContext, DEFAULT_SETTINGS, HOME_SECTIONS, NATIONALITIES } from './settings';
import { normaliseNation } from '../utils/nations';
import { accentFromTeam, withAlpha } from '../utils/colour';
import { teamColors } from '../utils/teamColors';

/**
 * Asetukset, suosikit ja niistä johdettu ulkoasu (teema, tiiviys, korostus).
 *
 * Ulkoasu kirjoitetaan CSS-muuttujiksi juurielementtiin, joten yksikään
 * komponentti ei tiedä korostuksen sävyä — se vain lukee `var(--accent)`.
 */
export default function SettingsProvider({ children }) {
    // Vanhat Aamujää-avaimet luetaan kerran, jos uusia ei vielä ole.
    const [stored, setStored] = usePersistentState('pucknower_settings', () => {
        const legacy = {};
        try {
            const theme = JSON.parse(localStorage.getItem('aamujaa_theme') ?? 'null');
            const language = JSON.parse(localStorage.getItem('aamujaa_lang') ?? 'null');
            if (theme === 'dark' || theme === 'light') legacy.theme = theme;
            if (language === 'fi' || language === 'en') legacy.language = language;
        } catch {
            // Rikki tallennettu arvo — oletukset riittävät.
        }
        return { ...DEFAULT_SETTINGS, ...legacy };
    });

    // Suosikit pidetään samoissa avaimissa kuin Aamujäässä, jotta ne säilyvät.
    const [favTeams, setFavTeams] = usePersistentState('favTeams', []);
    const [favPlayers, setFavPlayers] = usePersistentState('favPlayers', []);

    // Uudet asetuskentät saavat oletusarvon, vaikka tallennettu olio olisi vanhempi.
    const settings = useMemo(() => {
        const merged = { ...DEFAULT_SETTINGS, ...stored };
        // Etusivun osioista pudotetaan tuntemattomat ja lisätään puuttuvat
        // loppuun, jotta uusi osio ei jää näkymättä vanhalla asetuksella.
        const known = merged.homeSections.filter((s) => HOME_SECTIONS.includes(s.id));
        const missing = HOME_SECTIONS.filter((id) => !known.some((s) => s.id === id))
            .map((id) => ({ id, visible: true }));
        // Vanhat olympiakoodit (GER, SUI, DEN) ISO-koodeiksi, tuntemattomat pois.
        const nationalities = [...new Set((merged.nationalities ?? []).map(normaliseNation))]
            .filter((code) => NATIONALITIES.includes(code));
        return { ...merged, homeSections: [...known, ...missing], nationalities };
    }, [stored]);

    const update = useCallback((patch) => {
        setStored((prev) => ({ ...DEFAULT_SETTINGS, ...prev, ...patch }));
    }, [setStored]);

    const toggleFavTeam = useCallback((abbrev) => {
        setFavTeams((prev) => (prev.includes(abbrev) ? prev.filter((t) => t !== abbrev) : [...prev, abbrev]));
    }, [setFavTeams]);

    const toggleFavPlayer = useCallback((playerId) => {
        setFavPlayers((prev) => (prev.includes(playerId) ? prev.filter((p) => p !== playerId) : [...prev, playerId]));
    }, [setFavPlayers]);

    const clearFavourites = useCallback(() => {
        setFavTeams([]);
        setFavPlayers([]);
    }, [setFavTeams, setFavPlayers]);

    /** Kaikki asetukset oletuksiin. Suosikit säilyvät; ne tyhjennetään erikseen. */
    const resetSettings = useCallback(() => {
        setStored({ ...DEFAULT_SETTINGS });
    }, [setStored]);

    /** Joukkue, jonka väri toimii korostuksena — tai null jos jääsininen. */
    const accentTeam = useMemo(() => {
        if (settings.accentTeam === 'ice') return null;
        if (settings.accentTeam === 'auto') return favTeams[0] ?? null;
        return teamColors[settings.accentTeam] ? settings.accentTeam : null;
    }, [settings.accentTeam, favTeams]);

    // --- Ulkoasu juurielementtiin ---

    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute('data-theme', settings.theme);
        root.setAttribute('data-density', settings.density);
        root.lang = settings.language;
    }, [settings.theme, settings.density, settings.language]);

    useEffect(() => {
        const theme = settings.theme === 'light' ? 'light' : 'dark';
        const colours = accentFromTeam(accentTeam ? teamColors[accentTeam] : undefined, theme);
        const style = document.documentElement.style;

        style.setProperty('--accent', colours.accent);
        style.setProperty('--accent-strong', colours.accentStrong);
        style.setProperty('--accent-soft', colours.accentSoft);
        style.setProperty('--accent-text', colours.accentText);
        style.setProperty('--on-accent', colours.onAccent);
        // Sivun yläreunan hento hehku samasta sävystä.
        style.setProperty('--accent-glow', withAlpha(colours.accent, theme === 'light' ? 0.07 : 0.09));

        // Selaimen yläpalkin väri Androidilla seuraa teemaa.
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', theme === 'light' ? '#eef1f5' : '#1a1d21');
    }, [accentTeam, settings.theme]);

    const value = useMemo(() => ({
        settings,
        update,
        language: settings.language,
        favTeams,
        favPlayers,
        toggleFavTeam,
        toggleFavPlayer,
        clearFavourites,
        resetSettings,
        accentTeam,
    }), [settings, update, favTeams, favPlayers, toggleFavTeam, toggleFavPlayer, clearFavourites, resetSettings, accentTeam]);

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
