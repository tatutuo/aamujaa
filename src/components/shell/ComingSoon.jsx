import React from 'react';
import ViewHeader from './ViewHeader';

/**
 * Väliaikainen näkymä osille, jotka rakennetaan myöhemmissä vaiheissa.
 * Kertoo mitä näkymään on tulossa, jottei tyhjä sivu näytä rikkinäiseltä.
 */
export default function ComingSoon({ route, language }) {
    const fi = language !== 'en';
    return (
        <div className="view">
            <ViewHeader icon={route.icon} title={route.label[fi ? 'fi' : 'en']} subtitle={route.hint?.[fi ? 'fi' : 'en']} />
            <div className="empty-panel">
                <p>{fi ? 'Tämä näkymä on työn alla.' : 'This view is being built.'}</p>
            </div>
        </div>
    );
}
