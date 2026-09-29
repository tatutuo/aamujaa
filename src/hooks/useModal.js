import { useEffect, useState } from 'react';

/**
 * Modaalin yhteinen käyttäytyminen: taustan vieritys lukkoon ja Esc sulkee.
 *
 * Aiemmin tämä logiikka oli kopioitu sellaisenaan kuuteen eri modaaliin, ja
 * jokainen niistä työnsi oman merkintänsä selaimen historiaan. Kun modaali
 * avattiin toisen päältä, historiaan kertyi merkintöjä joita mikään ei siivonnut
 * — takaisin-painike vaati monta painallusta ennen kuin mitään tapahtui.
 * Historiaa hallitaan nyt yhdessä paikassa (App.jsx).
 */
export function useModal(isOpen, onClose) {
    useEffect(() => {
        if (!isOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [isOpen, onClose]);
}

/**
 * Hakee dataa kun modaali on auki, peruuttaa pyynnön suljettaessa.
 *
 * @param {boolean} enabled
 * @param {(signal: AbortSignal) => Promise<any>} fetcher
 * @param {Array} deps
 * @returns {{ data: any, isLoading: boolean, error: string|null }}
 */
export function useFetchWhenOpen(enabled, fetcher, deps) {
    const [state, setState] = useState({ data: null, isLoading: true, error: null });

    useEffect(() => {
        if (!enabled) return undefined;

        const controller = new AbortController();
        setState({ data: null, isLoading: true, error: null });

        fetcher(controller.signal)
            .then((data) => setState({ data, isLoading: false, error: null }))
            .catch((err) => {
                if (err.name === 'AbortError') return;
                setState({ data: null, isLoading: false, error: err.message });
            });

        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, ...deps]);

    return state;
}
