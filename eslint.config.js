import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
    globalIgnores(['dist', 'server/node_modules', 'server/data', 'public/sw.js']),

    // --- Selainpuoli (React) ---
    {
        files: ['src/**/*.{js,jsx}'],
        extends: [
            js.configs.recommended,
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
        ],
        languageOptions: {
            ecmaVersion: 2022,
            globals: globals.browser,
            parserOptions: {
                ecmaVersion: 'latest',
                ecmaFeatures: { jsx: true },
                sourceType: 'module',
            },
        },
        rules: {
            'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],

            // Datan hakeminen efektissä vaatii lataustilan asettamisen efektin
            // rungossa. React suosittelee tähän erillistä datakirjastoa
            // (TanStack Query tms.), mutta niin kauan kuin haut tehdään käsin,
            // tämä on oikea tapa — pidetään varoituksena, ei virheenä.
            'react-hooks/set-state-in-effect': 'warn',
        },
    },

    // --- Palvelinpuoli (Node) ---
    {
        files: ['server/**/*.js'],
        extends: [js.configs.recommended],
        languageOptions: {
            ecmaVersion: 2022,
            globals: globals.node,
            parserOptions: { sourceType: 'module' },
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },

    // --- Työkalutiedostot ---
    {
        files: ['*.config.js'],
        extends: [js.configs.recommended],
        languageOptions: {
            globals: globals.node,
            parserOptions: { sourceType: 'module' },
        },
    },
]);
