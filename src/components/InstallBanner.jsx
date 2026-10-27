import React, { useState } from 'react';
import { IconX, IconUpload, IconSquarePlus, IconDotsVertical, IconMenu2, IconDownload, IconWorld, IconCircleCheck } from '@tabler/icons-react';
import Sheet from './Sheet';
import { usePersistentState } from '../hooks/usePersistentState';
import { useInstallState, promptInstall, installPlatform } from '../utils/install';
import { LOGO_URL } from '../config/app';

/**
 * "Tee sovellus" -kortti etusivulla.
 *
 * Chromium-selaimissa nappi avaa selaimen oman asennusikkunan suoraan.
 * Muualla (iPhone, Firefox) se avaa laitteen mukaiset ohjeet: Apple ei salli
 * verkkosivun lisätä itseään kotivalikkoon. Kortti ei näy, kun sovellus on
 * jo avattu kotivalikosta, ja sen voi piilottaa ruksista.
 */

const STEPS = {
    'ios-safari': {
        fi: [
            [IconUpload, 'Napauta alapalkin Jaa-painiketta (neliö ja nuoli ylös).'],
            [IconSquarePlus, 'Vieritä valikkoa ja valitse "Lisää Koti-valikkoon".'],
            [IconCircleCheck, 'Napauta oikeasta yläkulmasta "Lisää".'],
        ],
        en: [
            [IconUpload, 'Tap the Share button in the toolbar (square with an arrow).'],
            [IconSquarePlus, 'Scroll down and choose "Add to Home Screen".'],
            [IconCircleCheck, 'Tap "Add" in the top right corner.'],
        ],
    },
    'ios-other': {
        fi: [
            [IconUpload, 'Napauta osoiterivin Jaa-painiketta (neliö ja nuoli ylös).'],
            [IconSquarePlus, 'Valitse "Lisää Koti-valikkoon". Jos kohtaa ei näy, avaa sivu Safarissa.'],
            [IconCircleCheck, 'Napauta "Lisää".'],
        ],
        en: [
            [IconUpload, 'Tap the Share button next to the address bar.'],
            [IconSquarePlus, 'Choose "Add to Home Screen". If it is missing, open the page in Safari.'],
            [IconCircleCheck, 'Tap "Add".'],
        ],
    },
    android: {
        fi: [
            [IconDotsVertical, 'Napauta selaimen oikean yläkulman valikkoa (kolme pistettä).'],
            [IconDownload, 'Valitse "Asenna sovellus" tai "Lisää aloitusnäyttöön".'],
            [IconCircleCheck, 'Vahvista "Asenna".'],
        ],
        en: [
            [IconDotsVertical, 'Tap the browser menu (three dots, top right).'],
            [IconDownload, 'Choose "Install app" or "Add to Home screen".'],
            [IconCircleCheck, 'Confirm "Install".'],
        ],
    },
    'android-samsung': {
        fi: [
            [IconMenu2, 'Napauta alapalkin valikkoa (kolme viivaa).'],
            [IconSquarePlus, 'Valitse "Lisää sivu" ja sitten "Aloitusnäyttö".'],
            [IconCircleCheck, 'Vahvista "Lisää".'],
        ],
        en: [
            [IconMenu2, 'Tap the menu in the bottom bar (three lines).'],
            [IconSquarePlus, 'Choose "Add page to", then "Home screen".'],
            [IconCircleCheck, 'Confirm "Add".'],
        ],
    },
    'android-firefox': {
        fi: [
            [IconDotsVertical, 'Napauta selaimen valikkoa (kolme pistettä).'],
            [IconDownload, 'Valitse "Asenna" tai "Lisää aloitusnäyttöön".'],
            [IconCircleCheck, 'Vahvista lisäys.'],
        ],
        en: [
            [IconDotsVertical, 'Tap the browser menu (three dots).'],
            [IconDownload, 'Choose "Install" or "Add to Home screen".'],
            [IconCircleCheck, 'Confirm.'],
        ],
    },
    'desktop-safari': {
        fi: [
            [IconUpload, 'Valitse valikkoriviltä Arkisto (File) tai napauta Jaa-painiketta.'],
            [IconSquarePlus, 'Valitse "Lisää Dockiin".'],
            [IconCircleCheck, 'Vahvista "Lisää".'],
        ],
        en: [
            [IconUpload, 'Open the File menu or the Share button.'],
            [IconSquarePlus, 'Choose "Add to Dock".'],
            [IconCircleCheck, 'Confirm "Add".'],
        ],
    },
    desktop: {
        fi: [
            [IconDownload, 'Napsauta osoiterivin oikeassa reunassa olevaa asennuskuvaketta.'],
            [IconDotsVertical, 'Tai avaa selaimen valikko ja valitse "Asenna puckoodi" (Edgessä Sovellukset → Asenna).'],
            [IconCircleCheck, 'Vahvista "Asenna".'],
        ],
        en: [
            [IconDownload, 'Click the install icon at the right end of the address bar.'],
            [IconDotsVertical, 'Or open the browser menu and choose "Install puckoodi" (Edge: Apps → Install).'],
            [IconCircleCheck, 'Confirm "Install".'],
        ],
    },
    'in-app': {
        fi: [
            [IconWorld, 'Olet sovelluksen sisäisessä selaimessa, joka ei osaa asentaa sivuja.'],
            [IconDotsVertical, 'Avaa valikosta "Avaa selaimessa" (Safari tai Chrome).'],
            [IconSquarePlus, 'Napauta siellä tätä korttia uudelleen.'],
        ],
        en: [
            [IconWorld, 'This is an in-app browser, which cannot install web apps.'],
            [IconDotsVertical, 'Use the menu to "Open in browser" (Safari or Chrome).'],
            [IconSquarePlus, 'Tap this card again there.'],
        ],
    },
};

export default function InstallBanner({ language }) {
    const fi = language !== 'en';
    const lang = fi ? 'fi' : 'en';
    const { canPrompt, installed } = useInstallState();
    const [dismissed, setDismissed] = usePersistentState('pucknower_install_dismissed', false);
    const [helpOpen, setHelpOpen] = useState(false);

    if (installed || dismissed) return null;

    const platform = installPlatform();
    const steps = STEPS[platform] ?? STEPS.desktop;

    const install = async () => {
        if (canPrompt) {
            const outcome = await promptInstall();
            if (outcome !== 'unavailable') return;
        }
        setHelpOpen(true);
    };

    return (
        <>
            <div className="install-card">
                <img className="install-icon" src={LOGO_URL} alt="" width="44" height="44" />
                <div className="install-text">
                    <span className="install-title">{fi ? 'Tee puckoodista sovellus' : 'Make puckoodi an app'}</span>
                    <span className="install-sub">
                        {fi ? 'Kuvake kotivalikkoon, aukeaa koko näytölle.' : 'Home screen icon, opens full screen.'}
                    </span>
                </div>
                <button type="button" className="install-btn" onClick={install}>
                    <IconDownload size={16} stroke={2.2} aria-hidden="true" />
                    {fi ? 'Asenna' : 'Install'}
                </button>
                <button type="button" className="install-close" onClick={() => setDismissed(true)} aria-label={fi ? 'Piilota' : 'Hide'}>
                    <IconX size={14} stroke={2.2} />
                </button>
            </div>

            <Sheet
                isOpen={helpOpen}
                onClose={() => setHelpOpen(false)}
                title={fi ? 'Lisää kotivalikkoon' : 'Add to home screen'}
                subtitle={fi ? 'Kolme napautusta, ei sovelluskauppaa' : 'Three taps, no app store'}
            >
                <ol className="install-steps">
                    {steps[lang].map(([icon, text], i) => {
                        const Icon = icon;
                        return (
                            <li key={text}>
                                <span className="install-step-num">{i + 1}</span>
                                <span className="install-step-icon"><Icon size={20} stroke={1.8} aria-hidden="true" /></span>
                                <span>{text}</span>
                            </li>
                        );
                    })}
                </ol>
                <p className="source-note">
                    {fi
                        ? 'Sovellus on sama kuin tämä sivu: se päivittyy itsestään, ei vie tilaa eikä kysy oikeuksia. Kortin saa piilotettua ruksista.'
                        : 'The app is this same page: it updates itself, takes no space and asks for no permissions. You can hide the card with the cross.'}
                </p>
            </Sheet>
        </>
    );
}
