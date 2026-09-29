import React, { useMemo, useState } from 'react';
import { IconStar, IconHeart } from '@tabler/icons-react';
import ViewHeader from '../components/shell/ViewHeader';
import DataTable from '../components/ui/DataTable';
import { PlayerIdentity, TeamIdentity } from '../components/table/Identity';
import { useApi } from '../hooks/useApi';
import { useSettings } from '../state/settings';
import { api } from '../utils/api';
import { int, signed, pct, dec } from '../utils/format';
import { teamColors, DEFAULT_TEAM_COLORS } from '../utils/teamColors';
import { NHL_TEAM_ABBREVS } from '../utils/teams';

/**
 * Omat: suosikkijoukkueet ja -pelaajat yhdessä paikassa.
 *
 * Suosikkijoukkueet valitaan suoraan tästä. Pelaajat lisätään sydämellä
 * pelaajakortista tai tilastolistoista, ja ne näkyvät täällä kauden
 * tilastoineen.
 */
export default function MineView({ onPlayerClick, onTeamClick }) {
    const { language, favTeams, favPlayers, toggleFavTeam } = useSettings();
    const lang = language === 'en' ? 'en' : 'fi';
    const fi = lang === 'fi';
    const [picking, setPicking] = useState(favTeams.length === 0);

    const standings = useApi((signal) => api.standings(undefined, { signal }), ['standings']);
    const skaters = useApi(
        (signal) => (favPlayers.length ? api.statsTable('skaters', {}, { signal }) : Promise.resolve(null)),
        ['skaters', favPlayers.length > 0],
    );
    const goalies = useApi(
        (signal) => (favPlayers.length ? api.statsTable('goalies', {}, { signal }) : Promise.resolve(null)),
        ['goalies', favPlayers.length > 0],
    );

    const teamRows = useMemo(
        () => (standings.data?.teams ?? []).filter((t) => favTeams.includes(t.team)),
        [standings.data, favTeams],
    );
    const skaterRows = useMemo(
        () => (skaters.data?.rows ?? []).filter((r) => favPlayers.includes(r.id)),
        [skaters.data, favPlayers],
    );
    const goalieRows = useMemo(
        () => (goalies.data?.rows ?? []).filter((r) => favPlayers.includes(r.id)),
        [goalies.data, favPlayers],
    );

    const t = (fiText, enText) => (fi ? fiText : enText);

    return (
        <div className="view">
            <ViewHeader
                icon={IconStar}
                title={t('Omat', 'Mine')}
                subtitle={t('Suosikkijoukkueet ja -pelaajat', 'Your teams and players')}
            />

            <section className="mine-section">
                <div className="mine-section-head">
                    <h2 className="mine-title">{t('Joukkueet', 'Teams')}</h2>
                    <button type="button" className="chip" onClick={() => setPicking((v) => !v)} aria-expanded={picking}>
                        {picking ? t('Valmis', 'Done') : t('Muokkaa', 'Edit')}
                    </button>
                </div>

                {picking && (
                    <div className="team-picker">
                        {NHL_TEAM_ABBREVS.map((abbrev) => {
                            const selected = favTeams.includes(abbrev);
                            return (
                                <button
                                    key={abbrev}
                                    type="button"
                                    className={`team-pick ${selected ? 'is-selected' : ''}`}
                                    onClick={() => toggleFavTeam(abbrev)}
                                    aria-pressed={selected}
                                >
                                    <span className="dt-dot" style={{ background: (teamColors[abbrev] ?? DEFAULT_TEAM_COLORS)[0] }} aria-hidden="true" />
                                    {abbrev}
                                </button>
                            );
                        })}
                    </div>
                )}

                {favTeams.length === 0 && !picking && (
                    <p className="panel-hint">{t('Et ole vielä valinnut suosikkijoukkueita.', 'No favourite teams yet.')}</p>
                )}

                {teamRows.length > 0 && (
                    <DataTable
                        rows={teamRows}
                        columns={[
                            { key: 'gp', label: t('O', 'GP'), title: t('Ottelut', 'Games played'), format: int },
                            { key: 'points', label: t('P', 'PTS'), title: t('Pisteet', 'Points'), format: int },
                            { key: 'pointPct', label: t('P%', 'P%'), title: t('Pisteprosentti', 'Points percentage'), format: (v, _r, l) => pct(v, 1, l) },
                            { key: 'goalDiff', label: t('ME', 'DIFF'), title: t('Maaliero', 'Goal differential'), format: signed },
                            { key: 'divSeq', label: t('Sija', 'Rank'), title: t('Sija divisioonassa', 'Division rank'), format: int, lowerIsBetter: true },
                        ]}
                        identity={{ label: t('Joukkue', 'Team'), render: (row) => <TeamIdentity row={row} /> }}
                        rowKey={(row) => row.team}
                        defaultSort={{ key: 'points', dir: 'desc' }}
                        tiesShareRank={false}
                        onRowClick={(row) => onTeamClick?.(row.team)}
                        language={lang}
                        caption={t('Suosikkijoukkueet', 'Favourite teams')}
                    />
                )}
            </section>

            <section className="mine-section">
                <div className="mine-section-head">
                    <h2 className="mine-title">{t('Pelaajat', 'Players')}</h2>
                </div>

                {favPlayers.length === 0 && (
                    <p className="panel-hint mine-empty">
                        <IconHeart size={16} stroke={2} aria-hidden="true" />
                        {t('Lisää pelaajia sydämellä pelaajakortista.', 'Add players with the heart on a player card.')}
                    </p>
                )}

                {skaterRows.length > 0 && (
                    <DataTable
                        rows={skaterRows}
                        columns={[
                            { key: 'gp', label: t('O', 'GP'), title: t('Ottelut', 'Games played'), format: int },
                            { key: 'goals', label: t('M', 'G'), title: t('Maalit', 'Goals'), format: int },
                            { key: 'assists', label: t('S', 'A'), title: t('Syötöt', 'Assists'), format: int },
                            { key: 'points', label: t('P', 'P'), title: t('Pisteet', 'Points'), format: int },
                            { key: 'plusMinus', label: '+/−', title: t('Plusmiinus', 'Plus-minus'), format: signed },
                        ]}
                        identity={{ label: t('Kenttäpelaajat', 'Skaters'), render: (row) => <PlayerIdentity row={row} language={lang} /> }}
                        defaultSort={{ key: 'points', dir: 'desc' }}
                        onRowClick={(row) => onPlayerClick?.(row.id)}
                        language={lang}
                        caption={t('Suosikkipelaajat', 'Favourite players')}
                    />
                )}

                {goalieRows.length > 0 && (
                    <div style={{ marginTop: 'var(--space-3)' }}>
                        <DataTable
                            rows={goalieRows}
                            columns={[
                                { key: 'gp', label: t('O', 'GP'), title: t('Ottelut', 'Games played'), format: int },
                                { key: 'wins', label: t('V', 'W'), title: t('Voitot', 'Wins'), format: int },
                                { key: 'savePct', label: t('T%', 'SV%'), title: t('Torjuntaprosentti', 'Save percentage'), format: (v, _r, l) => pct(v, 1, l) },
                                { key: 'gaa', label: t('PÄM', 'GAA'), title: t('Päästetyt maalit per ottelu', 'Goals against average'), format: (v, _r, l) => dec(v, 2, l), lowerIsBetter: true },
                                { key: 'shutouts', label: t('NP', 'SO'), title: t('Nollapelit', 'Shutouts'), format: int },
                            ]}
                            identity={{ label: t('Maalivahdit', 'Goalies'), render: (row) => <PlayerIdentity row={row} language={lang} /> }}
                            defaultSort={{ key: 'wins', dir: 'desc' }}
                            onRowClick={(row) => onPlayerClick?.(row.id)}
                            language={lang}
                            caption={t('Suosikkimaalivahdit', 'Favourite goalies')}
                        />
                    </div>
                )}

                {favPlayers.length > 0 && skaterRows.length + goalieRows.length < favPlayers.length && skaters.data && goalies.data && (
                    <p className="panel-hint" style={{ marginTop: 'var(--space-3)' }}>
                        {t(
                            'Osa suosikeista ei ole pelannut valitulla kaudella, joten heitä ei näy taulukossa.',
                            "Some favourites haven't played this season, so they're not in the table.",
                        )}
                    </p>
                )}
            </section>
        </div>
    );
}
