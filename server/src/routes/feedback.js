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

router.post('/', limiter, async (req, res, next) => {
    const message = String(req.body?.viesti ?? '').trim();
    const sender = String(req.body?.lahettaja ?? '').trim().slice(0, MAX_SENDER_LENGTH);

    if (!message) {
        return res.status(400).json({ error: 'Viesti puuttuu.' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({ error: `Viesti on liian pitkä (max ${MAX_MESSAGE_LENGTH} merkkiä).` });
    }

    if (!transporter) {
        console.warn('[palaute] Sähköpostiasetukset puuttuvat, viestiä ei lähetetty');
        return res.status(503).json({ error: 'Palautteen lähetys ei ole juuri nyt käytössä.' });
    }

    try {
        await transporter.sendMail({
            from: `"Aamujää" <${config.mail.user}>`,
            to: config.mail.receiver,
            replyTo: sender.includes('@') ? sender : undefined,
            subject: '📩 Uusi palaute Aamujäästä',
            text: `Lähettäjä: ${sender || 'Anonyymi'}\n\nViesti:\n${message}`,
        });
        res.json({ status: 'ok' });
    } catch (err) {
        next(err);
    }
});

export default router;
