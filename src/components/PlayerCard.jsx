import React from 'react';
import { translations } from '../utils/translations';
import TeamBadge from './TeamBadge';

/**
 * Pelaajakortti vaakalistoihin.
 *
 * Kaikki värit tulevat CSS-muuttujista. Aiemmin ne oli kirjoitettu käsin
 * (`#151515`, `#fff`, `#666`), minkä takia vaaleassa teemassa kortit jäivät
 * mustiksi vaalean sivun päälle — se oli koko vaalean teeman näkyvin vika.
 */

const lyhennaKortinNimi = (fullName) => {
    if (!fullName) return { first: '', last: '' };
    const parts = String(fullName).trim().split(' ');
    if (parts.length === 1) return { first: '', last: parts[0] };
    return { first: `${parts[0].charAt(0)}.`, last: parts.slice(1).join(' ') };
};

const StatBox = ({ label, value, tone = 'default' }) => (
    <div className={`pc-stat pc-stat-${tone}`}>
        <span className="pc-stat-label">{label}</span>
        <span className="pc-stat-value">{value}</span>
    </div>
);

/**
 * Lyhyet otsikot korttien tilastolaatikoihin.
 *
 * Kortti on puhelimessa noin 155 px leveä ja jaettu kahteen sarakkeeseen,
 * jolloin otsikolle jää runsaat 50 px. Käännöstiedoston pitkät nimet
 * ("Laukaukset", "Plus/Miinus", "Torjunta%") kääriytyivät kesken sanan, mikä
 * näytti rikkinäiseltä. Nämä mahtuvat yhdelle riville.
 */
const CARD_LABELS = {
    fi: {
        shots: 'Lauk.',
        plusMinus: '+/−',
        savePct: 'Torj-%',
        saves: 'Torjunnat',
        goalsAgainst: 'Päästetyt',
        toi: 'Peliaika',
    },
    en: {
        shots: 'Shots',
        plusMinus: '+/−',
        savePct: 'SV%',
        saves: 'Saves',
        goalsAgainst: 'GA',
        toi: 'TOI',
    },
};

const PlayerCard = ({ player, onClick, variant = 'fin', favPlayers, toggleFavPlayer, fantasyTeam, toggleFantasyPlayer, language }) => {
    const t = translations[language] || translations.fi;
    const lyhyt = CARD_LABELS[language === 'fi' ? 'fi' : 'en'];

    const isGoalie = player.position === 'G' || player.position === 'Goalie';
    const isFav = favPlayers?.includes(player.id);
    const isFantasy = fantasyTeam?.some((f) => f.id === player.id);
    const isLive = player.fullGameData?.gameState === 'LIVE' || player.fullGameData?.gameState === 'CRIT';

    const { first: firstName, last: lastName } = lyhennaKortinNimi(player.name);

    const stats = player.stats?.skaterStats || player.stats?.goalieStats || player.stats || {};

    const getStat = (keys) => {
        for (const key of keys) {
            if (stats[key] !== undefined && stats[key] !== null) return Number(stats[key]);
            if (player.stats?.[key] !== undefined && player.stats?.[key] !== null) return Number(player.stats[key]);
        }
        return 0;
    };

    const toi = player.stats?.toi || player.stats?.timeOnIce || stats.timeOnIce;
    const hasPlayed = Boolean(toi) && !['00:00', '0:00', '0', ''].includes(toi);

    const isPlaying = player.isPlayingToday !== false;
    const season = player.seasonStats || {};
    const hasSeasonStats = (season.gamesPlayed ?? 0) > 0;

    const points = getStat(['goals']) + getStat(['assists']);
    const plusMinus = getStat(['plusMinus']);

    const plusMinusTone = plusMinus > 0 ? 'positive' : plusMinus < 0 ? 'negative' : 'default';

    return (
        <article className={`player-card pc-${variant} ${isLive ? 'is-live' : ''}`}>
            <button
                type="button"
                className="pc-open"
                onClick={onClick}
                aria-label={player.name}
            />

            {/*
              Vaihtonapit ovat omassa rivissään kortin yläreunassa, eivät nimen
              molemmin puolin. Kapeassa kortissa ne veivät nimeltä niin paljon
              tilaa, että "M. Celebrini" katkesi kesken.
            */}
            <div className="pc-actions">
                <button
                    type="button"
                    className={`pc-icon-btn ${isFav ? 'is-fav' : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleFavPlayer(player.id); }}
                    aria-label={isFav ? 'Poista suosikeista' : 'Lisää suosikkeihin'}
                    aria-pressed={isFav}
                >
                    {isFav ? '♥' : '♡'}
                </button>

                <button
                    type="button"
                    className={`pc-icon-btn ${isFantasy ? 'is-fantasy' : ''}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleFantasyPlayer({ id: player.id, name: player.name, position: player.position });
                    }}
                    aria-label={isFantasy ? 'Poista fantasy-joukkueesta' : 'Lisää fantasy-joukkueeseen'}
                    aria-pressed={isFantasy}
                >
                    {isFantasy ? '★' : '☆'}
                </button>
            </div>

            <header className="pc-header">
                {player.team && <TeamBadge abbrev={player.team} size={18} showText={false} />}
                <span className="pc-name">
                    {firstName} {lastName}
                    {isLive && <span className="pc-live" aria-label="käynnissä">●</span>}
                </span>
            </header>

            {/*
              * Fantasy-pisteet päivän ottelusta. Näkyvät vain fantasy-osiossa
              * ja vain kun pelaaja on ollut jäällä — muuten kortti näyttäisi
              * nollaa ennen ottelua ja antaisi väärän kuvan.
              */}
            {variant === 'fantasy' && player.fantasyPoints !== undefined && (
                <div className={`pc-fantasy ${player.fantasyPoints < 0 ? 'is-negative' : ''}`}>
                    <span className="pc-fantasy-value">
                        {player.fantasyPoints > 0 ? `+${player.fantasyPoints}` : player.fantasyPoints}
                    </span>
                    <span className="pc-fantasy-label">
                        {player.isCaptain ? (language === 'fi' ? 'p · kapteeni' : 'p · captain') : 'p'}
                    </span>
                </div>
            )}

            {hasPlayed ? (
                <div className="pc-stats">
                    {isGoalie ? (
                        <>
                            <StatBox label={lyhyt.saves} value={`${getStat(['saves'])}/${getStat(['shotsAgainst'])}`} />
                            <StatBox label={lyhyt.goalsAgainst} value={getStat(['goalsAgainst'])} tone={getStat(['goalsAgainst']) > 3 ? 'negative' : 'default'} />
                            <StatBox label={lyhyt.savePct} value={`${(getStat(['savePctg']) * 100).toFixed(1)} %`} tone="accent" />
                            <StatBox label={lyhyt.toi} value={toi} />
                        </>
                    ) : (
                        <>
                            <StatBox
                                label={variant === 'hot' ? (t.pcPoints || 'Pisteet') : (t.pcToday || 'Tänään')}
                                value={`${getStat(['goals'])}+${getStat(['assists'])}`}
                                tone={points > 0 ? 'positive' : 'default'}
                            />
                            <StatBox label={lyhyt.shots} value={getStat(['shots', 'sog'])} />
                            <StatBox label={lyhyt.plusMinus} value={plusMinus > 0 ? `+${plusMinus}` : plusMinus} tone={plusMinusTone} />
                            <StatBox label={lyhyt.toi} value={toi} />
                        </>
                    )}
                </div>
            ) : (
                <>
                    <p className="pc-status">
                        {isPlaying ? (t.pcWaitingGame || 'Odottaa ottelua') : (t.pcNoGameToday || 'Ei peliä tänään')}
                    </p>

                    {hasSeasonStats ? (
                        <div className="pc-stats">
                            {isGoalie ? (
                                <>
                                    <StatBox label={t.pcGames || 'Pelit'} value={season.gamesPlayed ?? 0} />
                                    <StatBox label={t.pcWins || 'Voitot'} value={season.wins ?? 0} tone="positive" />
                                    <StatBox label={t.statGAA || 'GAA'} value={(season.goalsAgainstAvg ?? season.goalsAgainstAverage ?? 0).toFixed(2)} />
                                    <StatBox label={t.pcSVP || 'SV%'} value={(season.savePctg ?? 0).toFixed(3)} tone="accent" />
                                </>
                            ) : (
                                <>
                                    <StatBox label={t.pcGames || 'Pelit'} value={season.gamesPlayed ?? 0} />
                                    <StatBox label={t.pcPoints || 'Pisteet'} value={season.points ?? 0} tone="gold" />
                                    <StatBox label={t.statGoals || 'Maalit'} value={season.goals ?? 0} />
                                    <StatBox label={t.statAssists || 'Syötöt'} value={season.assists ?? 0} />
                                </>
                            )}
                        </div>
                    ) : (
                        <p className="pc-empty">
                            {t.pcWaiting || 'Odottaa ottelua tai'} {t.pcNotPlaying || 'poissa kokoonpanosta.'}
                        </p>
                    )}
                </>
            )}
        </article>
    );
};

export default PlayerCard;
