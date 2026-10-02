import React from 'react';
import { IconFirstAidKit } from '@tabler/icons-react';
import { positionLabel } from '../utils/positions';
import { teamColors, DEFAULT_TEAM_COLORS } from '../utils/teamColors';

/**
 * Kentälliset: ketjut, puolustajaparit, yli- ja alivoimakentät sekä
 * maalivahdit. Data lasketaan palvelimella ottelun vaihdoista
 * (services/lines.js), joten se kertoo miten oikeasti pelattiin.
 *
 * Jokainen pelaaja on pelipaita joukkueen väreissä: numero paidassa,
 * sukunimi ja pelipaikka alla. Ketjut asettuvat sarakkeisiin kuin
 * kokoonpanokortissa (vasen laita – keskushyökkääjä – oikea laita).
 *
 * `injured` = Map pelaaja-ID → poissaolon tila. Merkitään, jos ketjun
 * pelaaja on nyt sivussa (joukkuekortin "viimeisin ottelu" -näkymä).
 */

const initialOf = (name) => (/^\S+\.\s/.test(name ?? '') ? name.split(' ')[0] : '');
const surnameOf = (name) => (initialOf(name) ? name.slice(initialOf(name).length + 1) : (name ?? ''));

const mmss = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Suhteellinen kirkkaus (0–1): vaalealle paidalle tumma numero. */
function luminance(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
    if (!m) return 0;
    const n = parseInt(m[1], 16);
    const channel = (c) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Pelipaita: vartalo, hihat ja kaulus. Numero keskellä rintaa. */
function Jersey({ number, team }) {
    const [primary, secondary] = teamColors[team] ?? DEFAULT_TEAM_COLORS;
    const lum = luminance(primary);
    const light = lum > 0.45;
    // Hyvin tumma paita (LAK, PIT) katoaisi tummaan taustaan: vaalea ääriviiva.
    const outline = lum < 0.03 ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';
    return (
        <svg className="ln-jersey" viewBox="0 0 64 56" aria-hidden="true">
            <path
                d="M22 3 L27 3 Q32 9 37 3 L42 3 L60 14 L54 27 L46 23 L46 53 L18 53 L18 23 L10 27 L4 14 Z"
                fill={primary}
                stroke={outline}
                strokeWidth="1.2"
                strokeLinejoin="round"
            />
            {/* Hihan ja helman raidat toisella värillä. */}
            <path d="M8 21 L13 24 M56 21 L51 24" stroke={secondary} strokeWidth="3" strokeLinecap="round" />
            <path d="M18 47 L46 47" stroke={secondary} strokeWidth="3" />
            <path d="M27 3 Q32 9 37 3" fill="none" stroke={secondary} strokeWidth="2.4" />
            <text
                x="32"
                y="38"
                textAnchor="middle"
                className="ln-jersey-number"
                fill={light ? '#111418' : '#ffffff'}
                stroke={light ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'}
                strokeWidth="0.8"
                paintOrder="stroke"
            >
                {number ?? ''}
            </text>
        </svg>
    );
}

function PlayerCell({ player, lang, injured, onPlayerClick }) {
    const fi = lang === 'fi';
    const out = injured?.get(player.id);
    return (
        <button
            type="button"
            className={`ln-player ${out ? 'is-out' : ''}`}
            onClick={() => onPlayerClick(player.id)}
            title={`${player.name}${out ? ` · ${fi ? 'sivussa' : 'out'}: ${out.status}` : ''}`}
        >
            <span className="ln-jersey-wrap">
                <Jersey number={player.number} team={player.team} />
                {out && (
                    <span className="ln-out" aria-label={fi ? 'sivussa' : 'out'}>
                        <IconFirstAidKit size={11} stroke={2.4} />
                    </span>
                )}
            </span>
            <span className="ln-name">{surnameOf(player.name)}</span>
            <span className="ln-pos">{positionLabel(player.pos, lang)}</span>
        </button>
    );
}

function Group({ title, rows, lang, injured, onPlayerClick }) {
    if (!rows?.length) return null;
    const fi = lang === 'fi';
    return (
        <section className="ln-group">
            <h3 className="card-section-title">{title}</h3>
            <ol className="ln-list">
                {rows.map((row, i) => (
                    <li key={row.players.map((p) => p.id).join('-')} className="ln-row">
                        <span className="ln-head">
                            <span className="ln-index">{i + 1}.</span>
                            <span className="ln-time num" title={fi ? 'Yhteinen peliaika' : 'Time together'}>{mmss(row.seconds)}</span>
                        </span>
                        <span className="ln-players">
                            {row.players.map((p) => (
                                <PlayerCell key={p.id} player={p} lang={lang} injured={injured} onPlayerClick={onPlayerClick} />
                            ))}
                        </span>
                    </li>
                ))}
            </ol>
        </section>
    );
}

export default function LinesView({ lines, lang, injured, onPlayerClick }) {
    const fi = lang === 'fi';
    if (!lines) return <p className="panel-hint">{fi ? 'Kentällisiä ei saatu laskettua tästä ottelusta.' : 'Lines are not available for this game.'}</p>;

    return (
        <div className="ln">
            <Group title={fi ? 'Hyökkäysketjut (5v5)' : 'Forward lines (5v5)'} rows={lines.forwards} lang={lang} injured={injured} onPlayerClick={onPlayerClick} />
            <Group title={fi ? 'Puolustajaparit (5v5)' : 'Defence pairs (5v5)'} rows={lines.defence} lang={lang} injured={injured} onPlayerClick={onPlayerClick} />
            <Group title={fi ? 'Ylivoima' : 'Power play'} rows={lines.powerPlay} lang={lang} injured={injured} onPlayerClick={onPlayerClick} />
            <Group title={fi ? 'Alivoima' : 'Penalty kill'} rows={lines.penaltyKill} lang={lang} injured={injured} onPlayerClick={onPlayerClick} />

            {lines.goalies?.length > 0 && (
                <section className="ln-group">
                    <h3 className="card-section-title">{fi ? 'Maalivahdit' : 'Goalies'}</h3>
                    <div className="ln-list ln-goalies">
                        {lines.goalies.map((g) => (
                            <span key={g.id} className="ln-goalie">
                                <PlayerCell player={g} lang={lang} injured={injured} onPlayerClick={onPlayerClick} />
                                <span className="ln-role">{g.starter ? (fi ? 'aloitti' : 'started') : (fi ? 'vaihtoaitio' : 'backup')}</span>
                            </span>
                        ))}
                    </div>
                </section>
            )}

            <p className="source-note">
                {fi
                    ? 'Laskettu NHL:n vaihtotiedoista: ketju on kolmikko, joka pelasi eniten yhdessä tasakentin. Aika on yhteinen peliaika.'
                    : 'Computed from NHL shift data: a line is the trio that played the most together at 5v5. Time is shared ice time.'}
            </p>
        </div>
    );
}
