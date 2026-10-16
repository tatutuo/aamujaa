import React, { useMemo } from 'react';
import { chartColor, pairColors } from '../../utils/chartColors';

/**
 * Kierroksen datan kaaviot. Piirretty itse SVG:nä: kirjastoa ei tarvita
 * näin muutamaan kaavioon, ja värit tulevat suoraan teeman muuttujista,
 * joten kaaviot toimivat sekä tummassa että vaaleassa teemassa.
 *
 * Kaikki kaaviot skaalautuvat leveyden mukaan (viewBox), joten sama piirros
 * toimii puhelimessa ja tietokoneella.
 */

const niceMax = (value, step) => Math.max(step, Math.ceil(value / step) * step);

// ---------------------------------------------------------------------------
// Laukaukset vs. maalit joukkueittain
// ---------------------------------------------------------------------------

/**
 * Jokainen joukkue pisteenä: vaaka-akselilla laukaukset maalia kohti,
 * pystyakselilla maalit. Katkoviivat ovat laukaisuprosentteja: viivan
 * yläpuolella oleva joukkue teki maaleja laukauksiinsa nähden paljon.
 */
export function ShotsGoalsScatter({ teams, lang, onTeamClick, metric = 'sog' }) {
    const fi = lang === 'fi';
    const isXg = metric === 'xg';
    const W = 340;
    const H = 240;
    const pad = { l: 30, r: 14, t: 12, b: 34 };
    const valueOf = (t) => (isXg ? t.xg : t.sog) ?? 0;
    const values = teams.map(valueOf);
    const maxGoals = Math.max(...teams.map((t) => t.goals));

    let xMin;
    let xMax;
    let yMax;
    let xStep;
    if (isXg) {
        // Sama mittakaava molemmilla akseleilla, jotta lävistäjä on 45°.
        yMax = Math.max(5, maxGoals + 1, Math.ceil(Math.max(...values) + 0.5));
        xMin = 0;
        xMax = yMax;
        xStep = yMax > 8 ? 2 : 1;
    } else {
        // Akseli alkaa vähän pienimmän laukausmäärän alta: nollasta alkava
        // akseli ahtaisi kaikki joukkueet kaavion oikeaan reunaan.
        xMin = Math.max(0, Math.floor((Math.min(...values) - 3) / 5) * 5);
        xMax = niceMax(Math.max(...values, xMin + 15) + 2, 5);
        yMax = Math.max(6, maxGoals + 1);
        xStep = xMax - xMin > 30 ? 10 : 5;
    }
    const x = (v) => pad.l + ((v - xMin) / (xMax - xMin)) * (W - pad.l - pad.r);
    const y = (v) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);

    const xTicks = Array.from({ length: Math.floor((xMax - xMin) / xStep) + 1 }, (_, i) => xMin + i * xStep);
    const yTicks = Array.from({ length: yMax + 1 }, (_, i) => i).filter((v) => yMax <= 8 || v % 2 === 0);
    // Laukauksissa laukaisuprosentit, xG:ssä lävistäjä maalit = odotetut.
    const guides = isXg ? [1] : [0.05, 0.1, 0.15, 0.2];

    /*
     * Päällekkäiset pallot erilleen: muutama kierros, jossa liian lähekkäiset
     * työnnetään toisistaan poispäin. Pallo voi siirtyä hieman oikealta
     * paikaltaan, mutta jokainen joukkue erottuu.
     */
    const placed = (() => {
        const r = 11;
        const pts = teams.map((t) => ({ ...t, px: x(valueOf(t)), py: y(t.goals) }));
        for (let iter = 0; iter < 40; iter++) {
            let moved = false;
            for (let i = 0; i < pts.length; i++) {
                for (let j = i + 1; j < pts.length; j++) {
                    const dx = pts[j].px - pts[i].px;
                    const dy = pts[j].py - pts[i].py;
                    const d = Math.hypot(dx, dy);
                    if (d >= r * 2) continue;
                    const push = (r * 2 - d) / 2 + 0.2;
                    // Samassa kohdassa olevat erotetaan vaakasuunnassa.
                    const ux = d > 0.01 ? dx / d : (j % 2 ? 1 : -1);
                    const uy = d > 0.01 ? dy / d : 0;
                    pts[i].px -= ux * push;
                    pts[i].py -= uy * push;
                    pts[j].px += ux * push;
                    pts[j].py += uy * push;
                    moved = true;
                }
            }
            if (!moved) break;
        }
        return pts;
    })();

    return (
        <svg className="rd-chart" viewBox={`0 0 ${W} ${H}`} role="img"
            aria-label={isXg ? (fi ? 'Odotetut maalit ja maalit' : 'Expected goals and goals') : (fi ? 'Joukkueiden laukaukset ja maalit' : 'Team shots and goals')}>
            {yTicks.map((v) => (
                <g key={`y${v}`}>
                    <line className="rd-grid" x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} />
                    <text className="rd-axis" x={pad.l - 6} y={y(v) + 3} textAnchor="end">{v}</text>
                </g>
            ))}
            {xTicks.map((v) => (
                <text key={`x${v}`} className="rd-axis" x={x(v)} y={H - pad.b + 14} textAnchor="middle">{v}</text>
            ))}
            {guides.map((p) => {
                const endX = Math.min(xMax, yMax / p);
                if (endX <= xMin) return null;
                return (
                    <g key={p}>
                        <line className="rd-guide" x1={x(xMin)} y1={y(xMin * p)} x2={x(endX)} y2={y(endX * p)} />
                        <text className="rd-guide-label" x={x(endX) - 2} y={y(endX * p) - 4} textAnchor="end">
                            {isXg ? (fi ? 'maalit = xG' : 'goals = xG') : `${Math.round(p * 100)} %`}
                        </text>
                    </g>
                );
            })}
            <text className="rd-axis-title" x={(W + pad.l) / 2} y={H - 4} textAnchor="middle">
                {isXg ? (fi ? 'Odotetut maalit (xG)' : 'Expected goals (xG)') : (fi ? 'Laukaukset maalia kohti' : 'Shots on goal')}
            </text>
            <text className="rd-axis-title" x={10} y={(H - pad.b + pad.t) / 2} textAnchor="middle"
                transform={`rotate(-90 10 ${(H - pad.b + pad.t) / 2})`}>
                {fi ? 'Maalit' : 'Goals'}
            </text>
            {placed.map((t) => (
                <g key={`${t.gameId}-${t.team}`} className="rd-dot" onClick={() => onTeamClick?.(t)}
                    transform={`translate(${t.px} ${t.py})`}>
                    <title>{isXg
                        ? `${t.team}: ${t.goals} ${fi ? 'maalia' : 'goals'}, xG ${(t.xg ?? 0).toFixed(2)} (vs ${t.opponent})`
                        : `${t.team}: ${t.goals} ${fi ? 'maalia' : 'goals'}, ${t.sog} ${fi ? 'laukausta' : 'shots'} (vs ${t.opponent})`}</title>
                    <circle r="11" fill={chartColor(t.team)} className={t.won ? 'is-winner' : ''} />
                    <text className="rd-dot-label" y="3" textAnchor="middle">{t.team}</text>
                </g>
            ))}
        </svg>
    );
}

// ---------------------------------------------------------------------------
// Maalit erittäin
// ---------------------------------------------------------------------------

const STRENGTHS = [
    { key: 'ev', fi: 'Tasakentin', en: 'Even strength', className: 'is-ev' },
    { key: 'pp', fi: 'Ylivoima', en: 'Power play', className: 'is-pp' },
    { key: 'sh', fi: 'Alivoima', en: 'Shorthanded', className: 'is-sh' },
    { key: 'en', fi: 'Tyhjiin', en: 'Empty net', className: 'is-en' },
];

export function GoalsByPeriod({ goals, lang }) {
    const fi = lang === 'fi';
    const buckets = useMemo(() => {
        const list = [
            { label: fi ? '1. erä' : '1st', counts: {} },
            { label: fi ? '2. erä' : '2nd', counts: {} },
            { label: fi ? '3. erä' : '3rd', counts: {} },
            { label: fi ? 'Jatkoaika' : 'OT', counts: {} },
        ];
        for (const g of goals) {
            if (g.periodType === 'SO') continue;
            const bucket = list[Math.min(g.period, 4) - 1];
            if (!bucket) continue;
            const kind = g.emptyNet ? 'en' : (g.strength === 'pp' || g.strength === 'sh' ? g.strength : 'ev');
            bucket.counts[kind] = (bucket.counts[kind] ?? 0) + 1;
        }
        return list.map((b) => ({ ...b, total: Object.values(b.counts).reduce((s, v) => s + v, 0) }));
    }, [goals, fi]);

    const shown = buckets[3].total > 0 ? buckets : buckets.slice(0, 3);
    const W = 340;
    const H = 190;
    const pad = { l: 14, r: 14, t: 20, b: 28 };
    const max = Math.max(4, ...shown.map((b) => b.total));
    const slot = (W - pad.l - pad.r) / shown.length;
    const barW = Math.min(56, slot * 0.55);
    const h = (v) => (v / max) * (H - pad.t - pad.b);

    return (
        <>
            <svg className="rd-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={fi ? 'Maalit erittäin' : 'Goals by period'}>
                <line className="rd-grid" x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} />
                {shown.map((b, i) => {
                    const cx = pad.l + slot * i + slot / 2;
                    let top = H - pad.b;
                    return (
                        <g key={b.label}>
                            {STRENGTHS.map((s) => {
                                const v = b.counts[s.key] ?? 0;
                                if (!v) return null;
                                top -= h(v);
                                return <rect key={s.key} className={`rd-bar ${s.className}`} x={cx - barW / 2} y={top} width={barW} height={Math.max(h(v) - 1.5, 1)} rx="3" />;
                            })}
                            <text className="rd-bar-value" x={cx} y={H - pad.b - h(b.total) - 6} textAnchor="middle">{b.total}</text>
                            <text className="rd-axis" x={cx} y={H - pad.b + 16} textAnchor="middle">{b.label}</text>
                        </g>
                    );
                })}
            </svg>
            <ul className="rd-legend">
                {STRENGTHS.map((s) => (
                    <li key={s.key}><span className={`rd-swatch ${s.className}`} aria-hidden="true" />{s[lang === 'fi' ? 'fi' : 'en']}</li>
                ))}
            </ul>
        </>
    );
}

// ---------------------------------------------------------------------------
// Kärkilista palkkeina
// ---------------------------------------------------------------------------

export function LeaderBars({ rows, onPlayerClick, games }) {
    const max = Math.max(...rows.map((r) => r.value), 1);
    return (
        <ol className="rd-leaders">
            {rows.map((r, i) => (
                <li key={`${r.id}-${r.gameId}`}>
                    <button type="button" className="rd-leader" onClick={() => onPlayerClick(r.id)}>
                        <span className="rd-leader-rank num">{i + 1}</span>
                        <span className="rd-leader-name">
                            <span className="rd-leader-player">{r.name}</span>
                            <span className="rd-leader-meta">{r.team}{games?.get(r.gameId) ? ` · ${games.get(r.gameId)}` : ''}</span>
                        </span>
                        <span className="rd-leader-track" aria-hidden="true">
                            <span className="rd-leader-fill" style={{ width: `${Math.max(4, (r.value / max) * 100)}%`, background: chartColor(r.team) }} />
                        </span>
                        <span className="rd-leader-value num">{r.display}</span>
                    </button>
                </li>
            ))}
        </ol>
    );
}

// ---------------------------------------------------------------------------
// Ottelun joukkuetilastot vastakkain
// ---------------------------------------------------------------------------

/**
 * Jokainen tilasto yhtenä palkkina, joka jakautuu joukkueiden kesken niiden
 * osuuksien mukaan. Pienempi parempi -tilastoissa (menetykset) osuus
 * käännetään, jotta "isompi palkki = parempi" pätee aina.
 */
export function GameCompare({ game, rows, lang }) {
    const colors = pairColors(game.away.abbrev, game.home.abbrev);
    return (
        <div className="rd-compare">
            <div className="rd-compare-teams">
                <span style={{ color: colors.away }}>{game.away.abbrev}</span>
                <span style={{ color: colors.home }}>{game.home.abbrev}</span>
            </div>
            {rows.map((row) => {
                const a = row.away ?? 0;
                const h = row.home ?? 0;
                const total = a + h;
                let share = total > 0 ? a / total : 0.5;
                if (row.lowerIsBetter && total > 0) share = h / total;
                return (
                    <div key={row.key} className="rd-compare-row">
                        <span className="rd-compare-value num">{row.format ? row.format(row.awayRaw ?? a, lang) : a}</span>
                        <span className="rd-compare-mid">
                            <span className="rd-compare-label">{row.label}</span>
                            <span className="rd-compare-track">
                                <span className="rd-compare-fill" style={{ width: `${share * 100}%`, background: colors.away }} />
                                <span className="rd-compare-fill" style={{ width: `${(1 - share) * 100}%`, background: colors.home }} />
                            </span>
                        </span>
                        <span className="rd-compare-value num is-home">{row.format ? row.format(row.homeRaw ?? h, lang) : h}</span>
                    </div>
                );
            })}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Laukauskäyrä yhdestä ottelusta
// ---------------------------------------------------------------------------

const minuteOf = (shot) => {
    const [m, s] = String(shot.time ?? '0:00').split(':').map(Number);
    return (shot.period - 1) * 20 + m + (s || 0) / 60;
};

/**
 * Kumulatiiviset laukaukset maalia kohti ottelun kuluessa. Jyrkkä nousu
 * kertoo painostuksesta; maalit on merkitty pisteinä käyrälle.
 */
export function ShotTimeline({ shots, away, home, lang, mode = 'shots' }) {
    const fi = lang === 'fi';
    const isXg = mode === 'xg';
    const colors = pairColors(away, home);
    // Laukauksissa jokainen maalia kohti mennyt on +1; xG-käyrässä jokainen
    // torjumaton laukaus nostaa käyrää oman maalitodennäköisyytensä verran.
    const events = shots
        .filter((s) => (isXg ? s.xg != null : s.result === 'goal' || s.result === 'save'))
        .sort((a, b) => minuteOf(a) - minuteOf(b));

    const series = (isHome) => {
        let n = 0;
        const points = [{ t: 0, n: 0 }];
        const goals = [];
        for (const s of events) {
            if (s.isHome !== isHome) continue;
            n += isXg ? s.xg : 1;
            points.push({ t: minuteOf(s), n });
            if (s.result === 'goal') goals.push({ t: minuteOf(s), n, name: s.shooterName });
        }
        return { points, goals, total: n };
    };
    const a = series(false);
    const h = series(true);
    const fmt = (v) => (isXg ? v.toFixed(2).replace('.', fi ? ',' : '.') : String(v));

    const last = Math.max(60, ...events.map(minuteOf));
    const tMax = last > 60 ? Math.ceil(last / 5) * 5 : 60;
    const nMax = isXg ? Math.max(2, Math.ceil(Math.max(a.total, h.total) + 0.3)) : niceMax(Math.max(a.total, h.total, 10), 5);

    const W = 340;
    const H = 210;
    const pad = { l: 28, r: 12, t: 12, b: 30 };
    const x = (t) => pad.l + (t / tMax) * (W - pad.l - pad.r);
    const y = (n) => H - pad.b - (n / nMax) * (H - pad.t - pad.b);

    const path = (points) => {
        let d = `M ${x(0)} ${y(0)}`;
        let prev = 0;
        for (const p of points.slice(1)) {
            d += ` L ${x(p.t)} ${y(prev)} L ${x(p.t)} ${y(p.n)}`;
            prev = p.n;
        }
        const end = Math.max(points.at(-1).t, Math.min(tMax, last));
        return `${d} L ${x(end)} ${y(prev)}`;
    };

    const periods = [20, 40, 60].filter((t) => t < tMax);
    const labels = [fi ? '1. erä' : '1st', fi ? '2. erä' : '2nd', fi ? '3. erä' : '3rd'];
    const yStep = isXg ? (nMax > 4 ? 1 : 0.5) : 5;
    const yTicks = Array.from({ length: Math.floor(nMax / yStep) + 1 }, (_, i) => i * yStep)
        .filter((v) => isXg || nMax <= 30 || v % 10 === 0);

    return (
        <>
            <svg className="rd-chart" viewBox={`0 0 ${W} ${H}`} role="img"
                aria-label={isXg ? (fi ? 'Odotetut maalit ottelun aikana' : 'Expected goals over the game') : (fi ? 'Laukaukset maalia kohti ottelun aikana' : 'Shots on goal over the game')}>
                {yTicks.map((v) => (
                    <g key={v}>
                        <line className="rd-grid" x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} />
                        <text className="rd-axis" x={pad.l - 6} y={y(v) + 3} textAnchor="end">{isXg ? String(v).replace('.', fi ? ',' : '.') : v}</text>
                    </g>
                ))}
                {periods.map((t) => <line key={t} className="rd-period" x1={x(t)} x2={x(t)} y1={pad.t} y2={H - pad.b} />)}
                {labels.map((label, i) => (
                    <text key={label} className="rd-axis" x={x(i * 20 + 10)} y={H - pad.b + 16} textAnchor="middle">{label}</text>
                ))}
                {tMax > 60 && <text className="rd-axis" x={x((60 + tMax) / 2)} y={H - pad.b + 16} textAnchor="middle">{fi ? 'JA' : 'OT'}</text>}
                <path className="rd-line" d={path(a.points)} stroke={colors.away} />
                <path className="rd-line" d={path(h.points)} stroke={colors.home} />
                {[...a.goals.map((g) => ({ ...g, c: colors.away })), ...h.goals.map((g) => ({ ...g, c: colors.home }))].map((g) => (
                    <circle key={`${g.t}-${g.n}-${g.c}`} className="rd-goal" cx={x(g.t)} cy={y(g.n)} r="4.5" fill={g.c}>
                        <title>{`${fi ? 'Maali' : 'Goal'}: ${g.name ?? ''}`}</title>
                    </circle>
                ))}
            </svg>
            <ul className="rd-legend">
                <li><span className="rd-swatch" style={{ background: colors.away }} aria-hidden="true" />{away} {fmt(a.total)}</li>
                <li><span className="rd-swatch" style={{ background: colors.home }} aria-hidden="true" />{home} {fmt(h.total)}</li>
                <li><span className="rd-swatch is-goal" aria-hidden="true" />{fi ? 'maali' : 'goal'}</li>
            </ul>
        </>
    );
}

// ---------------------------------------------------------------------------
// Laukaukset erittäin
// ---------------------------------------------------------------------------

export function ShotsByPeriod({ periods, away, home, lang }) {
    const fi = lang === 'fi';
    const colors = pairColors(away, home);
    const rows = periods.filter((p) => p.periodType !== 'SO');
    if (rows.length === 0) return null;

    const W = 340;
    const H = 170;
    const pad = { l: 12, r: 12, t: 18, b: 26 };
    const max = Math.max(5, ...rows.flatMap((p) => [p.away, p.home]));
    const slot = (W - pad.l - pad.r) / rows.length;
    const barW = Math.min(30, slot * 0.3);
    const h = (v) => (v / max) * (H - pad.t - pad.b);
    const label = (p) => (p.periodType === 'OT' ? (fi ? 'JA' : 'OT') : `${p.period}.`);

    return (
        <svg className="rd-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={fi ? 'Laukaukset erittäin' : 'Shots by period'}>
            <line className="rd-grid" x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} />
            {rows.map((p, i) => {
                const cx = pad.l + slot * i + slot / 2;
                return (
                    <g key={`${p.period}-${p.periodType}`}>
                        {[['away', -1], ['home', 1]].map(([side, dir]) => {
                            const v = p[side] ?? 0;
                            const bx = cx + (dir < 0 ? -barW - 2 : 2);
                            return (
                                <g key={side}>
                                    <rect className="rd-bar" x={bx} y={H - pad.b - h(v)} width={barW} height={Math.max(h(v), 1)} rx="3" fill={colors[side]} />
                                    <text className="rd-bar-value" x={bx + barW / 2} y={H - pad.b - h(v) - 5} textAnchor="middle">{v}</text>
                                </g>
                            );
                        })}
                        <text className="rd-axis" x={cx} y={H - pad.b + 16} textAnchor="middle">{label(p)} {fi && p.periodType !== 'OT' ? 'erä' : ''}</text>
                    </g>
                );
            })}
        </svg>
    );
}
