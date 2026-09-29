import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Alhaalta liukuva paneeli, joka korvaa koko ruudun peittävät modaalit.
 *
 * Miksi tämä on parempi kuin vanha ratkaisu:
 *   - Paneeli liukuu alhaalta ja jättää taustan näkyviin, joten käyttäjä pysyy
 *     kartalla siitä mistä tuli. Vanhat modaalit ilmestyivät mustana seinänä.
 *   - Paneelin voi vetää alas kiinni peukalolla. Vanhassa ruksi oli ruudun
 *     oikeassa yläkulmassa, eli juuri siellä minne peukalo ei yllä.
 *   - Työpöydällä sama komponentti näkyy keskitettynä korttina.
 *
 * Vetämisen toteutus on tarkoituksella pointer-tapahtumilla eikä kirjastolla:
 * se on ~40 riviä ja pitää bundlen pienenä.
 */

const DRAG_CLOSE_THRESHOLD = 110; // px, jonka jälkeen paneeli sulkeutuu
const DRAG_VELOCITY_THRESHOLD = 0.5; // px/ms, nopea heitto sulkee lyhyemmälläkin matkalla

const Sheet = ({
    isOpen,
    onClose,
    title,
    subtitle,
    accent,
    zIndex = 99000,
    size = 'default', // 'default' | 'full'
    headerExtra,
    children,
}) => {
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const panelRef = useRef(null);
    const scrollRef = useRef(null);
    const dragState = useRef(null);

    // Taustan vieritys lukkoon ja Esc sulkee.
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

    useEffect(() => {
        if (!isOpen) setDragOffset(0);
    }, [isOpen]);

    const handlePointerDown = useCallback((event) => {
        // Vetäminen aloitetaan vain jos sisältö on jo ylhäällä — muuten
        // käyttäjän tarkoitus on vierittää sisältöä, ei sulkea paneelia.
        if (scrollRef.current && scrollRef.current.scrollTop > 0) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        dragState.current = { startY: event.clientY, startTime: Date.now(), pointerId: event.pointerId };
        setIsDragging(true);
    }, []);

    const handlePointerMove = useCallback((event) => {
        const state = dragState.current;
        if (!state || event.pointerId !== state.pointerId) return;

        const delta = event.clientY - state.startY;
        // Ylöspäin vetäminen ei venytä paneelia; vastus tekee liikkeestä luonnollisen.
        setDragOffset(delta > 0 ? delta : delta / 4);
    }, []);

    const endDrag = useCallback((event) => {
        const state = dragState.current;
        if (!state || (event && event.pointerId !== state.pointerId)) return;

        const distance = dragOffset;
        const elapsed = Math.max(1, Date.now() - state.startTime);
        const velocity = distance / elapsed;

        dragState.current = null;
        setIsDragging(false);

        if (distance > DRAG_CLOSE_THRESHOLD || velocity > DRAG_VELOCITY_THRESHOLD) {
            onClose();
        } else {
            setDragOffset(0);
        }
    }, [dragOffset, onClose]);

    if (!isOpen) return null;

    // Kun paneelia vedetään, taustan tummuus vaalenee samassa suhteessa.
    const backdropOpacity = Math.max(0, 1 - Math.max(0, dragOffset) / 400);

    return (
        <div
            className="sheet-root"
            style={{ zIndex }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <button
                type="button"
                className="sheet-backdrop"
                style={{ opacity: backdropOpacity }}
                onClick={onClose}
                aria-label="Sulje"
                tabIndex={-1}
            />

            <div
                ref={panelRef}
                className={`sheet-panel ${size === 'full' ? 'is-full' : ''} ${isDragging ? 'is-dragging' : ''}`}
                style={{
                    transform: dragOffset ? `translateY(${dragOffset}px)` : undefined,
                    '--sheet-accent': accent || 'var(--accent)',
                }}
            >
                <div
                    className="sheet-grip-area"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                >
                    <div className="sheet-grip" aria-hidden="true" />

                    <header className="sheet-header">
                        <div className="sheet-titles">
                            {title && <h2 className="sheet-title">{title}</h2>}
                            {subtitle && <p className="sheet-subtitle">{subtitle}</p>}
                        </div>

                        <div className="sheet-header-actions">
                            {headerExtra}
                            <button
                                type="button"
                                className="sheet-close"
                                onClick={onClose}
                                aria-label="Sulje"
                            >
                                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                                    <path
                                        d="M4 4l10 10M14 4L4 14"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </button>
                        </div>
                    </header>
                </div>

                <div className="sheet-body" ref={scrollRef}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Sheet;
