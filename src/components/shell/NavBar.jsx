import React, { useEffect, useRef, useState } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import { SECTIONS, sectionOf } from '../../router/routes';

/**
 * Alapalkki ja minivalikot — evohall-3d:n kuori jääkiekkoon sovitettuna.
 *
 * Palkki kelluu lasisena sisällön päällä eikä vie omaa riviä. Osio, jolla on
 * alakohtia (Taulukot, Tilastot, Lisää), ei avaa näkymää suoraan vaan
 * nostaa palkin yläpuolelle läpikuultavan minivalikon. Näin käyttäjä valitsee
 * heti mitä hakee, eikä joudu ensin yleisnäkymään ja sieltä eteenpäin.
 *
 * Sama nappi uudelleen, Esc tai napautus valikon ulkopuolelle sulkee.
 */
export default function NavBar({ path, language, onNavigate, onAction }) {
    // Valikko muistaa näkymän, jossa se avattiin. Kun näkymä vaihtuu (myös
    // selaimen takaisin-napilla), valikko on automaattisesti kiinni ilman
    // erillistä sulkemista.
    const [open, setOpen] = useState(null);
    const openId = open && open.path === path ? open.id : null;
    const menuRef = useRef(null);
    const triggerRefs = useRef({});
    const lang = language === 'en' ? 'en' : 'fi';

    const openSection = SECTIONS.find((s) => s.id === openId) ?? null;
    const activeId = openId ?? sectionOf(path);

    const close = () => setOpen(null);

    // Esc sulkee ja palauttaa kohdistuksen nappiin, josta valikko avattiin.
    useEffect(() => {
        if (!openId) return undefined;
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            triggerRefs.current[openId]?.focus();
            setOpen(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [openId]);

    // Näppäimistön käyttäjälle kohdistus valikon ensimmäiseen kohtaan.
    useEffect(() => {
        if (openId) menuRef.current?.querySelector('button')?.focus({ preventScroll: true });
    }, [openId]);

    const onSection = (section) => {
        if (section.items) {
            setOpen(openId === section.id ? null : { id: section.id, path });
        } else {
            setOpen(null);
            onNavigate(section.path);
        }
    };

    const onItem = (item) => {
        setOpen(null);
        if (item.action) onAction(item.action);
        else onNavigate(item.path);
    };

    return (
        <>
            {openSection && (
                <>
                    {/* Näkymätön taso valikon alla: napautus muualle sulkee. */}
                    <button
                        type="button"
                        className="navmenu-scrim"
                        aria-label={lang === 'fi' ? 'Sulje valikko' : 'Close menu'}
                        tabIndex={-1}
                        onClick={close}
                    />
                    <div
                        ref={menuRef}
                        className="navmenu glass"
                        role="menu"
                        aria-label={openSection.label[lang]}
                        id={`navmenu-${openSection.id}`}
                    >
                        <div className="navmenu-title">{openSection.label[lang]}</div>
                        {openSection.items.map((item) => {
                            const Icon = item.icon;
                            const current = item.path && item.path === path;
                            return (
                                <button
                                    key={item.path ?? item.action}
                                    type="button"
                                    role="menuitem"
                                    className={`navmenu-item ${current ? 'is-current' : ''}`}
                                    aria-current={current ? 'page' : undefined}
                                    onClick={() => onItem(item)}
                                >
                                    <Icon size={20} stroke={1.8} className="navmenu-icon" aria-hidden="true" />
                                    <span className="navmenu-text">
                                        <span className="navmenu-label">{item.label[lang]}</span>
                                        {item.hint && <span className="navmenu-hint">{item.hint[lang]}</span>}
                                    </span>
                                    <IconChevronRight size={16} stroke={1.8} className="navmenu-chevron" aria-hidden="true" />
                                </button>
                            );
                        })}
                    </div>
                </>
            )}

            <nav className="navbar glass" aria-label={lang === 'fi' ? 'Päävalikko' : 'Main menu'}>
                {SECTIONS.map((section) => {
                    const Icon = section.icon;
                    const active = activeId === section.id;
                    return (
                        <button
                            key={section.id}
                            ref={(el) => { triggerRefs.current[section.id] = el; }}
                            type="button"
                            className={`navbar-item ${active ? 'is-active' : ''}`}
                            onClick={() => onSection(section)}
                            aria-haspopup={section.items ? 'menu' : undefined}
                            aria-expanded={section.items ? openId === section.id : undefined}
                            aria-controls={section.items && openId === section.id ? `navmenu-${section.id}` : undefined}
                            aria-current={!section.items && active ? 'page' : undefined}
                        >
                            <Icon size={21} stroke={1.8} aria-hidden="true" />
                            <span className="navbar-label">{section.label[lang]}</span>
                        </button>
                    );
                })}
            </nav>
        </>
    );
}
