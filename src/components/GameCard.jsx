import React from 'react';
import { translations } from '../utils/translations';
import TeamBadge from './TeamBadge';
import { teamColors, DEFAULT_TEAM_COLORS } from '../utils/teamColors';

/**
 * Ottelukortti.
 *
 * Kortti pidetään tarkoituksella tiiviinä: kaksi ottelua mahtuu ruudulle
 * kerralla, jolloin illan tilanteen näkee vierittämättä. Maalintekijät olivat
 * aiemmin kortissa, mutta ne veivät koko toisen ottelun tilan — ne löytyvät
 * ottelukortin Tapahtumat-välilehdeltä maalikoosteineen.
 */

const LIVE_STATES = new Set(['LIVE', 'CRIT']);
const UPCOMING_STATES = new Set(['FUT', 'PRE']);

const periodLabel = (game, t) => {
    const number = game.periodDescriptor?.number;
    if (number === 5) return 'VL';
    if (number === 4) return 'JA';
    return `${number}. ${t.gamePeriod ?? 'erä'}`;
};

const GameCard = ({ game, onClick, favTeams, toggleFavTeam, language }) => {
    const t = translations[language] || translations.fi;

    if (!game?.homeTeam || !game?.awayTeam) return null;

    const away = game.awayTeam;
    const home = game.homeTeam;
    const isLive = LIVE_STATES.has(game.gameState);
    const isUpcoming = UPCOMING_STATES.has(game.gameState);

    const isFavGame = favTeams?.includes(away.abbrev) || favTeams?.includes(home.abbrev);

    let statusLabel;
    let statusTone = 'neutral';

    if (isUpcoming) {
        statusLabel = new Date(game.startTimeUTC).toLocaleTimeString('fi-FI', {
            hour: '2-digit',
            minute: '2-digit',
        });
        statusTone = 'upcoming';
    } else if (isLive) {
        statusLabel = game.clock?.inIntermission
            ? t.gameIntermission
            : `${periodLabel(game, t)} · ${game.clock?.timeRemaining ?? ''}`;
        statusTone = 'live';
    } else {
        const type = game.periodDescriptor?.periodType;
        statusLabel = type && type !== 'REG' ? `${t.gameFinal} (${type})` : t.gameFinal;
    }

    const winner = isUpcoming || isLive
        ? null
        : (home.score ?? 0) > (away.score ?? 0) ? 'home' : 'away';

    const renderTeam = (team, side) => {
        const isFav = favTeams?.includes(team.abbrev);
        const isLoser = winner !== null && winner !== side;

        // Merkki on värillinen tunniste, lyhenne luetaan sen vierestä — teksti
        // merkin sisällä toistaisi saman tiedon kahdesti.
        //
        // Vieras/Koti-tekstejä ei näytetä: vieras on aina ylempänä ja koti
        // alempana, kuten NHL:n omissa listauksissa. Tekstirivit tekivät
        // kortista niin korkean, ettei kahta ottelua mahtunut rinnakkain.
        return (
            <div className={`gc-team ${isLoser ? 'is-loser' : ''}`}>
                <TeamBadge abbrev={team.abbrev} size={22} showText={false} />
                <span className="gc-abbrev">{team.abbrev}</span>

                <button
                    type="button"
                    className={`gc-fav ${isFav ? 'is-active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleFavTeam(team.abbrev); }}
                    aria-label={`${team.abbrev} ${isFav ? 'pois suosikeista' : 'suosikkeihin'}`}
                    aria-pressed={isFav}
                >
                    {isFav ? '★' : '☆'}
                </button>

                <span className="gc-score">{isUpcoming ? '–' : team.score ?? 0}</span>
            </div>
        );
    };

    // Kummankin joukkueen pääväri kortin yläreunaan. Tuo väriä sivulle ilman
    // että jokainen kortti värjätään kokonaan — se tekisi listasta levottoman.
    const awayColour = teamColors[away.abbrev]?.[0] ?? DEFAULT_TEAM_COLORS[0];
    const homeColour = teamColors[home.abbrev]?.[0] ?? DEFAULT_TEAM_COLORS[0];

    return (
        <article
            className={`game-card-v2 ${isLive ? 'is-live' : ''} ${isFavGame ? 'is-fav' : ''}`}
            style={{ '--away-colour': awayColour, '--home-colour': homeColour }}
        >
            <span className="gc-colours" aria-hidden="true" />
            {/*
              Kortin avaava painike venytetään koko kortin alueelle taustalle
              (.gc-open) sen sijaan että se kietoisi sisällön ympärilleen.
              Nappia ei saa laittaa toisen napin sisään — se on virheellistä
              HTML:ää, ja suosikkitähti oli aiemmin juuri siellä.
            */}
            <div className="gc-main">
                <button
                    type="button"
                    className="gc-open"
                    onClick={onClick}
                    aria-label={`${away.abbrev} ${language === 'fi' ? 'vieraana' : 'at'} ${home.abbrev}, ${statusLabel}`}
                />

                <div className={`gc-status gc-status-${statusTone}`}>
                    {isLive && <span className="gc-live-dot" aria-hidden="true" />}
                    {statusLabel}
                </div>

                <div className="gc-teams">
                    {renderTeam(away, 'away')}
                    {renderTeam(home, 'home')}
                </div>
            </div>

        </article>
    );
};

export default GameCard;
