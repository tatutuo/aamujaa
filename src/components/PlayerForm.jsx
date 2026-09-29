import React from 'react';

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
    const kausi = `${String(season).slice(0, 4)}–${String(season).slice(6)}`;

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
                    <dt>{fi ? 'Pistettä/ottelu' : 'Points/game'}</dt>
                    <dd>{summary.pointsPerGame}</dd>
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
                    <dd>{summary.avgToi} min</dd>
                </div>
                <div>
                    <dt>{fi ? 'Kotona' : 'Home'}</dt>
                    <dd>{summary.home.pointsPerGame}</dd>
                </div>
                <div>
                    <dt>{fi ? 'Vieraissa' : 'Away'}</dt>
                    <dd>{summary.road.pointsPerGame}</dd>
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
