import React, { useState } from 'react';

/**
 * "Uutta"-kortti etusivun yläreunassa.
 *
 * Vastaa kysymykseen "huomaisiko vanha käyttäjä että sovellus on päivittynyt".
 * Pelkkä uusi ulkoasu ei riitä: moni ei muista miltä sovellus näytti keväällä,
 * ja uudet ominaisuudet ovat piilossa paneelien takana.
 *
 * Kortti näytetään kerran versiota kohti. Sulkeminen tallentaa version
 * selaimen muistiin, joten se ei palaa — mutta seuraava päivitys näyttää sen
 * uudestaan, koska versionumero muuttuu.
 */

const VERSION = '2.0';
const STORAGE_KEY = 'aamujaa_seen_whatsnew';

const HIGHLIGHTS = {
    fi: [
        { icon: '🌅', text: 'Uusi ilme ja selkeämmät ottelukortit' },
        { icon: '🗺️', text: 'Laukauskartta jokaisesta ottelusta' },
        { icon: '▶️', text: 'Maalikoosteet suoraan kortista' },
        { icon: '📈', text: 'Pelaajan muotokäyrä otteluittain' },
        { icon: '📐', text: 'Edistyneet tilastot: Corsi, per 60 min' },
        { icon: '🔮', text: 'Uusittu ennustemalli, mitattu tarkkuus näkyvillä' },
    ],
    en: [
        { icon: '🌅', text: 'New look and clearer game cards' },
        { icon: '🗺️', text: 'Shot map for every game' },
        { icon: '▶️', text: 'Goal highlights straight from the card' },
        { icon: '📈', text: 'Player form game by game' },
        { icon: '📊', text: 'Advanced stats: Corsi, per 60 minutes' },
        { icon: '🔮', text: 'Rebuilt prediction model with measured accuracy' },
    ],
};

const WhatsNew = ({ language = 'fi' }) => {
    const [dismissed, setDismissed] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) === VERSION;
        } catch {
            // Yksityisessä selauksessa localStorage voi heittää — näytetään kortti.
            return false;
        }
    });

    const close = () => {
        setDismissed(true);
        try {
            localStorage.setItem(STORAGE_KEY, VERSION);
        } catch {
            // Ei haittaa, kortti palaa seuraavalla käynnistyksellä.
        }
    };

    if (dismissed) return null;

    const fi = language === 'fi';
    const items = HIGHLIGHTS[fi ? 'fi' : 'en'];

    return (
        <section className="whats-new" aria-labelledby="whats-new-title">
            <header className="whats-new-head">
                <div>
                    <span className="whats-new-badge">{fi ? 'Uutta' : "What's new"}</span>
                    <h2 id="whats-new-title" className="whats-new-title">
                        {fi ? 'Aamujää on uudistunut' : 'Aamujää has been rebuilt'}
                    </h2>
                </div>

                <button
                    type="button"
                    className="whats-new-close"
                    onClick={close}
                    aria-label={fi ? 'Sulje' : 'Dismiss'}
                >
                    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
                        <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                </button>
            </header>

            <ul className="whats-new-list">
                {items.map((item) => (
                    <li key={item.text}>
                        <span aria-hidden="true">{item.icon}</span>
                        {item.text}
                    </li>
                ))}
            </ul>

            <button type="button" className="whats-new-ok" onClick={close}>
                {fi ? 'Selvä' : 'Got it'}
            </button>
        </section>
    );
};

export default WhatsNew;
