import React, { useState } from 'react';
import { IconChevronDown, IconCircleCheck, IconCircleX, IconInfoCircle } from '@tabler/icons-react';
import StatTiles from '../ui/StatTiles';
import { useApi } from '../../hooks/useApi';
import { api } from '../../utils/api';
import { pairColors } from '../../utils/chartColors';
import { dec, pct } from '../../utils/format';

/**
 * Ottelun Ennuste-välilehti.
 *
 * Näyttää tilastomallin ennusteen ja sen, miten se laskettiin: jokainen
 * vaihe kerroimineen kummallekin joukkueelle, sekä mallin toteutuneen
 * osumatarkkuuden. Luvut tulevat palvelimen tallentamasta ennusteesta,
 * joka lukittiin ennen ottelua (klo 9 Suomen aikaa), joten jälkikäteen
 * katsottuna näkyy täsmälleen se, mitä malli silloin sanoi.
 */

const STEP_TEXT = {
    base: {
        fi: 'Lähtötaso',
        en: 'Baseline',
        hint: {
            fi: 'Liigan keskimääräinen maalimäärä yhdelle joukkueelle ottelussa tällä kaudella.',
            en: 'League average goals per team per game this season.',
        },
    },
    shots: {
        fi: 'Laukaukset',
        en: 'Shots',
        hint: {
            fi: 'Joukkueen laukausvoima vastaan vastustajan kyky estää laukauksia. Kauden alussa luvut vedetään kohti viime kauden tasoa ja liigan keskiarvoa, koska muutaman ottelun otos on pieni.',
            en: 'The team’s shot generation against the opponent’s shot suppression, pulled towards last season and the league average while the sample is small.',
        },
    },
    finishing: {
        fi: 'Viimeistely',
        en: 'Finishing',
        hint: {
            fi: 'Joukkueen maalit laukausta kohti. Viimeistely heittelee paljon sattumalta, joten se kutistetaan voimakkaasti kohti keskiarvoa.',
            en: 'Goals per shot. Finishing is noisy, so it is shrunk strongly towards the average.',
        },
    },
    goalie: {
        fi: 'Vastustajan maalivahti',
        en: 'Opposing goalie',
        hint: {
            fi: 'Todennäköisten maalivahtien torjuntaprosentti peliajalla painotettuna. Aloittajaa ei julkisteta etukäteen; peräkkäisinä päivinä vaihtovahdin osuutta kasvatetaan.',
            en: 'Likely goalies’ save percentage weighted by ice time; the backup gets more weight on back-to-backs.',
        },
    },
    home: {
        fi: 'Kotietu',
        en: 'Home ice',
        hint: { fi: 'Kotijoukkue tekee keskimäärin hieman enemmän maaleja.', en: 'Home teams score slightly more on average.' },
    },
    rest: {
        fi: 'Lepo',
        en: 'Rest',
        hint: {
            fi: 'Lepopäivien vaikutus mitattuna kolmen kauden datasta: peräkkäisinä päivinä pelaava joukkue tekee vähemmän ja väsynyt vastustaja päästää enemmän.',
            en: 'Measured from three seasons: teams on a back-to-back score less, tired opponents concede more.',
        },
    },
    special: {
        fi: 'Erikoistilanteet',
        en: 'Special teams',
        hint: { fi: 'Oma ylivoima vastaan vastustajan alivoima. Vaikutus on rajattu, koska erikoistilanteita on vain muutama minuutti.', en: 'Power play against the opponent’s penalty kill, capped.' },
    },
    form: {
        fi: 'Muoto',
        en: 'Form',
        hint: { fi: 'Viimeisen 10 ottelun pisteet. Vaikutus on tarkoituksella pieni, koska lyhyen jakson tulokset ovat suurelta osin sattumaa.', en: 'Points in the last 10 games; deliberately small effect.' },
    },
    limit: {
        fi: 'Rajaus',
        en: 'Limit',
        hint: { fi: 'Odotetut maalit pidetään järkevällä välillä.', en: 'Expected goals are kept within a sensible range.' },
    },
};

const signedPct = (factor, lang) => {
    const change = (factor - 1) * 100;
    if (Math.abs(change) < 0.05) return '±0 %';
    return `${change > 0 ? '+' : '−'}${dec(Math.abs(change), 1, lang)} %`;
};

function stepDetail(step, lang, opponent) {
    const fi = lang === 'fi';
    const d = step.detail;
    if (!d) return null;
    switch (step.key) {
        case 'shots':
            return fi
                ? `Odotettu ${dec(d.expectedShots, 1, lang)} laukausta (liiga ${dec(d.leagueShots, 1, lang)}). Kaudella ${dec(d.shotsForPerGame, 1, lang)}/ottelu, ${opponent} päästää ${dec(d.oppShotsAgainstPerGame, 1, lang)}.`
                : `Expected ${dec(d.expectedShots, 1, lang)} shots (league ${dec(d.leagueShots, 1, lang)}). Season ${dec(d.shotsForPerGame, 1, lang)}/game, ${opponent} allows ${dec(d.oppShotsAgainstPerGame, 1, lang)}.`;
        case 'finishing':
            return fi
                ? `Mallissa ${pct(d.shootingPct, 1, lang)} % (kaudella ${d.seasonShootingPct != null ? pct(d.seasonShootingPct, 1, lang) : '–'} %, liiga ${pct(d.leagueShootingPct, 1, lang)} %).`
                : `Model ${pct(d.shootingPct, 1, lang)}% (season ${d.seasonShootingPct != null ? pct(d.seasonShootingPct, 1, lang) : '–'}%, league ${pct(d.leagueShootingPct, 1, lang)}%).`;
        case 'goalie': {
            const names = (d.goalies ?? []).map((g) => `${g.name} ${Math.round(g.weight * 100)} %`).join(', ');
            return fi
                ? `Torjunta ${pct(d.savePct, 1, lang)} % (liiga ${pct(d.leagueSavePct, 1, lang)} %)${names ? `: ${names}` : ''}.`
                : `Save ${pct(d.savePct, 1, lang)}% (league ${pct(d.leagueSavePct, 1, lang)}%)${names ? `: ${names}` : ''}.`;
        }
        case 'rest': {
            const days = (v) => (v == null ? '?' : v);
            if (d.backToBack) return fi ? 'Pelasi eilen (peräkkäiset pelipäivät).' : 'Played yesterday (back-to-back).';
            return fi
                ? `Lepopäiviä ${days(d.restDays)}, vastustajalla ${days(d.oppRestDays)}.`
                : `Rest days ${days(d.restDays)}, opponent ${days(d.oppRestDays)}.`;
        }
        case 'special':
            return fi
                ? `Ylivoima ${pct(d.powerPlayPct, 1, lang)} %, vastustajan alivoima ${pct(d.oppPenaltyKillPct, 1, lang)} %.`
                : `Power play ${pct(d.powerPlayPct, 1, lang)}%, opponent penalty kill ${pct(d.oppPenaltyKillPct, 1, lang)}%.`;
        case 'form':
            return d.last10
                ? (fi ? `Viimeiset 10: ${d.last10} (V-H-JA), vastustaja ${d.oppLast10 ?? '–'}.` : `Last 10: ${d.last10} (W-L-OT), opponent ${d.oppLast10 ?? '–'}.`)
                : null;
        default:
            return null;
    }
}

export default function GamePrediction({ game, gameDate, awayAbbrev, homeAbbrev, lang, state }) {
    const fi = lang === 'fi';
    const { data, error } = useApi((signal) => api.gamePrediction(game.id, gameDate, { signal }), [game.id, gameDate]);
    const [openStep, setOpenStep] = useState(null);

    if (error && !data) return <p className="panel-hint">{fi ? 'Ennusteen haku epäonnistui.' : 'Could not load the prediction.'}</p>;
    if (!data) return <div className="skeleton" style={{ height: 420 }} />;

    const p = data.prediction;
    if (!p) {
        return (
            <div className="gp-empty">
                <p className="panel-hint">
                    {game.gameType === 1
                        ? (fi ? 'Harjoitusotteluista ei tehdä ennusteita: kokoonpanot ovat kokeiluja.' : 'Preseason games are not predicted.')
                        : (fi
                            ? 'Tälle ottelulle ei ole ennustetta. Ennusteet lasketaan joka aamu klo 9 Suomen aikaa saman päivän otteluille, joten ne ilmestyvät viimeistään silloin.'
                            : 'No prediction for this game. Predictions are made every morning at 9:00 Finnish time for that day’s games.')}
                </p>
                <ModelInfo data={data} lang={lang} />
            </div>
        );
    }

    const colors = pairColors(awayAbbrev, homeAbbrev);
    const final = state === 'FINAL' || state === 'OFF';
    const awayScore = game.awayTeam?.score;
    const homeScore = game.homeTeam?.score;
    const favourite = p.homeWinProb >= 50 ? homeAbbrev : awayAbbrev;
    const favouriteProb = Math.max(p.homeWinProb, p.awayWinProb);
    const winner = final ? (homeScore > awayScore ? homeAbbrev : awayAbbrev) : null;
    const tieRegulation = Math.max(0, 100 - p.homeRegProb - p.awayRegProb);
    const steps = (key) => p.steps?.[key] ?? [];
    const stepKeys = steps('home').map((s) => s.key);

    return (
        <div className="gp">
            {final && (
                <p className={`gp-verdict ${winner === favourite ? 'is-hit' : 'is-miss'}`}>
                    {winner === favourite ? <IconCircleCheck size={18} aria-hidden="true" /> : <IconCircleX size={18} aria-hidden="true" />}
                    {fi
                        ? `Malli piti ${favourite}:ta suosikkina (${favouriteProb} %). ${winner} voitti ${homeScore}–${awayScore}.`
                        : `The model favoured ${favourite} (${favouriteProb}%). ${winner} won ${homeScore}–${awayScore}.`}
                </p>
            )}

            {/* Voittotodennäköisyydet */}
            <section className="gp-card">
                <div className="gp-teams">
                    <span style={{ color: colors.home }}>{homeAbbrev}</span>
                    <span className="gp-teams-label">{fi ? 'Voittotodennäköisyys' : 'Win probability'}</span>
                    <span style={{ color: colors.away }}>{awayAbbrev}</span>
                </div>
                <div className="gp-bar" role="img" aria-label={`${homeAbbrev} ${p.homeWinProb} %, ${awayAbbrev} ${p.awayWinProb} %`}>
                    <span style={{ width: `${p.homeWinProb}%`, background: colors.home }}><strong>{p.homeWinProb} %</strong></span>
                    <span style={{ width: `${p.awayWinProb}%`, background: colors.away }}><strong>{p.awayWinProb} %</strong></span>
                </div>
                <p className="gp-split">
                    {fi ? 'Varsinaisella peliajalla' : 'In regulation'}: {homeAbbrev} {p.homeRegProb} % · {fi ? 'tasan' : 'tied'} {tieRegulation} % · {awayAbbrev} {p.awayRegProb} %
                </p>
                <StatTiles
                    tiles={[
                        { label: fi ? 'Odotetut maalit' : 'Expected goals', value: `${dec(p.expectedGoals.home, 2, lang)}–${dec(p.expectedGoals.away, 2, lang)}`, tone: 'accent' },
                        { label: fi ? 'Todennäköisin' : 'Most likely', value: `${p.homeScore}–${p.awayScore}${p.isOT ? (fi ? ' JA' : ' OT') : ''}` },
                        { label: fi ? 'Jatkoajalle' : 'To overtime', value: `${p.otProb} %` },
                        { label: fi ? 'Yli 5,5 maalia' : 'Over 5.5 goals', value: `${p.over55Prob} %` },
                    ]}
                    columns={2}
                />
            </section>

            {/* Todennäköisimmät lopputulokset */}
            {p.topScores?.length > 0 && (
                <section className="gp-card">
                    <h3 className="gp-title">{fi ? 'Todennäköisimmät lopputulokset' : 'Most likely final scores'}</h3>
                    <ol className="gp-scores">
                        {p.topScores.map((s) => (
                            <li key={`${s.home}-${s.away}`}>
                                <span className="gp-score num">{s.home}–{s.away}{s.isOvertime ? <span className="dt-tag">{fi ? 'JA/VL' : 'OT/SO'}</span> : null}</span>
                                <span className="gp-score-track"><span style={{ width: `${(s.probability / p.topScores[0].probability) * 100}%`, background: s.home > s.away ? colors.home : colors.away }} /></span>
                                <span className="gp-score-pct num">{pct(s.probability, 1, lang)} %</span>
                            </li>
                        ))}
                    </ol>
                </section>
            )}

            {/* Laskenta vaihe vaiheelta */}
            <section className="gp-card">
                <h3 className="gp-title">{fi ? 'Miten ennuste laskettiin' : 'How the prediction was calculated'}</h3>
                <p className="gp-lead">
                    {fi
                        ? 'Malli arvioi kummallekin joukkueelle odotetut maalit: lähtötasoa kerrotaan vaihe vaiheelta. Prosentti kertoo, paljonko vaihe muutti odotettuja maaleja. Napauta vaihetta nähdäksesi luvut.'
                        : 'The model estimates expected goals for each team by multiplying the baseline step by step. Tap a step for details.'}
                </p>
                <div className="gp-steps">
                    <div className="gp-step-head">
                        <span />
                        <span style={{ color: colors.home }}>{homeAbbrev}</span>
                        <span style={{ color: colors.away }}>{awayAbbrev}</span>
                    </div>
                    {stepKeys.map((key) => {
                        const a = steps('away').find((s) => s.key === key);
                        const h = steps('home').find((s) => s.key === key);
                        const text = STEP_TEXT[key] ?? { fi: key, en: key, hint: { fi: '', en: '' } };
                        const isOpen = openStep === key;
                        const cell = (s) => {
                            if (!s) return <span className="gp-factor">–</span>;
                            if (key === 'base') return <span className="gp-factor num">{dec(s.value, 2, lang)}</span>;
                            const tone = s.factor > 1.0005 ? 'is-up' : s.factor < 0.9995 ? 'is-down' : '';
                            return <span className={`gp-factor num ${tone}`}>{signedPct(s.factor, lang)}</span>;
                        };
                        return (
                            <div key={key} className={`gp-step ${isOpen ? 'is-open' : ''}`}>
                                <button type="button" className="gp-step-row" onClick={() => setOpenStep(isOpen ? null : key)} aria-expanded={isOpen}>
                                    <span className="gp-step-name">
                                        {text[lang === 'fi' ? 'fi' : 'en']}
                                        <IconChevronDown size={14} stroke={2} aria-hidden="true" />
                                    </span>
                                    {cell(h)}
                                    {cell(a)}
                                </button>
                                {isOpen && (
                                    <div className="gp-step-detail">
                                        <p>{text.hint[lang === 'fi' ? 'fi' : 'en']}</p>
                                        {stepDetail(h, lang, awayAbbrev) && <p><strong style={{ color: colors.home }}>{homeAbbrev}:</strong> {stepDetail(h, lang, awayAbbrev)}</p>}
                                        {stepDetail(a, lang, homeAbbrev) && <p><strong style={{ color: colors.away }}>{awayAbbrev}:</strong> {stepDetail(a, lang, homeAbbrev)}</p>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    <div className="gp-step gp-step-total">
                        <span className="gp-step-name">{fi ? '= Odotetut maalit' : '= Expected goals'}</span>
                        <span className="gp-factor num">{dec(p.expectedGoals.home, 2, lang)}</span>
                        <span className="gp-factor num">{dec(p.expectedGoals.away, 2, lang)}</span>
                    </div>
                </div>
                <h4 className="gp-subtitle">{fi ? 'Odotetuista maaleista todennäköisyyksiin' : 'From expected goals to probabilities'}</h4>
                <p className="gp-lead">
                    {fi
                        ? 'Maalimäärien todennäköisyydet lasketaan Poisson-jakaumasta kaikille lukemille 0–14 (ei arpomalla, joten sama ottelu antaa aina saman tuloksen). Tasalukemia korotetaan, koska johdossa oleva joukkue vetäytyy puolustamaan ja häviävä ottaa riskejä: näin jatkoaikojen osuus vastaa NHL:n toteutunutta. Tasatilanteesta noin kaksi kolmasosaa ratkeaa jatkoajalla ja loput voittolaukauskilpailussa, jossa tasoeron merkitys on pienempi.'
                        : 'Scoreline probabilities come from a Poisson distribution for every score from 0 to 14, computed exactly rather than simulated. Ties are inflated to match the NHL’s real overtime rate, because leading teams defend and trailing teams take risks. About two thirds of ties are settled in overtime and the rest in a shootout, where the skill gap matters less.'}
                </p>
            </section>

            <ModelInfo data={data} lang={lang} />
        </div>
    );
}

/** Mallin toteutunut tarkkuus ja rajoitukset. */
function ModelInfo({ data, lang }) {
    const fi = lang === 'fi';
    const acc = data.accuracy;
    const backtests = data.model?.backtests ?? [];
    return (
        <section className="gp-card">
            <h3 className="gp-title">{fi ? 'Kuinka hyvin malli osuu' : 'How accurate is the model'}</h3>
            {acc?.total > 0 ? (
                <p className="gp-lead">
                    {fi
                        ? `Tällä kaudella ${acc.hits}/${acc.total} oikein (${dec(acc.percentage, 1, lang)} %), Brier ${dec(acc.brierScore, 3, lang)}. Vertailu: "kotijoukkue voittaa aina" ${dec(acc.homeAlways.percentage, 1, lang)} %, Brier ${dec(acc.homeAlways.brierScore, 3, lang)}. Brier mittaa todennäköisyyksien osuvuutta: pienempi on parempi, ja 0,250 vastaa kolikonheittoa.`
                        : `This season ${acc.hits}/${acc.total} correct (${dec(acc.percentage, 1, lang)}%), Brier ${dec(acc.brierScore, 3, lang)}. Baseline "home team always wins": ${dec(acc.homeAlways.percentage, 1, lang)}%, Brier ${dec(acc.homeAlways.brierScore, 3, lang)}. Lower Brier is better; 0.250 is a coin flip.`}
                </p>
            ) : (
                <p className="gp-lead">
                    {fi
                        ? 'Tämän kauden tarkkuus näkyy tässä, kun ensimmäiset ennusteet on tarkistettu toteutuneita tuloksia vasten.'
                        : 'This season’s accuracy appears here once the first predictions have been checked against results.'}
                </p>
            )}
            {backtests.length > 0 && (
                <>
                    <table className="gp-backtest">
                        <thead>
                            <tr>
                                <th>{fi ? 'Takautuva testi' : 'Backtest'}</th>
                                <th>{fi ? 'Oikein' : 'Correct'}</th>
                                <th>Brier</th>
                                <th>{fi ? '"Koti voittaa"' : '"Home wins"'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {backtests.map((b) => (
                                <tr key={b.season}>
                                    <td>{b.season} <span className="gp-muted">({b.games})</span></td>
                                    <td className="num">{dec(b.accuracy, 1, lang)} %</td>
                                    <td className="num">{dec(b.brier, 3, lang)}</td>
                                    <td className="num">{dec(b.homeAccuracy, 1, lang)} % · {dec(b.homeBrier, 3, lang)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="gp-lead">
                        {fi
                            ? 'Testissä jokaisen päivän ennuste laskettiin vain sitä edeltävällä datalla. Mallin säädöt on haettu näillä kausilla, joten luvut ovat hieman optimistisia. Ero kausien välillä on todellinen: 2025–26 oli tasaisempi ja vaikeammin ennustettava kausi.'
                            : 'Each day was predicted using only earlier data. The settings were fitted on these seasons, so the numbers are slightly optimistic. 2025–26 was a more even, harder-to-predict season.'}
                    </p>
                </>
            )}
            <p className="gp-note">
                <IconInfoCircle size={14} stroke={2} aria-hidden="true" />
                {fi
                    ? 'Ennuste lasketaan joka aamu klo 9 ja lukitaan ennen ottelua. Malli lukee NHL:n julkista tilastodataa: se ei tiedä aloittavaa maalivahtia, kokoonpanoa tai tuoreita loukkaantumisia. Kyseessä on tilastollinen arvio, ei vedonlyöntineuvo.'
                    : 'Made every morning at 9:00 and locked before the game. The model uses public NHL stats and does not know the starting goalie, line-up or fresh injuries. A statistical estimate, not betting advice.'}
            </p>
        </section>
    );
}
