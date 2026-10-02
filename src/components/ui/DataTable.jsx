import React, { useMemo, useState } from 'react';
import { IconArrowDown, IconArrowUp } from '@tabler/icons-react';

/** Sarakkeen arvo rivillä: oma value-funktio tai suoraan kenttä. */
const valueOf = (column, row) => (column?.value ? column.value(row) : row[column?.key]);

/**
 * Yksi taulukko koko sovellukseen.
 *
 * Aamujäässä jokainen taulukko oli tehty eri tavalla (sarjataulukossa 60
 * kovakoodattua tyyliä, Teksti-TV omillaan). Tämä korvaa ne kaikki, joten
 * lajittelu, korostukset ja tiiviys toimivat samoin joka paikassa.
 *
 * Taulukko ei vieritä sivuttain. Sivuttaisvieritys rikkoisi kiinteän
 * otsikkorivin (CSS:n sticky toimii vain yhden vierityssäiliön suhteen), eikä
 * puhelimessa ole tilaa kymmenelle sarakkeelle. Sen sijaan näkymä tarjoaa
 * sarakeryhmät (Perus / Laukaukset / Peliaika …), ja kerralla näkyy
 * korkeintaan viisi lukusaraketta.
 *
 * Sarakkeen määrittely:
 *   key        rivin kenttä, jonka mukaan lajitellaan
 *   label      lyhyt otsikko (P, M, T%)
 *   title      pitkä nimi työkaluvihjeeksi ja ruudunlukijalle
 *   value      (row) => luku lajittelua ja pylvästä varten (oletus row[key])
 *   format     (value, row) => näytettävä teksti
 *   lowerIsBetter  esim. PÄM: ensimmäinen napautus lajittelee nousevasti
 *   rate       suhdeluku (P/O, L%): vähän pelanneet lajitellaan loppuun
 *
 * Muut valinnat:
 *   showRank       sijasarake (oletus). Pois esim. pelaajan kausittaisesta
 *                  taulukosta, jossa rivit ovat aikajärjestyksessä.
 *   tiesShareRank  tasapisteissä sama sija (oletus). Sarjataulukossa false:
 *                  NHL ratkaisee tasapisteet omilla säännöillään, ja rivit
 *                  tulevat valmiiksi siinä järjestyksessä.
 *   rowClass       (row) => lisäluokka riville, esim. pudotuspelipaikka
 *   dividerAfter   (row, i, rows, sort) => katkoviiva rivin alle (esim. playoff-raja)
 *   legend         lyhenteiden selitys taulukon alla (oletus). Otetaan sarakkeiden
 *                  title-kentistä, joten otsikot voivat olla lyhyitä (TA, RI, CF%).
 */
export default function DataTable({
    rows,
    columns,
    identity,
    rowKey = (row) => row.id,
    defaultSort,
    onRowClick,
    isHighlighted,
    isQualified,
    qualifierNote,
    dividerAfter,
    rowClass,
    tiesShareRank = true,
    showRank = true,
    pageSize = 50,
    language = 'fi',
    caption,
    legend = true,
}) {
    const fi = language !== 'en';
    const [sort, setSort] = useState(defaultSort ?? { key: columns[0]?.key, dir: 'desc' });
    const [shown, setShown] = useState(pageSize);

    // Jos sarakeryhmä vaihtuu eikä lajitteluperustetta enää ole näkyvissä,
    // lajitellaan ensimmäisen näkyvän sarakkeen mukaan.
    const activeSort = columns.some((c) => c.key === sort.key)
        ? sort
        : { key: columns[0]?.key, dir: columns[0]?.lowerIsBetter ? 'asc' : 'desc' };

    const sortColumn = columns.find((c) => c.key === activeSort.key);

    const sorted = useMemo(() => {
        if (!sortColumn) return rows;
        const direction = activeSort.dir === 'asc' ? 1 : -1;
        const qualifies = (row) => !sortColumn.rate || !isQualified || isQualified(row);

        return [...rows].sort((a, b) => {
            // Suhdeluvuissa vähän pelanneet aina loppuun: kahden ottelun
            // pelaaja ei saa nousta L%-kärkeen yhdellä onnekkaalla maalilla.
            const qa = qualifies(a);
            const qb = qualifies(b);
            if (qa !== qb) return qa ? -1 : 1;

            const va = valueOf(sortColumn, a);
            const vb = valueOf(sortColumn, b);
            // Puuttuvat arvot aina loppuun suunnasta riippumatta.
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            if (va !== vb) return (va - vb) * direction;
            return 0;
        });
    }, [rows, sortColumn, activeSort.dir, isQualified]);

    /** Pylvään mittakaava lajitellun sarakkeen hyväksytyistä arvoista. */
    const scale = useMemo(() => {
        if (!sortColumn) return null;
        const values = sorted
            .filter((row) => !sortColumn.rate || !isQualified || isQualified(row))
            .map((row) => valueOf(sortColumn, row))
            .filter((v) => typeof v === 'number' && Number.isFinite(v));
        if (values.length < 2) return null;
        const min = Math.min(...values);
        const max = Math.max(...values);
        return max > min ? { min, max } : null;
    }, [sorted, sortColumn, isQualified]);

    /** Tasapisteissä sama sija (1, 2, 2, 4). */
    const ranks = useMemo(() => {
        const result = [];
        let previous;
        sorted.forEach((row, i) => {
            const v = valueOf(sortColumn, row);
            result.push(tiesShareRank && i > 0 && v === previous ? result[i - 1] : i + 1);
            previous = v;
        });
        return result;
    }, [sorted, sortColumn, tiesShareRank]);

    const onHeader = (column) => {
        setShown(pageSize);
        setSort((current) => {
            if (current.key === column.key) {
                return { key: column.key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
            }
            return { key: column.key, dir: column.lowerIsBetter ? 'asc' : 'desc' };
        });
    };

    /** Pylvään pituus 0–1. Kuvaa "hyvyyttä": pienempi-on-parempi -sarakkeessa käänteisesti. */
    const barRatio = (row) => {
        if (!scale) return 0;
        const v = valueOf(sortColumn, row);
        if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
        const ratio = (v - scale.min) / (scale.max - scale.min);
        const goodness = sortColumn.lowerIsBetter ? 1 - ratio : ratio;
        return Math.max(0.06, Math.min(1, goodness));
    };

    const visible = sorted.slice(0, shown);
    const firstUnqualified = sortColumn?.rate && isQualified
        ? visible.findIndex((row) => !isQualified(row))
        : -1;

    return (
        <div className="dt">
            <table className="dt-table">
                {caption && <caption className="sr-only">{caption}</caption>}
                <colgroup>
                    {showRank && <col className="dt-col-rank" />}
                    <col className="dt-col-identity" />
                    {columns.map((c) => <col key={c.key} style={c.width ? { width: c.width } : undefined} className="dt-col-num" />)}
                </colgroup>
                <thead>
                    <tr>
                        {showRank && <th scope="col" className="dt-rank">#</th>}
                        <th scope="col" className="dt-identity">{identity.label}</th>
                        {columns.map((c) => {
                            const active = c.key === activeSort.key;
                            const Arrow = activeSort.dir === 'asc' ? IconArrowUp : IconArrowDown;
                            return (
                                <th
                                    key={c.key}
                                    scope="col"
                                    className={`dt-num ${active ? 'is-sorted' : ''}`}
                                    aria-sort={active ? (activeSort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                >
                                    <button type="button" className="dt-sort" onClick={() => onHeader(c)} title={c.title}>
                                        <span>{c.label}</span>
                                        {active && <Arrow size={11} stroke={2.4} aria-hidden="true" />}
                                        {c.title && <span className="sr-only">{c.title}</span>}
                                    </button>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {visible.map((row, i) => {
                        const highlighted = isHighlighted?.(row);
                        const unqualified = sortColumn?.rate && isQualified && !isQualified(row);
                        const divider = dividerAfter?.(row, i, visible, activeSort);
                        const extraClass = rowClass?.(row) ?? '';
                        return (
                            <React.Fragment key={rowKey(row)}>
                                {i === firstUnqualified && firstUnqualified > 0 && (
                                    <tr className="dt-note-row">
                                        <td colSpan={columns.length + (showRank ? 2 : 1)}>{qualifierNote}</td>
                                    </tr>
                                )}
                                <tr
                                    className={[
                                        'dt-row',
                                        onRowClick ? 'is-clickable' : '',
                                        highlighted ? 'is-highlighted' : '',
                                        unqualified ? 'is-unqualified' : '',
                                        divider ? `has-divider divider-${divider}` : '',
                                        extraClass,
                                    ].join(' ')}
                                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                                >
                                    {showRank && <td className="dt-rank num">{ranks[i]}</td>}
                                    <td className="dt-identity">
                                        {onRowClick ? (
                                            <button
                                                type="button"
                                                className="dt-identity-btn"
                                                onClick={(e) => { e.stopPropagation(); onRowClick(row); }}
                                            >
                                                {identity.render(row)}
                                            </button>
                                        ) : identity.render(row)}
                                    </td>
                                    {columns.map((c) => {
                                        const active = c.key === activeSort.key;
                                        const value = valueOf(c, row);
                                        return (
                                            <td key={c.key} className={`dt-num num ${active ? 'is-sorted' : ''}`}>
                                                {active && !unqualified && (
                                                    <span className="dt-bar" style={{ '--bar': barRatio(row) }} aria-hidden="true" />
                                                )}
                                                <span className="dt-value">{c.format ? c.format(value, row, language) : (value ?? "–")}</span>
                                            </td>
                                        );
                                    })}
                                </tr>
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>

            {legend && sorted.length > 0 && <Legend columns={columns} language={language} />}

            {sorted.length === 0 && (
                <p className="dt-empty">{fi ? 'Ei rivejä näillä valinnoilla.' : 'No rows with these filters.'}</p>
            )}

            {sorted.length > shown && (
                <button type="button" className="dt-more" onClick={() => setShown((n) => n + pageSize)}>
                    {fi
                        ? `Näytä ${Math.min(pageSize, sorted.length - shown)} lisää · ${sorted.length} yhteensä`
                        : `Show ${Math.min(pageSize, sorted.length - shown)} more · ${sorted.length} total`}
                </button>
            )}
        </div>
    );
}

/** Lyhenteiden selitykset: "TA Taklaukset · RI Riistot …". */
function Legend({ columns, language }) {
    const items = columns.filter((c) => c.title && c.title !== c.label);
    if (items.length === 0) return null;
    return (
        <dl className="dt-legend" aria-label={language === 'en' ? 'Abbreviations' : 'Lyhenteet'}>
            {items.map((c) => (
                <div key={c.key} className="dt-legend-item">
                    <dt>{c.label}</dt>
                    <dd>{c.title}</dd>
                </div>
            ))}
        </dl>
    );
}
