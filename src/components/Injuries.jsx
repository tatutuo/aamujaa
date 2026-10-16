import React, { useMemo } from 'react';
import { IconFirstAidKit } from '@tabler/icons-react';
import { shortDate } from '../utils/format';
import { teamNickname } from '../utils/teams';
import { positionLabel } from '../utils/positions';
import { ESPN_POSITIONS, statusOf, typeOf } from '../utils/injuries';

/**
 * Loukkaantumisrivit: yhteinen loukkaantumisnäkymälle, joukkuekortille ja
 * ottelukortille.
 *
 * NHL ei julkaise loukkaantumistietoja, joten lähde on ESPN. Tiedot eivät
 * ole virallisia, ja paluuarviot ovat arvioita — siksi ne näytetään
 * "arvio"-sanalla eikä varmana päivänä.
 */

export function InjuryRow({ row, lang, showTeam, onClick }) {
    const fi = lang === 'fi';
    const status = statusOf(row, lang);
    const type = typeOf(row, lang);
    const Tag = onClick ? 'button' : 'div';

    return (
        <Tag type={onClick ? 'button' : undefined} className="inj-row" onClick={onClick}>
            <span className="dt-person-text">
                <span className="dt-name">{row.name}</span>
                <span className="dt-meta">
                    {[showTeam && `${row.team} ${teamNickname(row.team)}`, positionLabel(ESPN_POSITIONS[row.pos] ?? row.pos, lang), type].filter(Boolean).join(' · ')}
                </span>
            </span>
            <span className="inj-side">
                <span className={`inj-status tone-${status.tone}`}>{status.label}</span>
                <span className="inj-return">
                    {row.returnDate ? `${fi ? 'arvio' : 'est.'} ${shortDate(row.returnDate, lang)}` : (fi ? 'ei arviota' : 'no estimate')}
                </span>
            </span>
        </Tag>
    );
}

/**
 * Yhden tai useamman joukkueen poissaolot otsikoineen. `rows` = useInjuries()
 * -tulos; null tarkoittaa, että haku on kesken tai epäonnistui, jolloin
 * mitään ei näytetä (poissaolot ovat lisätieto, eivät pääsisältö).
 */
export function TeamInjuries({ rows, teams, lang, onPlayerClick, emptyText }) {
    const fi = lang === 'fi';
    const groups = useMemo(
        () => (rows ? teams.map((team) => ({ team, list: rows.filter((r) => r.team === team) })) : []),
        [rows, teams],
    );
    if (!rows) return null;

    return groups.map(({ team, list }) => (
        <section key={team} className="card-section inj-card">
            <h3 className="card-section-title">
                <IconFirstAidKit size={13} stroke={2} aria-hidden="true" />{' '}
                {fi ? 'Sivussa' : 'Out'}{teams.length > 1 ? ` · ${team}` : ''} ({list.length})
            </h3>
            {list.length === 0 ? (
                <p className="panel-hint">{emptyText ?? (fi ? 'Ei tiedossa olevia poissaoloja.' : 'No known absences.')}</p>
            ) : (
                <ul className="team-games">
                    {list.map((r) => (
                        <li key={`${r.team}:${r.name}`}>
                            <InjuryRow row={r} lang={lang} onClick={r.id ? () => onPlayerClick(r.id) : undefined} />
                        </li>
                    ))}
                </ul>
            )}
        </section>
    ));
}
