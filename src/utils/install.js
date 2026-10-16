import { useSyncExternalStore } from 'react';

/**
 * Sovelluksen asennus kotivalikkoon.
 *
 * Chromium-selaimet (Chrome, Edge, Samsung Internet; Android ja tietokone)
 * lähettävät `beforeinstallprompt`-tapahtuman, kun sivu täyttää asennettavan
 * sovelluksen ehdot (manifesti + service worker). Tapahtuma otetaan talteen,
 * ja oma nappi avaa sillä selaimen asennusikkunan suoraan.
 *
 * iPhonessa ja iPadissa Apple ei salli sitä: asennus tehdään aina
 * jakovalikon "Lisää Koti-valikkoon" -kohdasta, joten niille näytetään ohjeet.
 *
 * Tapahtuma voi tulla heti sivun latautuessa, ennen kuin React on piirtänyt
 * mitään, joten kuuntelija kytketään main.jsx:ssä mahdollisimman aikaisin.
 */

let deferredPrompt = null;
let installed = false;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export function initInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (event) => {
        // Estää selaimen oman pienen asennusbannerin: käytetään omaa nappia.
        event.preventDefault();
        deferredPrompt = event;
        emit();
    });
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        installed = true;
        emit();
    });
}

/** Avattu kotivalikon kuvakkeesta (ei selaimen välilehdellä). */
export function isStandalone() {
    try {
        return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
    } catch {
        return false;
    }
}

/**
 * Laite ja selain ohjeita varten:
 * ios-safari, ios-other, android-samsung, android-firefox, android, in-app, desktop-safari, desktop.
 */
export function installPlatform() {
    const ua = navigator.userAgent ?? '';
    // iPadOS esittäytyy Maciksi; kosketusnäyttö paljastaa sen.
    const isIos = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    // Sovellusten sisäiset selaimet (Instagram, Facebook, Messenger...) eivät osaa asentaa.
    if (/FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok/.test(ua)) return 'in-app';
    if (isIos) return /CriOS|FxiOS|EdgiOS/.test(ua) ? 'ios-other' : 'ios-safari';
    if (/Android/.test(ua)) {
        if (/SamsungBrowser/.test(ua)) return 'android-samsung';
        if (/Firefox/.test(ua)) return 'android-firefox';
        return 'android';
    }
    if (/Safari/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return 'desktop-safari';
    return 'desktop';
}

/** Avaa selaimen asennusikkunan. Palauttaa 'accepted', 'dismissed' tai 'unavailable'. */
export async function promptInstall() {
    const event = deferredPrompt;
    if (!event) return 'unavailable';
    event.prompt();
    const { outcome } = await event.userChoice;
    // Tapahtumaa voi käyttää vain kerran.
    deferredPrompt = null;
    if (outcome === 'accepted') installed = true;
    emit();
    return outcome;
}

const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};

/** { canPrompt: suora asennusnappi käytettävissä, installed: asennettu tällä käynnillä } */
export function useInstallState() {
    const canPrompt = useSyncExternalStore(subscribe, () => deferredPrompt !== null, () => false);
    const justInstalled = useSyncExternalStore(subscribe, () => installed, () => false);
    return { canPrompt, installed: justInstalled || isStandalone() };
}
