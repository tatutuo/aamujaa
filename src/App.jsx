import React, { useState, useEffect, useCallback, useRef } from 'react';
// Järjestys on merkityksellinen: tokenit ensin, sitten Aamujäästä perityt
// tyylit, ja pucknowerin kuori viimeisenä jotta se voittaa vanhat säännöt.
// Perityt tiedostot poistuvat sitä mukaa kun näkymät rakennetaan uudelleen.
import './styles/tokens.css';
import './styles/global.css';
import './styles/app.css';
import './styles/sheet.css';
import './styles/ui.css';
import './styles/table.css';
import './styles/cards.css';
import './styles/game.css';
import './styles/views.css';
import './styles/shell.css';

import TopBar from './components/shell/TopBar';
import NavBar from './components/shell/NavBar';
import ComingSoon from './components/shell/ComingSoon';
import HomePage from './components/HomePage';
import SettingsView from './views/SettingsView';
import StandingsView from './views/StandingsView';
import ScheduleView from './views/ScheduleView';
import AdvancedView from './views/AdvancedView';
import EdgeView from './views/EdgeView';
import InjuriesView from './views/InjuriesView';
import PlayoffsView from './views/PlayoffsView';
import NationsView from './views/NationsView';
import HistoryView from './views/HistoryView';
import DraftView from './views/DraftView';
import FormView from './views/FormView';
import MineView from './views/MineView';
import StatsTableView from './views/stats/StatsTableView';
import { SCORING, GOALIES, TEAMS } from './views/stats/statsViews';

import InfoModal from './components/InfoModal';
import FeedbackModal from './components/FeedbackModal';
import SearchModal from './components/SearchModal';
import PlayerModal from './components/PlayerModal';
import GameModal from './components/GameModal';
import TeamModal from './components/TeamModal';
import FantasyModal from './components/FantasyModal';

import { usePersistentState } from './hooks/usePersistentState';
import { useSettings } from './state/settings';
import { readPath, routeOf } from './router/routes';

const FANTASY_LIMITS = { G: 1, D: 2, F: 3 };

/** Normalisoi pelipaikan kolmeen luokkaan: G, D tai F. */
const positionGroup = (position) => {
    if (position === 'G' || position === 'Goalie') return 'G';
    if (position === 'D' || position === 'Defenseman') return 'D';
    return 'F';
};

function App() {
    const { settings, language, favTeams, favPlayers, toggleFavTeam, toggleFavPlayer } = useSettings();
    // Fantasy on käyttäjän valinta (Asetukset), oletuksena pois.
    const fantasyOn = Boolean(settings.fantasy);

    // --- Näkymä osoitteesta ---
    const [path, setPath] = useState(() => readPath());

    // --- Päällekkäiset ikkunat pinona ---
    // Pino eikä "aktiivinen + historia" -pari: kahdella tilalla sulkeminen ja
    // avaaminen samassa klikkauksessa (esim. tilastolistasta pelaajakorttiin)
    // meni ristiin.
    const [modalStack, setModalStack] = useState([]);

    const [selectedPlayerId, setSelectedPlayerId] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    const [selectedTeam, setSelectedTeam] = useState(null);

    // Fantasy-joukkue säilyy muistissa, vaikka ominaisuus kytkettäisiin pois.
    const [fantasyTeam, setFantasyTeam] = usePersistentState('fantasyTeam', []);

    const [toast, setToast] = useState(null);

    const navigateToModal = useCallback((modalName) => {
        setModalStack((stack) => [...stack, modalName]);
    }, []);

    /**
     * Sulkee päällimmäisen ikkunan selaimen historian kautta, jotta ruksi ja
     * laitteen takaisin-painike käyttäytyvät täsmälleen samoin.
     */
    const closeCurrentModal = useCallback(() => {
        window.history.back();
    }, []);

    const openRootModal = useCallback((modalName) => {
        setModalStack([modalName]);
    }, []);

    /** Ikkunan kerros pinon järjestyksestä: päällimmäinen on aina päällimmäinen. */
    const layerOf = useCallback(
        (modalName) => {
            const index = modalStack.indexOf(modalName);
            return index === -1 ? undefined : 99000 + index * 10;
        },
        [modalStack],
    );

    const isInStack = useCallback((modalName) => modalStack.includes(modalName), [modalStack]);

    /**
     * Historia: näkymät ja ikkunat samassa pinossa.
     *
     * Näkymän vaihto lisää historiaan merkinnän uudella #-osoitteella ja
     * syvyydellä 0. Ikkunan avaus lisää merkinnän samalla osoitteella ja
     * syvyydellä n. Takaisin-painike palaa aina edelliseen merkintään, ja
     * popstate-käsittelijä lukee siitä molemmat: montako ikkunaa jää auki ja
     * mikä näkymä on alla. Näin Androidin takaisin sulkee ensin ikkunan ja
     * vasta sitten palaa edelliseen näkymään — kuten sovelluksessa kuuluu.
     */
    const modalDepth = modalStack.length;
    const historyDepth = useRef(0);

    useEffect(() => {
        while (historyDepth.current < modalDepth) {
            historyDepth.current += 1;
            window.history.pushState({ modalDepth: historyDepth.current }, '');
        }
        historyDepth.current = modalDepth;
    }, [modalDepth]);

    useEffect(() => {
        const onPopState = (event) => {
            const depth = event.state?.modalDepth ?? 0;
            historyDepth.current = depth;
            setModalStack((stack) => stack.slice(0, depth));
            setPath(readPath());
        };

        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    const navigate = useCallback((nextPath) => {
        if (nextPath === path && modalDepth === 0) {
            // Sama näkymä uudelleen: vieritys ylös, kuten sovelluksissa yleensä.
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        const url = `${window.location.pathname}${window.location.search}#${nextPath}`;
        window.history.pushState({ modalDepth: 0 }, '', url);
        historyDepth.current = 0;
        setModalStack([]);
        setPath(nextPath);
        window.scrollTo(0, 0);
    }, [path, modalDepth]);

    const handleAction = useCallback((action) => {
        if (action === 'search') openRootModal('search');
        else if (action === 'info') openRootModal('info');
        else if (action === 'feedback') openRootModal('feedback');
    }, [openRootModal]);

    const handleOpenPlayer = useCallback((id) => {
        setSelectedPlayerId(id);
        navigateToModal('player');
    }, [navigateToModal]);

    const handleOpenGame = useCallback((gameData) => {
        setSelectedGame(gameData);
        navigateToModal('game');
    }, [navigateToModal]);

    const handleOpenTeam = useCallback((abbrev) => {
        setSelectedTeam(abbrev);
        navigateToModal('team');
    }, [navigateToModal]);

    const handleOpenFantasy = useCallback((id) => {
        setSelectedPlayerId(id);
        navigateToModal('fantasy');
    }, [navigateToModal]);

    // --- Fantasy (taustalla) ---

    const toggleFantasyPlayer = useCallback((player) => {
        setFantasyTeam((prev) => {
            if (prev.some((p) => p.id === player.id)) {
                return prev.filter((p) => p.id !== player.id);
            }

            const group = positionGroup(player.position);
            const taken = prev.filter((p) => positionGroup(p.position) === group).length;

            if (taken >= FANTASY_LIMITS[group]) {
                const labels = language === 'fi'
                    ? { G: 'maalivahti', D: 'puolustajaa', F: 'hyökkääjää' }
                    : { G: 'goalie', D: 'defensemen', F: 'forwards' };
                setToast(
                    language === 'fi'
                        ? `Fantasy-joukkueeseen mahtuu vain ${FANTASY_LIMITS[group]} ${labels[group]}.`
                        : `Your fantasy team can only hold ${FANTASY_LIMITS[group]} ${labels[group]}.`,
                );
                return prev;
            }

            const name = player.name ?? `${player.firstName?.default ?? ''} ${player.lastName?.default ?? ''}`.trim();
            return [...prev, { id: player.id, name, position: player.position }];
        });
    }, [setFantasyTeam, language]);

    const toggleCaptain = useCallback((playerId) => {
        setFantasyTeam((prev) => prev.map((p) => ({
            ...p,
            isCaptain: p.id === playerId ? !p.isCaptain : false,
        })));
    }, [setFantasyTeam]);

    useEffect(() => {
        if (!toast) return undefined;
        const timer = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(timer);
    }, [toast]);

    // Fantasy-toiminnot annetaan eteenpäin vain kun ominaisuus on päällä;
    // ilman niitä kortit eivät näytä fantasy-tähteä lainkaan.
    const fantasyProps = fantasyOn
        ? { fantasyTeam, toggleFantasyPlayer }
        : { fantasyTeam: [], toggleFantasyPlayer: undefined };

    const renderView = () => {
        switch (path) {
            case '/':
                return (
                    <HomePage
                        onPlayerClick={handleOpenPlayer}
                        onGameClick={handleOpenGame}
                        onFantasyClick={fantasyOn ? handleOpenFantasy : undefined}
                        favTeams={favTeams}
                        toggleFavTeam={toggleFavTeam}
                        favPlayers={favPlayers}
                        toggleFavPlayer={toggleFavPlayer}
                        {...fantasyProps}
                        language={language}
                    />
                );
            case '/taulukot/sarjataulukko':
                return <StandingsView onTeamClick={handleOpenTeam} />;
            case '/taulukot/ohjelma':
                return <ScheduleView onTeamClick={handleOpenTeam} onGameClick={handleOpenGame} />;
            case '/tilastot/pisteporssi':
                return <StatsTableView config={SCORING} onPlayerClick={handleOpenPlayer} />;
            case '/tilastot/kunto':
                return <FormView onPlayerClick={handleOpenPlayer} onTeamClick={handleOpenTeam} />;
            case '/tilastot/maalivahdit':
                return <StatsTableView config={GOALIES} onPlayerClick={handleOpenPlayer} />;
            case '/tilastot/joukkueet':
                return <StatsTableView config={TEAMS} onTeamClick={handleOpenTeam} />;
            case '/taulukot/pudotuspelit':
                return <PlayoffsView onTeamClick={handleOpenTeam} onGameClick={handleOpenGame} />;
            case '/taulukot/loukkaantumiset':
                return <InjuriesView onPlayerClick={handleOpenPlayer} onTeamClick={handleOpenTeam} />;
            case '/tilastot/edistyneet':
                return <AdvancedView onPlayerClick={handleOpenPlayer} onTeamClick={handleOpenTeam} />;
            case '/tilastot/nopeudet':
                return <EdgeView onPlayerClick={handleOpenPlayer} onTeamClick={handleOpenTeam} />;
            case '/tilastot/kansalliset':
                return <NationsView onPlayerClick={handleOpenPlayer} />;
            case '/lisaa/historia':
                return <HistoryView onPlayerClick={handleOpenPlayer} onTeamClick={handleOpenTeam} />;
            case '/lisaa/draft':
                return <DraftView />;
            case '/omat':
                return <MineView onPlayerClick={handleOpenPlayer} onTeamClick={handleOpenTeam} />;
            case '/lisaa/asetukset':
                return <SettingsView />;
            default:
                return <ComingSoon route={routeOf(path)} language={language} />;
        }
    };

    return (
        <div className="app-container">
            <TopBar onHome={() => navigate('/')} />

            <main className="app-view" key={path}>{renderView()}</main>

            <NavBar path={path} language={language} onNavigate={navigate} onAction={handleAction} />

            {toast && <div className="app-toast" role="status">{toast}</div>}

            <InfoModal isOpen={isInStack('info')}
                zIndex={layerOf('info')} onClose={closeCurrentModal} language={language}
                onFeedback={() => navigateToModal('feedback')} />
            <FeedbackModal isOpen={isInStack('feedback')}
                zIndex={layerOf('feedback')} onClose={closeCurrentModal} language={language} path={path} />

            <SearchModal
                isOpen={isInStack('search')}
                zIndex={layerOf('search')}
                onClose={closeCurrentModal}
                onPlayerClick={handleOpenPlayer}
                onTeamClick={handleOpenTeam}
                language={language}
            />

            <PlayerModal
                isOpen={isInStack('player')}
                zIndex={layerOf('player')}
                onClose={closeCurrentModal}
                playerId={selectedPlayerId}
                favPlayers={favPlayers}
                toggleFavPlayer={toggleFavPlayer}
                {...fantasyProps}
                onGameClick={handleOpenGame}
                language={language}
            />

            <GameModal
                isOpen={isInStack('game')}
                zIndex={layerOf('game')}
                onClose={closeCurrentModal}
                gameData={selectedGame}
                onTeamClick={handleOpenTeam}
                onPlayerClick={handleOpenPlayer}
                language={language}
            />

            <TeamModal
                isOpen={isInStack('team')}
                zIndex={layerOf('team')}
                onClose={closeCurrentModal}
                teamAbbrev={selectedTeam}
                onPlayerClick={handleOpenPlayer}
                onGameClick={handleOpenGame}
                language={language}
            />

            {fantasyOn && (
                <FantasyModal
                    isOpen={isInStack('fantasy')}
                    zIndex={layerOf('fantasy')}
                    onClose={closeCurrentModal}
                    playerId={selectedPlayerId}
                    fantasyTeam={fantasyTeam}
                    toggleFantasyPlayer={toggleFantasyPlayer}
                    toggleCaptain={toggleCaptain}
                    language={language}
                />
            )}
        </div>
    );
}

export default App;
