import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
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
