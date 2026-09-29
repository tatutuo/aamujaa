import { useEffect, useRef, useState } from 'react';

/**
 * Datan haku, joka pitää edellisen tuloksen näkyvissä uutta haettaessa.
 *
 * Kun käyttäjä vaihtaa kautta tai suodatinta, vanha taulukko jää näkyviin
 * siksi aikaa kun uusi latautuu — ei tyhjää välähdystä eikä hyppivää sivua.
 * `isLoading` kertoo, että näkyvä data on vanhaa.
 *
 * Tila on avainnettu riippuvuuksilla, joten lataustilaa ei tarvitse asettaa
 * efektin rungossa: se johdetaan siitä, vastaako tallennettu avain nykyistä.
 *
 * @param {(signal: AbortSignal) => Promise<any>} fetcher
 * @param {Array} deps  arvot, joiden muuttuessa haetaan uudelleen (JSON-sarjallistuvia)
 */
export function useApi(fetcher, deps) {
    const key = JSON.stringify(deps);
    const [state, setState] = useState({ key: null, data: null, error: null });
    const [reloadCount, setReloadCount] = useState(0);

    // Viimeisin fetcher refissä, jotta efekti riippuu vain avaimesta eikä
    // jokaisella piirrolla uudesta funktio-oliosta.
    const fetcherRef = useRef(fetcher);
    useEffect(() => { fetcherRef.current = fetcher; });

    useEffect(() => {
        const controller = new AbortController();
        fetcherRef.current(controller.signal)
            .then((data) => setState({ key, data, error: null }))
            .catch((err) => {
                if (err.name === 'AbortError') return;
                setState((prev) => ({ key, data: prev.data, error: err.message }));
            });
        return () => controller.abort();
    }, [key, reloadCount]);

    return {
        data: state.data,
        error: state.key === key ? state.error : null,
        isLoading: state.key !== key,
        reload: () => setReloadCount((n) => n + 1),
    };
}
