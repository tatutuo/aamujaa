import React, { useState } from 'react';
import { IconBug, IconBulb, IconMessage, IconCircleCheck, IconAlertTriangle, IconSend } from '@tabler/icons-react';
import Sheet from './Sheet';
import Segmented from './ui/Segmented';
import { api } from '../utils/api';
import { APP_VERSION } from '../config/app';

/**
 * Palaute kehittäjälle.
 *
 * Viestin tyyppi (virhe, idea, muu) auttaa lajittelemaan palautteet.
 * Virheilmoitukseen voi liittää teknisen tiedon — sovelluksen version,
 * avoimen näkymän ja selaimen — jolloin vian toistaminen on helpompaa.
 * Mitään muuta ei lähetetä, ja käyttäjä näkee liitettävän tiedon ennen
 * lähettämistä.
 */

const MAX_LENGTH = 2000;
const MIN_LENGTH = 5;

const TYPES = {
    bug: {
        icon: IconBug,
        label: { fi: 'Virhe', en: 'Bug' },
        placeholder: {
            fi: 'Mitä teit, mitä tapahtui ja mitä odotit tapahtuvan?',
            en: 'What did you do, what happened and what did you expect?',
        },
    },
    idea: {
        icon: IconBulb,
        label: { fi: 'Idea', en: 'Idea' },
        placeholder: {
            fi: 'Mitä sovelluksesta puuttuu tai mitä voisi tehdä paremmin?',
            en: 'What is missing or what could be better?',
        },
    },
    other: {
        icon: IconMessage,
        label: { fi: 'Muu', en: 'Other' },
        placeholder: { fi: 'Kirjoita viestisi.', en: 'Write your message.' },
    },
};

function technicalInfo(path) {
    const width = typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : '';
    const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;
    return [
        `Versio ${APP_VERSION}`,
        `Näkymä ${path || '/'}`,
        `Ikkuna ${width}${standalone ? ' (asennettu)' : ''}`,
        typeof navigator !== 'undefined' ? navigator.userAgent : '',
    ].filter(Boolean).join('\n');
}

export default function FeedbackModal({ isOpen, onClose, language, path, zIndex = 99000 }) {
    const fi = language !== 'en';
    const lang = fi ? 'fi' : 'en';

    const [type, setType] = useState('bug');
    const [message, setMessage] = useState('');
    const [contact, setContact] = useState('');
    const [attachInfo, setAttachInfo] = useState(true);
    const [website, setWebsite] = useState(''); // roskapostiansa, ihminen ei näe kenttää
    const [state, setState] = useState({ status: 'idle', error: null });

    const reset = () => {
        setType('bug');
        setMessage('');
        setContact('');
        setAttachInfo(true);
        setWebsite('');
        setState({ status: 'idle', error: null });
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const contactValid = !contact || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim());
    const tooShort = message.trim().length < MIN_LENGTH;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (tooShort) {
            setState({ status: 'error', error: fi ? `Kirjoita vähintään ${MIN_LENGTH} merkkiä.` : `Write at least ${MIN_LENGTH} characters.` });
            return;
        }
        if (!contactValid) {
            setState({ status: 'error', error: fi ? 'Tarkista sähköpostiosoite tai jätä kenttä tyhjäksi.' : 'Check the email address or leave it empty.' });
            return;
        }

        setState({ status: 'sending', error: null });
        try {
            await api.sendFeedback({
                type,
                message: message.trim(),
                contact: contact.trim(),
                technical: type === 'bug' && attachInfo ? technicalInfo(path) : '',
                website,
            });
            setState({ status: 'sent', error: null });
        } catch (error) {
            setState({ status: 'error', error: error.message || (fi ? 'Lähetys epäonnistui. Yritä hetken päästä uudelleen.' : 'Sending failed. Please try again shortly.') });
        }
    };

    const sending = state.status === 'sending';

    return (
        <Sheet isOpen={isOpen} onClose={handleClose} zIndex={zIndex} title={fi ? 'Palaute' : 'Feedback'} subtitle={fi ? 'Viesti menee suoraan kehittäjälle' : 'Your message goes straight to the developer'}>
            {state.status === 'sent' ? (
                <div className="feedback-done">
                    <IconCircleCheck size={40} stroke={1.6} aria-hidden="true" />
                    <p className="feedback-done-title">{fi ? 'Kiitos, viesti on lähetetty.' : 'Thank you, your message was sent.'}</p>
                    <p className="panel-hint">
                        {contact
                            ? (fi ? 'Vastaan sähköpostiisi, jos asia sitä vaatii.' : 'I will reply by email if needed.')
                            : (fi ? 'Luen jokaisen palautteen.' : 'I read every message.')}
                    </p>
                    <div className="feedback-done-actions">
                        <button type="button" className="chip" onClick={reset}>{fi ? 'Uusi viesti' : 'New message'}</button>
                        <button type="button" className="primary-btn" onClick={handleClose}>{fi ? 'Sulje' : 'Close'}</button>
                    </div>
                </div>
            ) : (
                <form className="form feedback-form" onSubmit={handleSubmit} noValidate>
                    <div className="field">
                        <span className="field-label">{fi ? 'Aihe' : 'Topic'}</span>
                        <Segmented
                            label={fi ? 'Palautteen aihe' : 'Feedback topic'}
                            value={type}
                            onChange={setType}
                            options={Object.entries(TYPES).map(([value, t]) => ({ value, label: t.label[lang], icon: t.icon }))}
                        />
                    </div>

                    <label className="field">
                        <span className="field-label">
                            {fi ? 'Viesti' : 'Message'}
                            <span className={`field-count ${message.length > MAX_LENGTH * 0.9 ? 'is-near' : ''}`}>{message.length}/{MAX_LENGTH}</span>
                        </span>
                        <textarea
                            rows="6"
                            className="field-input field-textarea"
                            placeholder={TYPES[type].placeholder[lang]}
                            value={message}
                            maxLength={MAX_LENGTH}
                            onChange={(e) => setMessage(e.target.value)}
                            disabled={sending}
                            required
                        />
                    </label>

                    <label className="field">
                        <span className="field-label">{fi ? 'Sähköposti (vapaaehtoinen)' : 'Email (optional)'}</span>
                        <input
                            type="email"
                            className={`field-input ${contactValid ? '' : 'is-invalid'}`}
                            placeholder={fi ? 'Jos haluat vastauksen' : 'If you would like a reply'}
                            value={contact}
                            onChange={(e) => setContact(e.target.value)}
                            disabled={sending}
                            autoComplete="email"
                            inputMode="email"
                        />
                    </label>

                    {/* Roskapostiansa: piilotettu kenttä, jonka vain botit täyttävät. */}
                    <input
                        type="text"
                        name="website"
                        className="hp-field"
                        tabIndex={-1}
                        autoComplete="off"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        aria-hidden="true"
                    />

                    {type === 'bug' && (
                        <label className="check-field">
                            <input type="checkbox" checked={attachInfo} onChange={(e) => setAttachInfo(e.target.checked)} disabled={sending} />
                            <span>
                                {fi ? 'Liitä tekniset tiedot' : 'Attach technical details'}
                                <span className="check-hint">{fi ? 'Versio, avoin näkymä, ikkunan koko ja selain' : 'Version, open view, window size and browser'}</span>
                            </span>
                        </label>
                    )}

                    {state.status === 'error' && (
                        <p className="form-status is-error" role="alert">
                            <IconAlertTriangle size={16} stroke={2} aria-hidden="true" /> {state.error}
                        </p>
                    )}

                    <button type="submit" className="primary-btn" disabled={sending || tooShort}>
                        <IconSend size={16} stroke={2} aria-hidden="true" />
                        {sending ? (fi ? 'Lähetetään…' : 'Sending…') : (fi ? 'Lähetä' : 'Send')}
                    </button>

                    <p className="about-note">
                        {fi
                            ? 'Viesti toimitetaan sähköpostina kehittäjälle. Muuta tietoa ei tallenneta.'
                            : 'Your message is delivered by email to the developer. Nothing else is stored.'}
                    </p>
                </form>
            )}
        </Sheet>
    );
}
