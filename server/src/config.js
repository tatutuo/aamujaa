import 'dotenv/config';

export const config = {
    port: Number(process.env.PORT) || 3000,
    timezone: 'Europe/Helsinki',

    /**
     * URL-polku, jonka alle sovellus on asennettu (esim. '/hockey').
     * Tyhjä = sovellus on verkkotunnuksen juuressa. Loppukauttaviiva
     * karsitaan, jotta '/hockey' ja '/hockey/' toimivat samoin.
     */
    basePath: (process.env.BASE_PATH || '').replace(/\/+$/, ''),

    corsOrigins: (process.env.CORS_ORIGINS || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),

    adminToken: process.env.ADMIN_TOKEN || '',

    predictionsEnabled: process.env.PREDICTIONS_ENABLED !== 'false',

    mail: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || '',
        receiver: process.env.EMAIL_RECEIVER || '',
    },
};

export const mailEnabled = Boolean(config.mail.user && config.mail.pass && config.mail.receiver);
