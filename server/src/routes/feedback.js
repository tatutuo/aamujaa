import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import { config, mailEnabled } from '../config.js';

const router = Router();

/**
 * Palautelomake.
 *
 * Lisätty vanhaan verrattuna: pituusrajat, roskapostisuoja (rate limit) ja
 * selkeä käyttäytyminen silloin kun sähköpostiasetuksia ei ole määritetty.
 * Vanha versio oli avoin lomake, jolla kuka tahansa saattoi lähettää rajattoman
 * määrän viestejä omistajan Gmail-tilin kautta.
 */

const MAX_MESSAGE_LENGTH = 2000;
const MAX_SENDER_LENGTH = 100;

const transporter = mailEnabled
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: { user: config.mail.user, pass: config.mail.pass },
    })
    : null;

const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Liikaa palautteita. Yritä myöhemmin uudelleen.' },
});

const TYPES = { bug: 'Virhe', idea: 'Idea', other: 'Muu' };
const MAX_TECHNICAL_LENGTH = 600;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', limiter, async (req, res, next) => {
    const body = req.body ?? {};

    // Roskapostiansa: piilotettu kenttä, jonka vain botit täyttävät. Vastataan
    // kuten onnistuneeseen, jottei botti opi kiertämään ansaa.
    if (String(body.website ?? '').trim()) {
        return res.json({ status: 'ok' });
    }

    // Vanha lomake lähetti kentät nimillä viesti ja lahettaja.
    const message = String(body.message ?? body.viesti ?? '').trim();
    const contact = String(body.contact ?? body.lahettaja ?? '').trim().slice(0, MAX_SENDER_LENGTH);
    const type = TYPES[body.type] ? body.type : 'other';
    const technical = String(body.technical ?? '').trim().slice(0, MAX_TECHNICAL_LENGTH);

    if (message.length < 5) {
        return res.status(400).json({ error: 'Viesti on liian lyhyt.' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({ error: `Viesti on liian pitkä (enintään ${MAX_MESSAGE_LENGTH} merkkiä).` });
    }

    if (!transporter) {
        console.warn('[palaute] Sähköpostiasetukset puuttuvat, viestiä ei lähetetty');
        return res.status(503).json({ error: 'Palautteen lähetys ei ole juuri nyt käytössä. Yritä myöhemmin uudelleen.' });
    }

    const replyTo = EMAIL.test(contact) ? contact : undefined;
    const lines = [
        `Aihe: ${TYPES[type]}`,
        `Lähettäjä: ${contact || 'ei annettu'}`,
        '',
        message,
    ];
    if (technical) lines.push('', '--- Tekniset tiedot ---', technical);

    try {
        await transporter.sendMail({
            from: `"pucknower" <${config.mail.user}>`,
            to: config.mail.receiver,
            replyTo,
            subject: `[pucknower] ${TYPES[type]}: ${message.slice(0, 60).replace(/\s+/g, ' ')}${message.length > 60 ? '…' : ''}`,
            text: lines.join('\n'),
        });
        res.json({ status: 'ok' });
    } catch (err) {
        next(err);
    }
});

export default router;
