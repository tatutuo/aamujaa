import React from 'react';

/**
 * Tilastoruudukko: iso luku ja pieni otsikko. Kortin kärkiluvuille
 * (pisteet, maalit, torjunta-%) — taulukko on listoille, tämä yksittäisille.
 *
 * tile: { label, value, sub?, tone?: 'accent' | 'positive' | 'negative' | 'gold' }
 */
export default function StatTiles({ tiles, columns = 3 }) {
    return (
        <div className="stat-tiles" style={{ '--tile-columns': columns }}>
            {tiles.map((tile) => (
                <div key={tile.label} className={`stat-tile ${tile.tone ? `tone-${tile.tone}` : ''}`}>
                    <span className="stat-tile-value num">{tile.value ?? '–'}</span>
                    <span className="stat-tile-label">{tile.label}</span>
                    {tile.sub && <span className="stat-tile-sub">{tile.sub}</span>}
                </div>
            ))}
        </div>
    );
}
