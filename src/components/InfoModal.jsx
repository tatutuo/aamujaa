import React from 'react';
import {
    IconCalendarEvent, IconTable, IconChartBar, IconStar, IconDatabase, IconShieldLock,
    IconScale, IconMessage, IconExternalLink,
} from '@tabler/icons-react';
import Sheet from './Sheet';
import { PuckMark } from './shell/Logo';
import { APP_NAME, APP_VERSION, DEVELOPER } from '../config/app';

/**
 * Tietoja sovelluksesta: mitä sovelluksessa on, mistä data tulee, miten
 * yksityisyys on hoidettu ja kuka sovelluksen on tehnyt.
 *
 * Datalähteiden mainitseminen ei ole vain kohteliaisuutta: MoneyPuckin
 * xG-data on vapaasti käytettävissä ei-kaupalliseen käyttöön sillä ehdolla,
 * että lähde kerrotaan.
 */

const FEATURES = [
    { icon: IconCalendarEvent, fi: 'Ottelut: kierroksen tulokset, tapahtumat, pelaajatilastot ja laukauskartat', en: 'Games: results, events, box scores and shot maps' },
    { icon: IconTable, fi: 'Taulukot: sarjataulukko, pudotuspelit, otteluohjelma ja loukkaantumiset', en: 'Tables: standings, playoffs, schedule and injuries' },
    { icon: IconChartBar, fi: 'Tilastot: pistepörssi, maalivahdit, joukkueet, odotetut maalit, nopeudet ja maittain', en: 'Stats: scoring, goalies, teams, expected goals, speed and by country' },
    { icon: IconStar, fi: 'Omat: suosikkijoukkueet ja -pelaajat sekä oma korostusväri', en: 'Mine: favourite teams and players, and your own accent colour' },
];

const SOURCES = [
    {
        name: 'NHL',
        url: 'https://www.nhl.com',
        fi: 'Ottelut, tulokset, kokoonpanot, tilastot, sarjataulukot, draft, historia ja NHL EDGE -seurantadata.',
        en: 'Games, scores, rosters, stats, standings, draft, history and NHL EDGE tracking data.',
    },
    {
        name: 'MoneyPuck.com',
        url: 'https://moneypuck.com',
        fi: 'Odotetut maalit (xG) sekä Corsi- ja Fenwick-osuudet. Päivittyy kerran vuorokaudessa.',
        en: 'Expected goals (xG), Corsi and Fenwick shares. Updated daily.',
    },
    {
        name: 'ESPN',
        url: 'https://www.espn.com/nhl/injuries',
        fi: 'Loukkaantumiset ja paluuarviot. Epävirallinen lähde; NHL ei julkaise loukkaantumistietoja.',
        en: 'Injuries and return estimates. Unofficial; the NHL does not publish injury data.',
    },
];

export default function InfoModal({ isOpen, onClose, onFeedback, language, zIndex = 99000 }) {
    const lang = language === 'en' ? 'en' : 'fi';
    const fi = lang === 'fi';

    return (
        <Sheet isOpen={isOpen} onClose={onClose} zIndex={zIndex} size="full" title={fi ? 'Tietoja' : 'About'}>
            <div className="about">
                <div className="about-hero">
                    <PuckMark size={44} />
                    <div>
                        <p className="about-name">{APP_NAME}</p>
                        <p className="about-version">{fi ? 'Versio' : 'Version'} {APP_VERSION}</p>
                    </div>
                </div>

                <p className="about-lead">
                    {fi
                        ? 'NHL-tilastot suomeksi ilman mainoksia. Sovellus kokoaa ottelut, tilastot ja historian yhteen paikkaan ja on tehty erityisesti suomalaisten pelaajien seuraamiseen.'
                        : 'NHL stats without ads. The app brings games, stats and history together, with a focus on following players from the countries you choose.'}
                </p>

                <section className="about-section">
                    <h3 className="card-section-title">{fi ? 'Sisältö' : 'Contents'}</h3>
                    <ul className="about-list">
                        {FEATURES.map((feature) => {
                            const Icon = feature.icon;
                            return (
                                <li key={feature.en}>
                                    <Icon size={18} stroke={1.8} aria-hidden="true" />
                                    <span>{fi ? feature.fi : feature.en}</span>
                                </li>
                            );
                        })}
                    </ul>
                </section>

                <section className="about-section">
                    <h3 className="card-section-title">
                        <IconDatabase size={14} stroke={2} aria-hidden="true" /> {fi ? 'Datalähteet' : 'Data sources'}
                    </h3>
                    <ul className="about-sources">
                        {SOURCES.map((s) => (
                            <li key={s.name}>
                                <a href={s.url} target="_blank" rel="noreferrer" className="about-source-name">
                                    {s.name} <IconExternalLink size={12} stroke={2} aria-hidden="true" />
                                </a>
                                <span>{fi ? s.fi : s.en}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="about-note">
                        {fi
                            ? 'Tiedot haetaan palvelimen kautta ja ne ovat välimuistissa muutamasta sekunnista muutamaan tuntiin. Käynnissä olevien otteluiden tulokset päivittyvät noin 15 sekunnin välein.'
                            : 'Data is fetched through our server and cached from seconds to hours. Live scores refresh about every 15 seconds.'}
                    </p>
                </section>

                <section className="about-section">
                    <h3 className="card-section-title">
                        <IconShieldLock size={14} stroke={2} aria-hidden="true" /> {fi ? 'Yksityisyys' : 'Privacy'}
                    </h3>
                    <ul className="about-bullets">
                        <li>{fi ? 'Ei mainoksia, ei analytiikkaa eikä seurantaevästeitä.' : 'No ads, no analytics and no tracking cookies.'}</li>
                        <li>{fi ? 'Ei käyttäjätiliä. Asetukset ja suosikit tallentuvat vain omaan laitteeseesi.' : 'No account. Settings and favourites stay on your device.'}</li>
                        <li>{fi ? 'Palautelomake lähettää vain kirjoittamasi viestin ja halutessasi sähköpostiosoitteen.' : 'The feedback form sends only your message and, if you choose, your email.'}</li>
                    </ul>
                </section>

                <section className="about-section">
                    <h3 className="card-section-title">
                        <IconScale size={14} stroke={2} aria-hidden="true" /> {fi ? 'Vastuuvapaus' : 'Disclaimer'}
                    </h3>
                    <p className="about-note">
                        {fi
                            ? `${APP_NAME} on itsenäinen harrastusprojekti, eikä se ole National Hockey Leaguen (NHL), sen joukkueiden tai muiden datalähteiden tuottama tai hyväksymä. NHL, joukkueiden nimet ja tunnukset ovat omistajiensa tavaramerkkejä. Tiedot voivat olla viiveellisiä tai virheellisiä.`
                            : `${APP_NAME} is an independent hobby project and is not produced or endorsed by the National Hockey League (NHL), its teams or the other data sources. NHL and team names and marks are trademarks of their owners. Data may be delayed or inaccurate.`}
                    </p>
                </section>

                <footer className="about-footer">
                    <span>
                        {fi ? 'Tekijä' : 'Made by'}{' '}
                        <a href={DEVELOPER.url} target="_blank" rel="noreferrer">{DEVELOPER.name}</a>
                    </span>
                    {onFeedback && (
                        <button type="button" className="chip" onClick={onFeedback}>
                            <IconMessage size={14} stroke={2} aria-hidden="true" />
                            {fi ? 'Lähetä palautetta' : 'Send feedback'}
                        </button>
                    )}
                </footer>
            </div>
        </Sheet>
    );
}
