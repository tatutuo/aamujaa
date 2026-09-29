import React from 'react';
import { dec, clock, seasonLabel } from '../utils/format';

/** Palvelin antaa osan luvuista merkkijonoina ("1.01"); muotoillaan kielen mukaan. */
const num = (v, decimals, language) => dec(Number.parseFloat(v), decimals, language);

/**
 * Pelaajan muotokäyrä ottelulokista.
 *
 * Pylväs per ottelu, uusin oikealla. Pelkkä kausisumma kertoo paljonko
 * pisteitä on tullut mutta ei sitä, ovatko ne kertyneet tasaisesti vai
 * muutamasta suurmatsista — tämä näkymä kertoo.
 */

const PlayerForm = ({ data, language = 'fi', onGameClick }) => {
    if (!data?.games?.length) {
        return (
            <p className="empty-state">
                {language === 'fi' ? 'Ei ottelutietoja tälle kaudelle.' : 'No game data for this season.'}
            </p>
        );
    }

    const { games, summary, season, isPreviousSeason } = data;

    // Käyrä piirretään vanhimmasta uusimpaan, vaikka rajapinta antaa toisin päin.
    const ordered = [...games].reverse();
    const maxPoints = Math.max(1, ...ordered.map((g) => g.points));

    const fi = language === 'fi';
    const kausi = seasonLabel(season);

    return (
        <div className="form-chart">
            <div className="form-head">
                <span className="form-season">
                    {fi ? 'Kausi' : 'Season'} {kausi}
                    {isPreviousSeason && (fi ? ' · edellinen' : ' · previous')}
                </span>
                <span className="form-scale">
                    {summary.games} {fi ? 'ottelua' : 'games'}
                </span>
            </div>

            <div className="form-bars" role="img"
                aria-label={fi ? 'Pisteet otteluittain' : 'Points per game'}>
                {ordered.map((game) => (
                    <button
                        key={game.gameId}
                        type="button"
                        className={`form-bar ${game.points > 0 ? 'has-points' : ''}`}
                        style={{ '--height': `${(game.points / maxPoints) * 100}%` }}
                        onClick={() => onGameClick?.(game)}
                        title={`${game.date} ${game.isHome ? 'vs' : '@'} ${game.opponent}: ${game.goals}+${game.assists}`}
                    >
                        <span className="form-bar-fill" />
                    </button>
                ))}
            </div>

            <dl className="form-stats">
                <div>
                    <dt>{fi ? 'Pisteet/ottelu' : 'Points/game'}</dt>
                    <dd>{num(summary.pointsPerGame, 2, language)}</dd>
                </div>
                <div>
                    <dt>{fi ? 'Pisteotteluita' : 'Point games'}</dt>
                    <dd>{summary.pointGames}/{summary.games}</dd>
                </div>
                <div>
                    <dt>{fi ? 'Pisin putki' : 'Longest streak'}</dt>
                    <dd>{summary.longestStreak}</dd>
                </div>
                <div>
                    <dt>{fi ? 'Peliaika' : 'Ice time'}</dt>
                    <dd>{clock(Number.parseFloat(summary.avgToi) * 60)}</dd>
                </div>
                <div>
                    <dt>{fi ? 'P/O kotona' : 'P/GP home'}</dt>
                    <dd>{num(summary.home.pointsPerGame, 2, language)}</dd>
                </div>
                <div>
                    <dt>{fi ? 'P/O vieraissa' : 'P/GP away'}</dt>
                    <dd>{num(summary.road.pointsPerGame, 2, language)}</dd>
                </div>
            </dl>

            {summary.currentStreak > 0 && (
                <p className="form-streak">
                    {fi
                        ? `Pisteputki käynnissä: ${summary.currentStreak} ottelua`
                        : `Active point streak: ${summary.currentStreak} games`}
                </p>
            )}
        </div>
    );
};

export default PlayerForm;
