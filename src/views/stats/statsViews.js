import {
    SKATER_GROUPS, SKATER_FILTERS,
    GOALIE_GROUPS, GOALIE_FILTERS,
    TEAM_GROUPS, TEAM_FILTERS,
} from './tableConfigs';
import { XG_SKATER_GROUPS, XG_GOALIE_GROUPS, XG_TEAM_GROUPS } from './xgConfigs';

/** Tilastonäkymien asetukset StatsTableView'lle. */
export const SCORING = {
    id: 'scoring',
    path: '/tilastot/pisteporssi',
    category: 'skaters',
    identity: 'player',
    groups: SKATER_GROUPS,
    filters: SKATER_FILTERS,
    defaultSort: { key: 'points', dir: 'desc' },
};

export const GOALIES = {
    id: 'goalies',
    path: '/tilastot/maalivahdit',
    category: 'goalies',
    identity: 'player',
    groups: GOALIE_GROUPS,
    filters: GOALIE_FILTERS,
    defaultSort: { key: 'wins', dir: 'desc' },
};

export const TEAMS = {
    id: 'teams',
    path: '/tilastot/joukkueet',
    category: 'teams',
    identity: 'team',
    groups: TEAM_GROUPS,
    filters: TEAM_FILTERS,
    defaultSort: { key: 'points', dir: 'desc' },
};

/* Edistyneet: odotetut maalit ja Corsi (MoneyPuck). Sama polku, valitsin vaihtaa. */

export const XG_SKATERS = {
    id: 'xg-skaters',
    path: '/tilastot/edistyneet',
    category: 'xg-skaters',
    identity: 'player',
    groups: XG_SKATER_GROUPS,
    filters: SKATER_FILTERS,
    defaultSort: { key: 'xg', dir: 'desc' },
    source: 'MoneyPuck.com',
};

export const XG_GOALIES = {
    id: 'xg-goalies',
    path: '/tilastot/edistyneet',
    category: 'xg-goalies',
    identity: 'player',
    groups: XG_GOALIE_GROUPS,
    filters: GOALIE_FILTERS,
    defaultSort: { key: 'gsax', dir: 'desc' },
    source: 'MoneyPuck.com',
};

export const XG_TEAMS = {
    id: 'xg-teams',
    path: '/tilastot/edistyneet',
    category: 'xg-teams',
    identity: 'team',
    groups: XG_TEAM_GROUPS,
    filters: TEAM_FILTERS,
    defaultSort: { key: 'xgPct', dir: 'desc' },
    source: 'MoneyPuck.com',
};
