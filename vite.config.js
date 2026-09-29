import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Sovellus tarjoillaan osoitteessa d4nyyy.fi/hockey/, joten polkujen on oltava
// suhteessa siihen. VITE_BASE mahdollistaa juuripolun ilman koodimuutosta
// (esim. jos sovellus siirtyy omalle aliverkkotunnukselle).
const base = process.env.VITE_BASE ?? '/hockey/';

// Kehityspalvelin tarjoilee sovelluksen base-polusta, joten myös rajapinta-
// kutsut lähtevät sen alta ('/hockey/api/...'). Backend karsii etuliitteen
// itse, joten pyyntö voidaan välittää sellaisenaan.
const apiPrefix = `${base.replace(/\/+$/, '')}/api`;
const backend = { target: 'http://localhost:3000', changeOrigin: true };

export default defineConfig({
    base,
    plugins: [react()],
    build: {
        target: 'es2020',
        sourcemap: false,
        rollupOptions: {
            output: {
                // React omaan tiedostoonsa: se muuttuu harvoin, joten selain saa
                // pitää sen välimuistissa vaikka sovelluskoodi päivittyisi.
                manualChunks: {
                    react: ['react', 'react-dom'],
                },
            },
        },
    },
    server: {
        proxy: {
            [apiPrefix]: backend,
            '/api': backend,
        },
    },
});
