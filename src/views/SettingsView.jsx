import React, { useState } from 'react';
import {
    IconAdjustments, IconMoon, IconSun, IconArrowUp, IconArrowDown, IconEye, IconEyeOff,
    IconHeart, IconFlag, IconFlame, IconCheck, IconTrash, IconRestore, IconStar,
} from '@tabler/icons-react';
import ViewHeader from '../components/shell/ViewHeader';
import Segmented from '../components/ui/Segmented';
import { useSettings, NATIONALITIES, MAX_NATIONALITIES } from '../state/settings';
import { accentFromTeam } from '../utils/colour';
import { teamColors } from '../utils/teamColors';
import { NHL_TEAM_ABBREVS } from '../utils/teams';
import { nationPlural, countryName } from '../utils/nations';

/**
 * Asetukset ja räätälöinti: etusivun osiot, seuratut maat, ulkoasu, kieli
 * sekä suosikkien ja asetusten nollaus.
 *
 * Kaikki tallentuu vain tähän laitteeseen (selaimen localStorage). Tiliä ei
 * ole eikä tietoja lähetetä minnekään.
 */

const SECTION_META = {
    favourites: { icon: IconHeart, label: { fi: 'Suosikkipelaajat', en: 'Favourite players' }, hint: { fi: 'Suosikkiesi tilanne kierroksella', en: 'Your favourites this round' } },
    nationals: { icon: IconFlag, label: { fi: 'Seuratut maat', en: 'Followed countries' }, hint: { fi: 'Valitsemiesi maiden pelaajat', en: 'Players from countries you follow' } },
    hot: { icon: IconFlame, label: { fi: 'Tulikuumat', en: 'On fire' }, hint: { fi: 'Kierroksen parhaat suoritukset', en: 'Best performances of the round' } },
    fantasy: { icon: IconStar, label: { fi: 'Fantasy', en: 'Fantasy' }, hint: { fi: 'Joukkueesi illan pisteet', en: "Your team's points tonight" } },
};

export default function SettingsView() {
    const { settings, update, favTeams, favPlayers, accentTeam, clearFavourites, resetSettings } = useSettings();
    const fantasyCount = readFantasyCount();
    const lang = settings.language === 'en' ? 'en' : 'fi';
    const fi = lang === 'fi';
    const theme = settings.theme === 'light' ? 'light' : 'dark';

    /** Näytetään se sävy, jonka käyttäjä oikeasti saa — ei joukkueen raakaväriä. */
    const swatchColour = (abbrev) => accentFromTeam(teamColors[abbrev], theme).accent;
    const iceColour = accentFromTeam(undefined, theme).accent;

    const autoLabel = favTeams[0]
        ? (fi ? `Suosikki (${favTeams[0]})` : `Favourite (${favTeams[0]})`)
        : (fi ? 'Suosikki' : 'Favourite');

    // --- Etusivun osiot ---

    // Listassa näkyvät osiot; pois kytketty fantasy ei ole mukana.
    const listed = settings.homeSections.filter((s) => SECTION_META[s.id] && (s.id !== 'fantasy' || settings.fantasy));

    /** Vaihtaa osion paikkaa näkyvän naapurin kanssa. */
    const moveSection = (id, delta) => {
        const other = listed[listed.findIndex((s) => s.id === id) + delta];
        if (!other) return;
        const list = [...settings.homeSections];
        const a = list.findIndex((s) => s.id === id);
        const b = list.findIndex((s) => s.id === other.id);
        [list[a], list[b]] = [list[b], list[a]];
        update({ homeSections: list });
    };

    const toggleSection = (id) => {
        update({ homeSections: settings.homeSections.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)) });
    };

    // --- Seuratut maat ---

    const nations = settings.nationalities;
    const toggleNation = (code) => {
        if (nations.includes(code)) {
            if (nations.length === 1) return; // vähintään yksi maa
            update({ nationalities: nations.filter((c) => c !== code) });
        } else if (nations.length < MAX_NATIONALITIES) {
            update({ nationalities: [...nations, code] });
        }
    };

    return (
        <div className="view">
            <ViewHeader
                icon={IconAdjustments}
                title={fi ? 'Asetukset' : 'Settings'}
                subtitle={fi ? 'Tee sovelluksesta omanlaisesi' : 'Make the app yours'}
            />

            <section className="panel">
                <h2 className="panel-title">{fi ? 'Etusivu' : 'Home'}</h2>
                <p className="panel-hint">
                    {fi
                        ? 'Ottelut ovat aina ylimpänä. Niiden alla olevien osioiden järjestyksen ja näkyvyyden voit valita itse.'
                        : 'Games always come first. Choose the order and visibility of the sections below them.'}
                </p>
                <ol className="order-list">
                    {listed.map((section, i) => {
                        const meta = SECTION_META[section.id];
                        const Icon = meta.icon;
                        return (
                            <li key={section.id} className={`order-item ${section.visible ? '' : 'is-hidden'}`}>
                                <Icon size={18} stroke={1.9} className="order-icon" aria-hidden="true" />
                                <span className="order-text">
                                    <span className="order-label">{meta.label[lang]}</span>
                                    <span className="order-hint">{section.visible ? meta.hint[lang] : (fi ? 'Piilotettu' : 'Hidden')}</span>
                                </span>
                                <button
                                    type="button"
                                    className="icon-toggle"
                                    onClick={() => moveSection(section.id, -1)}
                                    disabled={i === 0}
                                    aria-label={fi ? `Siirrä ${meta.label.fi} ylemmäs` : `Move ${meta.label.en} up`}
                                >
                                    <IconArrowUp size={16} stroke={2} />
                                </button>
                                <button
                                    type="button"
                                    className="icon-toggle"
                                    onClick={() => moveSection(section.id, 1)}
                                    disabled={i === listed.length - 1}
                                    aria-label={fi ? `Siirrä ${meta.label.fi} alemmas` : `Move ${meta.label.en} down`}
                                >
                                    <IconArrowDown size={16} stroke={2} />
                                </button>
                                <button
                                    type="button"
                                    className={`icon-toggle ${section.visible ? 'is-on-accent' : ''}`}
                                    onClick={() => toggleSection(section.id)}
                                    aria-pressed={section.visible}
                                    aria-label={section.visible ? (fi ? `Piilota ${meta.label.fi}` : `Hide ${meta.label.en}`) : (fi ? `Näytä ${meta.label.fi}` : `Show ${meta.label.en}`)}
                                >
                                    {section.visible ? <IconEye size={16} stroke={2} /> : <IconEyeOff size={16} stroke={2} />}
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </section>

            <section className="panel">
                <h2 className="panel-title">{fi ? 'Seuratut maat' : 'Followed countries'}</h2>
                <p className="panel-hint">
                    {fi
                        ? `Valittujen maiden pelaajat näkyvät etusivulla ja omina rajauksinaan tilastoissa, loukkaantumisissa ja draftissa. Enintään ${MAX_NATIONALITIES} maata.`
                        : `Players from these countries appear on the home page and as filters in stats, injuries and the draft. Up to ${MAX_NATIONALITIES}.`}
                </p>
                <div className="nation-grid" role="group" aria-label={fi ? 'Seuratut maat' : 'Followed countries'}>
                    {NATIONALITIES.map((code) => {
                        const on = nations.includes(code);
                        const full = !on && nations.length >= MAX_NATIONALITIES;
                        return (
                            <button
                                key={code}
                                type="button"
                                className={`nation-option ${on ? 'is-selected' : ''}`}
                                onClick={() => toggleNation(code)}
                                aria-pressed={on}
                                disabled={full || (on && nations.length === 1)}
                                title={on && nations.length === 1 ? (fi ? 'Vähintään yksi maa' : 'At least one country') : undefined}
                            >
                                <span className="nation-check" aria-hidden="true">{on && <IconCheck size={12} stroke={3} />}</span>
                                <span className="nation-name">{countryName(code, lang)}</span>
                                <span className="nation-code">{code}</span>
                            </button>
                        );
                    })}
                </div>
                <p className="panel-hint" style={{ margin: 'var(--space-3) 0 0' }}>
                    {fi ? 'Seurataan: ' : 'Following: '}
                    <strong>{nations.map((c) => nationPlural(c, lang)).join(', ')}</strong>
                </p>
            </section>

            <section className="panel">
                <h2 className="panel-title">Fantasy</h2>
                <p className="panel-hint">
                    {fi
                        ? 'Kokoa kuuden pelaajan joukkue (1 maalivahti, 2 puolustajaa, 3 hyökkääjää) pelaajakortin tähdestä. Etusivu laskee joukkueen illan pisteet Hockey GM:n pistetaulukolla, ja kapteenin pisteet kerrotaan 1,3:lla.'
                        : 'Build a six-player team (1 goalie, 2 defence, 3 forwards) with the star on a player card. The home page scores tonight’s games with the Hockey GM points table; your captain scores ×1.3.'}
                </p>
                <Segmented
                    label="Fantasy"
                    value={settings.fantasy ? 'on' : 'off'}
                    onChange={(value) => update({ fantasy: value === 'on' })}
                    options={[
                        { value: 'off', label: fi ? 'Pois' : 'Off' },
                        { value: 'on', label: fi ? 'Päällä' : 'On' },
                    ]}
                />
                {settings.fantasy && (
                    <p className="panel-hint" style={{ margin: 'var(--space-3) 0 0' }}>
                        {fi
                            ? `Joukkueessa ${fantasyCount}/6 pelaajaa. Kapteenin voi valita pelaajan fantasy-ikkunasta etusivulla.`
                            : `${fantasyCount}/6 players in your team. Pick a captain from the player's fantasy window on the home page.`}
                    </p>
                )}
            </section>

            <section className="panel">
                <h2 className="panel-title">{fi ? 'Teema' : 'Theme'}</h2>
                <p className="panel-hint">{fi ? 'Grafiitti on sovelluksen oletus.' : 'Graphite is the default.'}</p>
                <Segmented
                    label={fi ? 'Teema' : 'Theme'}
                    value={settings.theme}
                    onChange={(value) => update({ theme: value })}
                    options={[
                        { value: 'dark', label: fi ? 'Grafiitti' : 'Graphite', icon: IconMoon },
                        { value: 'light', label: fi ? 'Vaalea' : 'Light', icon: IconSun },
                    ]}
                />
            </section>

            <section className="panel">
                <h2 className="panel-title">{fi ? 'Korostusväri' : 'Accent colour'}</h2>
                <p className="panel-hint">
                    {fi
                        ? 'Oletuksena jääsininen. Suosikkijoukkueen väri vaalennetaan tarvittaessa, jotta se on luettava.'
                        : 'Ice blue by default. Team colours are lightened when needed so they stay readable.'}
                </p>
                <div className="swatch-grid">
                    <button
                        type="button"
                        className={`swatch swatch-wide ${settings.accentTeam === 'ice' ? 'is-selected' : ''}`}
                        onClick={() => update({ accentTeam: 'ice' })}
                        aria-pressed={settings.accentTeam === 'ice'}
                    >
                        <span className="swatch-dot" style={{ background: iceColour }} />
                        {fi ? 'Jääsininen' : 'Ice blue'}
                    </button>
                    <button
                        type="button"
                        className={`swatch swatch-wide ${settings.accentTeam === 'auto' ? 'is-selected' : ''}`}
                        onClick={() => update({ accentTeam: 'auto' })}
                        aria-pressed={settings.accentTeam === 'auto'}
                    >
                        <span className="swatch-dot" style={{ background: favTeams[0] ? swatchColour(favTeams[0]) : iceColour }} />
                        {autoLabel}
                    </button>
                    {NHL_TEAM_ABBREVS.map((abbrev) => {
                        const selected = settings.accentTeam === abbrev;
                        return (
                            <button
                                key={abbrev}
                                type="button"
                                className={`swatch ${selected ? 'is-selected' : ''}`}
                                onClick={() => update({ accentTeam: abbrev })}
                                aria-pressed={selected}
                                aria-label={abbrev}
                            >
                                <span className="swatch-dot" style={{ background: swatchColour(abbrev) }} />
                                {abbrev}
                            </button>
                        );
                    })}
                </div>
                {settings.accentTeam === 'auto' && !accentTeam && (
                    <p className="panel-hint" style={{ margin: 'var(--space-3) 0 0' }}>
                        {fi
                            ? 'Et ole vielä valinnut suosikkijoukkuetta, joten käytössä on jääsininen.'
                            : 'No favourite team yet, so ice blue is used.'}
                    </p>
                )}
            </section>

            <section className="panel">
                <h2 className="panel-title">{fi ? 'Taulukot' : 'Tables'}</h2>
                <p className="panel-hint">
                    {fi ? 'Tiivis näyttää enemmän rivejä kerralla.' : 'Compact shows more rows at once.'}
                </p>
                <Segmented
                    label={fi ? 'Taulukoiden tiiviys' : 'Table density'}
                    value={settings.density}
                    onChange={(value) => update({ density: value })}
                    options={[
                        { value: 'comfortable', label: fi ? 'Väljä' : 'Comfortable' },
                        { value: 'compact', label: fi ? 'Tiivis' : 'Compact' },
                    ]}
                />
            </section>

            <section className="panel">
                <h2 className="panel-title">{fi ? 'Kieli' : 'Language'}</h2>
                <Segmented
                    label={fi ? 'Kieli' : 'Language'}
                    value={settings.language}
                    onChange={(value) => update({ language: value })}
                    options={[
                        { value: 'fi', label: 'Suomi' },
                        { value: 'en', label: 'English' },
                    ]}
                />
            </section>

            <section className="panel">
                <h2 className="panel-title">{fi ? 'Tallennetut tiedot' : 'Saved data'}</h2>
                <p className="panel-hint">
                    {fi
                        ? 'Asetukset ja suosikit tallentuvat vain tähän laitteeseen. Sovelluksessa ei ole tiliä, eikä tietoja lähetetä minnekään.'
                        : 'Settings and favourites are stored on this device only. There is no account and nothing is sent anywhere.'}
                </p>
                <p className="panel-hint">
                    {fi
                        ? `Suosikkeja: ${favTeams.length} joukkuetta ja ${favPlayers.length} pelaajaa.`
                        : `Favourites: ${favTeams.length} teams and ${favPlayers.length} players.`}
                </p>
                <div className="danger-actions">
                    <ConfirmButton
                        icon={IconTrash}
                        label={fi ? 'Tyhjennä suosikit' : 'Clear favourites'}
                        confirmLabel={fi ? 'Vahvista tyhjennys' : 'Confirm clear'}
                        disabled={favTeams.length === 0 && favPlayers.length === 0}
                        onConfirm={clearFavourites}
                        fi={fi}
                    />
                    <ConfirmButton
                        icon={IconRestore}
                        label={fi ? 'Palauta oletusasetukset' : 'Restore defaults'}
                        confirmLabel={fi ? 'Vahvista palautus' : 'Confirm restore'}
                        onConfirm={resetSettings}
                        fi={fi}
                    />
                </div>
            </section>
        </div>
    );
}

/** Fantasy-joukkueen koko suoraan tallennuksesta (joukkue on App-tasolla). */
function readFantasyCount() {
    try {
        const team = JSON.parse(localStorage.getItem('fantasyTeam') ?? '[]');
        return Array.isArray(team) ? team.length : 0;
    } catch {
        return 0;
    }
}

/** Kaksivaiheinen painike: ensimmäinen napautus kysyy vahvistusta. */
function ConfirmButton({ icon, label, confirmLabel, onConfirm, disabled, fi }) {
    const Icon = icon;
    const [armed, setArmed] = useState(false);
    return (
        <span className="confirm-wrap">
            <button
                type="button"
                className={`chip danger-chip ${armed ? 'is-armed' : ''}`}
                disabled={disabled}
                onClick={() => {
                    if (armed) { onConfirm(); setArmed(false); } else setArmed(true);
                }}
                onBlur={() => setArmed(false)}
            >
                <Icon size={14} stroke={2} aria-hidden="true" />
                {armed ? confirmLabel : label}
            </button>
            {armed && <span className="confirm-hint">{fi ? 'Napauta uudelleen' : 'Tap again'}</span>}
        </span>
    );
}
