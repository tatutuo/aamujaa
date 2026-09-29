import React from 'react';
import StatsTableView from './stats/StatsTableView';
import Segmented from '../components/ui/Segmented';
import { usePersistentState } from '../hooks/usePersistentState';
import { useSettings } from '../state/settings';
import { XG_SKATERS, XG_GOALIES, XG_TEAMS } from './stats/statsViews';

/**
 * Edistyneet tilastot: odotetut maalit (xG), Corsi ja Fenwick MoneyPuckista.
 *
 * Korvaa Aamujään "Edistyneet"-ikkunan, joka näytti NHL:n omia
 * kiekonhallintalukuja 40 rivin listoina. Nyt jokainen luku on samassa
 * lajiteltavassa taulukossa kuin pistepörssi, ja mukana ovat xG-mallit,
 * joita NHL ei itse julkaise.
 */
const CONFIGS = { skaters: XG_SKATERS, goalies: XG_GOALIES, teams: XG_TEAMS };

export default function AdvancedView({ onPlayerClick, onTeamClick }) {
    const { language } = useSettings();
    const fi = language !== 'en';
    const [kind, setKind] = usePersistentState('pucknower_advanced_kind', 'skaters');
    const config = CONFIGS[kind] ?? XG_SKATERS;

    const switcher = (
        <div className="view-switcher">
            <Segmented
                label={fi ? 'Tilastoryhmä' : 'Stat group'}
                value={kind}
                onChange={setKind}
                options={[
                    { value: 'skaters', label: fi ? 'Kenttäpelaajat' : 'Skaters' },
                    { value: 'goalies', label: fi ? 'Maalivahdit' : 'Goalies' },
                    { value: 'teams', label: fi ? 'Joukkueet' : 'Teams' },
                ]}
            />
        </div>
    );

    return (
        <StatsTableView
            key={config.id}
            config={config}
            switcher={switcher}
            onPlayerClick={onPlayerClick}
            onTeamClick={onTeamClick}
        />
    );
}
