import React from 'react';

/** Näkymän otsikko: iso nimi, pieni alaotsikko ja oikealle mahtuvat valinnat. */
export default function ViewHeader({ icon: Icon, title, subtitle, children }) {
    return (
        <div className="view-header">
            <div className="view-header-text">
                <h1 className="view-title">
                    {Icon && <Icon size={22} stroke={1.8} className="view-title-icon" aria-hidden="true" />}
                    {title}
                </h1>
                {subtitle && <p className="view-subtitle">{subtitle}</p>}
            </div>
            {children && <div className="view-header-actions">{children}</div>}
        </div>
    );
}
