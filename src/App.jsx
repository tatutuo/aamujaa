import React, { useState, useEffect, useCallback, useRef } from 'react';
// Järjestys on merkityksellinen: tokenit ensin, sitten vanhat tyylit,
// ja uusi ulkoasu viimeisenä jotta se voittaa vanhat säännöt.
import './styles/tokens.css';
import './styles/global.css';
import './styles/app.css';
import './styles/sheet.css';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import HomePage from './components/HomePage';
import CalendarPage from './components/CalendarPage';
import StandingsPage from './components/StandingsPage';
import StatsPage from './components/StatsPage';
import SplashScreen from './components/SplashScreen';

// Modaalit
import SettingsModal from './components/SettingsModal';
import UpdatesModal from './components/UpdatesModal';
import InfoModal from './components/InfoModal';
import FeedbackModal from './components/FeedbackModal';
import SearchModal from './components/SearchModal';
import PlayerModal from './components/PlayerModal';
import GameModal from './components/GameModal';
import TeamModal from './components/TeamModal';
import TeletextModal from './components/TeletextModal';
import FantasyModal from './components/FantasyModal';
import PredictionModal from './components/PredictionModal';
import AdvancedModal from './components/AdvancedModal';

const FANTASY_LIMITS = { G: 1, D: 2, F: 3 };

/** Normalisoi pelipaikan kolmeen luokkaan: G, D tai F. */
const positionGroup = (position) => {
    if (position === 'G' || position === 'Goalie') return 'G';
    if (position === 'D' || position === 'Defenseman') return 'D';
    return 'F';
};

/** localStorage-tila, joka ei kaadu jos tallennettu arvo on rikki. */
function usePersistentState(key, fallback) {
    const [value, setValue] = useState(() => {
        try {
            const stored = localStorage.getItem(key);
            return stored === null ? fallback : JSON.parse(stored);
        } catch {
            return fallback;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // Yksityinen selaus tai täysi kiintiö — ei syytä kaataa sovellusta.
        }
    }, [key, value]);

    return [value, setValue];
}

function App() {
    const [currentView, setCurrentView] = useState('home');

    // Modaalit yhtenä pinona, ei erillisenä "aktiivinen + historia" -parina.
    // Kahdella tilalla sulkeminen ja avaaminen samassa klikkauksessa
    // (esim. tilastolistasta pelaajakorttiin) meni ristiin, koska sulkeminen
    // joutui kutsumaan toista setteriä toisen päivitysfunktion sisältä.
    const [modalStack, setModalStack] = useState([]);

    const [selectedPlayerId, setSelectedPlayerId] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [teletextType, setTeletextType] = useState(null);

    const [theme, setTheme] = usePersistentState('aamujaa_theme', 'dark');
    const [language, setLanguage] = usePersistentState('aamujaa_lang', 'fi');

    const [favTeams, setFavTeams] = usePersistentState('favTeams', []);
    const [favPlayers, setFavPlayers] = usePersistentState('favPlayers', []);
    const [fantasyTeam, setFantasyTeam] = usePersistentState('fantasyTeam', []);

    const [toast, setToast] = useState(null);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    // --- Modaalien navigaatio ---

    /** Avaa modaalin nykyisen päälle — takaisin palaa edelliseen. */
    const navigateToModal = useCallback((modalName) => {
        setModalStack((stack) => [...stack, modalName]);
    }, []);

    /**
     * Sulkee päällimmäisen modaalin. Kulkee selaimen historian kautta, jotta
     * ruksi ja laitteen takaisin-painike käyttäytyvät täsmälleen samoin.
     */
    const closeCurrentModal = useCallback(() => {
        window.history.back();
    }, []);

    /** Avaa modaalin tyhjältä pöydältä — käytetään ylä- ja alapalkin napeista. */
    const forceOpenRootModal = useCallback((modalName) => {
        setModalStack([modalName]);
    }, []);

    /**
     * Modaalin kerros pinon järjestyksestä.
     *
     * Aiemmin jokainen modaali määritteli oman z-indexinsä käsin, ja luvut olivat
     * ristiriidassa: tilastolista oli 100000 ja pelaajakortti 99999, joten
     * listasta avattu kortti piirtyi listan alle eikä sitä näkynyt lainkaan.
     * Kun kerros lasketaan pinosta, päällimmäinen on aina päällimmäinen.
     */
    const layerOf = useCallback(
        (modalName) => {
            const index = modalStack.indexOf(modalName);
            return index === -1 ? undefined : 99000 + index * 10;
        },
        [modalStack],
    );

    /**
     * Modaali pysyy näkyvissä koko sen ajan kun se on pinossa — ei vain
     * päällimmäisenä. Näin alle jäävä näkymä säilyttää vierityskohtansa ja
     * datansa, ja takaisin palaaminen on välitön ilman uutta latausta.
     */
    const isInStack = useCallback((modalName) => modalStack.includes(modalName), [modalStack]);

    /**
     * Android-laitteen takaisin-painike sulkee modaalin sovelluksesta poistumisen
     * sijaan. Play Store -julkaisussa tämä on oleellista: ilman sitä takaisin-nappi
     * sulkisi koko sovelluksen kesken katselun.
     *
     * Selaimen historia pidetään samassa syvyydessä modaalipinon kanssa. Ainoa
     * paikka, joka oikeasti poistaa modaalin, on popstate-käsittelijä — myös
     * ruksista suljettaessa kutsutaan history.back(), jolloin historia ja pino
     * eivät voi ajautua eri tahtiin.
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
        const onPopState = () => {
            historyDepth.current = Math.max(0, historyDepth.current - 1);
            setModalStack((stack) => stack.slice(0, -1));
        };

        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

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

    const handleOpenTeletext = useCallback((type) => {
        if (type === 'ai_predictions') {
            forceOpenRootModal('predictions');
        } else if (type === 'advanced') {
            forceOpenRootModal('advanced');
        } else {
            setTeletextType(type);
            forceOpenRootModal('teletext');
        }
    }, [forceOpenRootModal]);

    // --- Suosikit ja fantasy ---

    const toggleFavTeam = useCallback((abbrev) => {
        setFavTeams((prev) => (prev.includes(abbrev) ? prev.filter((t) => t !== abbrev) : [...prev, abbrev]));
    }, [setFavTeams]);

    const toggleFavPlayer = useCallback((playerId) => {
        setFavPlayers((prev) => (prev.includes(playerId) ? prev.filter((p) => p !== playerId) : [...prev, playerId]));
    }, [setFavPlayers]);

    const toggleFantasyPlayer = useCallback((player) => {
        setFantasyTeam((prev) => {
            if (prev.some((p) => p.id === player.id)) {
                return prev.filter((p) => p.id !== player.id);
            }

            const group = positionGroup(player.position);
            const taken = prev.filter((p) => positionGroup(p.position) === group).length;

            if (taken >= FANTASY_LIMITS[group]) {
                // Aiemmin tämä oli alert() — modaalin päällä se on Androidilla
                // erityisen töksähtävä. Nyt viesti näytetään sovelluksen sisällä.
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

    /**
     * Kapteenin valinta. Hockey GM:n säännöissä kapteeni saa pisteensä 1,3
     * kertoimella, joten ilman valintaa pisteet eivät voi täsmätä. Kapteeneja
     * on kerrallaan yksi: saman pelaajan napautus poistaa kapteeniuden.
     */
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

    const renderView = () => {
        const shared = { language, onPlayerClick: handleOpenPlayer, onTeamClick: handleOpenTeam };

        switch (currentView) {
            case 'calendar':
                return <CalendarPage {...shared} />;
            case 'standings':
                return <StandingsPage {...shared} favTeams={favTeams} />;
            case 'stats':
                return <StatsPage onOpenTeletext={handleOpenTeletext} language={language} />;
            case 'home':
            default:
                return (
                    <HomePage
                        onPlayerClick={handleOpenPlayer}
                        onGameClick={handleOpenGame}
                        onFantasyClick={handleOpenFantasy}
                        favTeams={favTeams}
                        toggleFavTeam={toggleFavTeam}
                        favPlayers={favPlayers}
                        toggleFavPlayer={toggleFavPlayer}
                        fantasyTeam={fantasyTeam}
                        toggleFantasyPlayer={toggleFantasyPlayer}
                        language={language}
                    />
                );
        }
    };

    return (
        <>
            <SplashScreen language={language} />

            <div className="app-container">
                <TopBar
                    onOpenSettings={() => forceOpenRootModal('settings')}
                    onOpenSearch={() => forceOpenRootModal('search')}
                    language={language}
                />

                <main className="app-view active-view">{renderView()}</main>

                <BottomNav currentView={currentView} setCurrentView={setCurrentView} language={language} />

                {toast && <div className="app-toast" role="status">{toast}</div>}

                <SettingsModal
                    isOpen={isInStack('settings')}
                    zIndex={layerOf('settings')}
                    onClose={closeCurrentModal}
                    onChangeModal={navigateToModal}
                    currentTheme={theme}
                    onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    language={language}
                    setLanguage={setLanguage}
                />

                <UpdatesModal isOpen={isInStack('updates')}
                    zIndex={layerOf('updates')} onClose={closeCurrentModal} language={language} />
                <InfoModal isOpen={isInStack('info')}
                    zIndex={layerOf('info')} onClose={closeCurrentModal} language={language} />
                <FeedbackModal isOpen={isInStack('feedback')}
                    zIndex={layerOf('feedback')} onClose={closeCurrentModal} language={language} />

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
                    fantasyTeam={fantasyTeam}
                    toggleFantasyPlayer={toggleFantasyPlayer}
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

                <TeletextModal
                    isOpen={isInStack('teletext')}
                    zIndex={layerOf('teletext')}
                    onClose={closeCurrentModal}
                    pageType={teletextType}
                    onPlayerClick={handleOpenPlayer}
                    language={language}
                />

                <PredictionModal
                    isOpen={isInStack('predictions')}
                    zIndex={layerOf('predictions')}
                    onClose={closeCurrentModal}
                    onPlayerClick={handleOpenPlayer}
                    language={language}
                />

                <AdvancedModal
                    isOpen={isInStack('advanced')}
                    zIndex={layerOf('advanced')}
                    onClose={closeCurrentModal}
                    onPlayerClick={handleOpenPlayer}
                    language={language}
                />

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
            </div>
        </>
    );
}

export default App;
