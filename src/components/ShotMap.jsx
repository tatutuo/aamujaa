import React, { useState } from 'react';
import { teamColors } from '../utils/teamColors';
import Chips from './ui/Chips';

/**
 * Laukauskartta.
 *
 * Kaukalo piirretään SVG:nä oikeassa mittakaavassa: 200 × 85 jalkaa, maalit
 * kohdissa x = ±89. Backend on jo normalisoinut koordinaatit niin, että
 * kotijoukkue hyökkää oikealle ja vieras vasemmalle riippumatta siitä missä
 * päädyssä joukkue kulloinkin pelasi.
 *
 * Näkyviin valitaan tarkoituksella vain neljä tapahtumatyyppiä. Kaikki
 * yhtaikaa piirrettynä kartta menee puuroksi.
 */

const RINK = { width: 200, height: 85 };
const GOAL_X = 89;

/** Piirtokoko kasvaa hieman merkityksen mukaan: maali erottuu heti. */
const MARKER = {
    goal: 3.4,
    save: 2,
    miss: 1.7,
    blocked: 1.5,
};

const FILTERS = [
    { id: 'all', fi: 'Kaikki', en: 'All' },
    { id: 'goal', fi: 'Maalit', en: 'Goals' },
    { id: 'onGoal', fi: 'Maalille', en: 'On goal' },
];

const ShotMap = ({ data, language = 'fi', onPlayerClick }) => {
    const [filter, setFilter] = useState('all');
    const [selected, setSelected] = useState(null);

    if (!data?.shots?.length) {
        return <p className="empty-state">{language === 'fi' ? 'Ei laukausdataa.' : 'No shot data.'}</p>;
    }

    const { shots, homeTeam, awayTeam, summary } = data;

    const visible = shots.filter((s) => {
        if (filter === 'goal') return s.result === 'goal';
        if (filter === 'onGoal') return s.result === 'goal' || s.result === 'save';
        return true;
    });

    const colourOf = (shot) => {
        const abbrev = shot.isHome ? homeTeam : awayTeam;
        return teamColors[abbrev]?.[0] ?? 'var(--text-tertiary)';
    };

    return (
        <div className="shotmap">
            <div className="shotmap-filters">
                <Chips
                    label={language === 'fi' ? 'Laukaukset' : 'Shots'}
                    value={filter}
                    onChange={(v) => { setFilter(v); setSelected(null); }}
                    options={FILTERS.map((f) => ({ value: f.id, label: language === 'fi' ? f.fi : f.en }))}
                />
            </div>

            <div className="shotmap-teams">
                <span className="shotmap-team">
                    <span className="shotmap-dot" style={{ background: teamColors[awayTeam]?.[0] }} />
                    {awayTeam} · {summary.away.goals}/{summary.away.onGoal}
                </span>
                <span className="shotmap-team is-right">
                    {homeTeam} · {summary.home.goals}/{summary.home.onGoal}
                    <span className="shotmap-dot" style={{ background: teamColors[homeTeam]?.[0] }} />
                </span>
            </div>

            <svg
                className="shotmap-rink"
                viewBox={`${-RINK.width / 2} ${-RINK.height / 2} ${RINK.width} ${RINK.height}`}
                role="img"
                aria-label={language === 'fi' ? 'Laukauskartta' : 'Shot map'}
            >
                {/* Kaukalon ääriviiva pyöristetyin kulmin */}
                <rect
                    x={-RINK.width / 2} y={-RINK.height / 2}
                    width={RINK.width} height={RINK.height}
                    rx="28" className="rink-surface"
                />

                {/* Keskiviiva ja siniviivat */}
                <line x1="0" y1={-RINK.height / 2} x2="0" y2={RINK.height / 2} className="rink-line is-centre" />
                <line x1="-25" y1={-RINK.height / 2} x2="-25" y2={RINK.height / 2} className="rink-line is-blue" />
                <line x1="25" y1={-RINK.height / 2} x2="25" y2={RINK.height / 2} className="rink-line is-blue" />

                {/* Maaliviivat */}
                <line x1={-GOAL_X} y1={-38} x2={-GOAL_X} y2={38} className="rink-line is-goal" />
                <line x1={GOAL_X} y1={-38} x2={GOAL_X} y2={38} className="rink-line is-goal" />

                {/* Keskiympyrä ja aloituspisteet */}
                <circle cx="0" cy="0" r="15" className="rink-line is-centre" fill="none" />
                {[[-69, -22], [-69, 22], [69, -22], [69, 22]].map(([cx, cy]) => (
                    <circle key={`${cx},${cy}`} cx={cx} cy={cy} r="15" className="rink-line is-faceoff" fill="none" />
                ))}

                {/* Maalit */}
                <rect x={-GOAL_X - 3} y="-3" width="3" height="6" className="rink-net" />
                <rect x={GOAL_X} y="-3" width="3" height="6" className="rink-net" />

                {/* Laukaukset. Piirtojärjestys: maalit viimeisenä päällimmäisiksi. */}
                {[...visible]
                    .sort((a, b) => MARKER[a.result] - MARKER[b.result])
                    .map((shot, i) => (
                        <circle
                            key={`${shot.eventId}-${i}`}
                            cx={shot.x}
                            cy={shot.y}
                            r={MARKER[shot.result]}
                            fill={shot.result === 'goal' ? colourOf(shot) : 'none'}
                            stroke={colourOf(shot)}
                            strokeWidth={shot.result === 'goal' ? 1.2 : 1}
                            className={`shot is-${shot.result} ${selected?.eventId === shot.eventId ? 'is-selected' : ''}`}
                            onClick={() => setSelected(shot)}
                        />
                    ))}
            </svg>

            {selected ? (
                <div className="shotmap-detail">
                    <div className="shotmap-detail-main">
                        <button
                            type="button"
                            className="shotmap-shooter"
                            onClick={() => selected.shooterId && onPlayerClick?.(selected.shooterId)}
                            disabled={!selected.shooterId}
                        >
                            {selected.shooterName ?? '—'}
                        </button>
                        <span className="shotmap-detail-meta">
                            {selected.period}. {language === 'fi' ? 'erä' : 'period'} {selected.time} ·{' '}
                            {selected.distance} ft · {selected.shotType ?? '—'}
                        </span>
                    </div>

                    {selected.highlightUrl && (
                        <a
                            className="shotmap-video"
                            href={selected.highlightUrl}
                            target="_blank"
                            rel="noreferrer"
                        >
                            ▶ {language === 'fi' ? 'Katso maali' : 'Watch goal'}
                        </a>
                    )}
                </div>
            ) : (
                <p className="shotmap-hint">
                    {language === 'fi'
                        ? 'Napauta laukausta nähdäksesi tiedot.'
                        : 'Tap a shot to see details.'}
                </p>
            )}

            <ul className="shotmap-legend">
                <li><span className="legend-marker is-goal" /> {language === 'fi' ? 'Maali' : 'Goal'}</li>
                <li><span className="legend-marker is-save" /> {language === 'fi' ? 'Torjuttu' : 'Saved'}</li>
                <li><span className="legend-marker is-miss" /> {language === 'fi' ? 'Ohi' : 'Missed'}</li>
                <li><span className="legend-marker is-blocked" /> {language === 'fi' ? 'Blokattu' : 'Blocked'}</li>
            </ul>
        </div>
    );
};

export default ShotMap;
