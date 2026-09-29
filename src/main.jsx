import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Inter isännöidään itse: fonttipyyntö ei lähde Googlelle eikä paljasta
// käyttäjän IP:tä kolmannelle osapuolelle.
import '@fontsource-variable/inter';
import App from './App.jsx';
import SettingsProvider from './state/SettingsProvider.jsx';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <SettingsProvider>
            <App />
        </SettingsProvider>
    </StrictMode>,
);

// Service worker rekisteröidään vasta kun sivu on latautunut, jottei se
// kilpaile ensimmäisen näkymän piirtämisen kanssa. Vain tuotantobuildissa —
// kehityksessä välimuisti vain haittaisi.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
            .catch((err) => console.error('Service workerin rekisteröinti epäonnistui:', err));
    });
}
