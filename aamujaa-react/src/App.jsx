import React, { useState, useEffect } from 'react';
import './styles/global.css';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import HomePage from './components/HomePage';
import CalendarPage from './components/CalendarPage';
import StandingsPage from './components/StandingsPage';
import StatsPage from './components/StatsPage';
import SplashScreen from './components/SplashScreen';
import LiigaLive from './components/LiigaLive';
import LiigaBottomNav from './components/LiigaBottomNav';
import LiigaPlayerCard from './components/LiigaPlayerCard';
import LiigaTeamModal from './components/LiigaTeamModal';

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

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [activeModal, setActiveModal] = useState(null);
  const [modalHistory, setModalHistory] = useState([]);

  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);

  const [teletextType, setTeletextType] = useState(null);
  const [theme, setTheme] = useState('dark');

  const [activeLeague, setActiveLeague] = useState('NHL');
  const [currentLiigaView, setCurrentLiigaView] = useState('home');

  const [selectedLiigaPlayer, setSelectedLiigaPlayer] = useState(null);
  const [selectedLiigaTeam, setSelectedLiigaTeam] = useState(null);

  const [language, setLanguage] = useState(() => localStorage.getItem('aamujaa_lang') || 'fi');
  useEffect(() => { localStorage.setItem('aamujaa_lang', language); }, [language]);

  useEffect(() => {
      document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleOpenPlayer = (id) => {
      setSelectedPlayerId(id);
      navigateToModal('player');
  };

  const handleOpenGame = (gameData) => {
      setSelectedGame(gameData);
      navigateToModal('game');
  };

  const handleOpenTeam = (abbrev) => {
      setSelectedTeam(abbrev);
      navigateToModal('team');
  };

  const handleOpenTeletext = (type) => {
    if (type === 'ai_predictions') {
      forceOpenRootModal('predictions');
    } else {
      setTeletextType(type);
      forceOpenRootModal('teletext');
    }
  };
  
  const handleOpenFantasy = (id) => {
      setSelectedPlayerId(id);
      navigateToModal('fantasy');
  };

  const navigateToModal = (modalName) => {
      if (activeModal) {
          setModalHistory(prev => [...prev, activeModal]);
      }
      setActiveModal(modalName);
  };

  const closeCurrentModal = () => {
      if (modalHistory.length > 0) {
          const previousModal = modalHistory[modalHistory.length - 1]; 
          setModalHistory(prev => prev.slice(0, -1)); 
          setActiveModal(previousModal); 
      } else {
          setActiveModal(null); 
      }
  };

  const forceOpenRootModal = (modalName) => {
      setModalHistory([]);
      setActiveModal(modalName);
  };

  // --- LOCALSTORAGE TILAT: SUOSIKIT JA FANTASY ---
  const [favTeams, setFavTeams] = useState(() => JSON.parse(localStorage.getItem('favTeams')) || []);
  const [favPlayers, setFavPlayers] = useState(() => JSON.parse(localStorage.getItem('favPlayers')) || []);
  const [fantasyTeam, setFantasyTeam] = useState(() => JSON.parse(localStorage.getItem('fantasyTeam')) || []);

  useEffect(() => { localStorage.setItem('favTeams', JSON.stringify(favTeams)); }, [favTeams]);
  useEffect(() => { localStorage.setItem('favPlayers', JSON.stringify(favPlayers)); }, [favPlayers]);
  useEffect(() => { localStorage.setItem('fantasyTeam', JSON.stringify(fantasyTeam)); }, [fantasyTeam]);

  const toggleFavTeam = (abbrev) => {
      setFavTeams(prev => prev.includes(abbrev) ? prev.filter(t => t !== abbrev) : [...prev, abbrev]);
  };

  const toggleFavPlayer = (playerId) => {
      setFavPlayers(prev => prev.includes(playerId) ? prev.filter(p => p !== playerId) : [...prev, playerId]);
  };

  // Funktio Fantasy-joukkueen rakentamiseen
  const toggleFantasyPlayer = (player) => {
      const isAlreadyIn = fantasyTeam.some(p => p.id === player.id);
      
      if (isAlreadyIn) {
          setFantasyTeam(prev => prev.filter(p => p.id !== player.id));
      } else {
          const isGoalie = player.position === 'G' || player.position === 'Goalie';
          const isDef = player.position === 'D' || player.position === 'Defenseman';
          const isFwd = !isGoalie && !isDef;

          const currentG = fantasyTeam.filter(p => p.position === 'G' || p.position === 'Goalie').length;
          const currentD = fantasyTeam.filter(p => p.position === 'D' || p.position === 'Defenseman').length;
          const currentF = fantasyTeam.filter(p => p.position !== 'G' && p.position !== 'Goalie' && p.position !== 'D' && p.position !== 'Defenseman').length;

          if (isGoalie && currentG >= 1) return alert("Fantasy-joukkueessa voi olla vain 1 maalivahti!");
          if (isDef && currentD >= 2) return alert("Fantasy-joukkueessa voi olla vain 2 puolustajaa!");
          if (isFwd && currentF >= 3) return alert("Fantasy-joukkueessa voi olla vain 3 hyökkääjää!");

          setFantasyTeam(prev => [...prev, { id: player.id, name: player.name || `${player.firstName?.default} ${player.lastName?.default}`, position: player.position }]);
      }
  };

  const renderView = () => {
    switch (currentView) {
      case 'home': 
          return <HomePage onPlayerClick={handleOpenPlayer} onGameClick={handleOpenGame} favTeams={favTeams} toggleFavTeam={toggleFavTeam} favPlayers={favPlayers} toggleFavPlayer={toggleFavPlayer} fantasyTeam={fantasyTeam} toggleFantasyPlayer={toggleFantasyPlayer} onFantasyClick={handleOpenFantasy} language={language} />;
      case 'calendar': 
          return <CalendarPage onTeamClick={handleOpenTeam} language={language} />;
      case 'standings': 
          return <StandingsPage onTeamClick={handleOpenTeam} language={language} />; 
      case 'stats': 
          return <StatsPage onOpenTeletext={handleOpenTeletext} language={language} />;
      default: 
          return <HomePage onPlayerClick={handleOpenPlayer} onGameClick={handleOpenGame} language={language} />;
    }
  };

  return (
    <>
      <SplashScreen />
      <div className="app-container">
    
        <TopBar 
            onOpenSettings={() => forceOpenRootModal('settings')} 
            onOpenSearch={() => forceOpenRootModal('search')}
            language={language}
            activeLeague={activeLeague}
            setActiveLeague={setActiveLeague}
        />
        
        <main className="app-view active-view">
            {activeLeague === 'NHL' ? renderView() : (
                <LiigaLive 
                    currentView={currentLiigaView} 
                    onPlayerClick={(id) => setSelectedLiigaPlayer(id)}
                    onTeamClick={(abbrev) => setSelectedLiigaTeam(abbrev)}
                    favTeams={favTeams}
                    favPlayers={favPlayers}
                    toggleFavPlayer={toggleFavPlayer}
                />
            )}
        </main>

        {activeLeague === 'NHL' ? (
            <BottomNav currentView={currentView} setCurrentView={setCurrentView} language={language} />
        ) : (
            <LiigaBottomNav currentView={currentLiigaView} setCurrentView={setCurrentLiigaView} />
        )}

        {selectedLiigaPlayer && (
            <LiigaPlayerCard 
                isOpen={true} 
                playerId={selectedLiigaPlayer} 
                onClose={() => setSelectedLiigaPlayer(null)} 
                favPlayers={favPlayers}
                toggleFavPlayer={toggleFavPlayer}
            />
        )}

        {selectedLiigaTeam && (
            <LiigaTeamModal 
                isOpen={true} 
                teamAbbrev={selectedLiigaTeam} 
                onClose={() => setSelectedLiigaTeam(null)} 
                onPlayerClick={(id) => setSelectedLiigaPlayer(id)} 
                favTeams={favTeams}
                toggleFavTeam={toggleFavTeam}
            />
        )}
        
        <SettingsModal 
            isOpen={activeModal === 'settings'} 
            onClose={closeCurrentModal} 
            onChangeModal={navigateToModal}
            currentTheme={theme}
            onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            language={language}
            setLanguage={setLanguage}
        />
        
        <UpdatesModal 
            isOpen={activeModal === 'updates'} 
            onClose={closeCurrentModal} 
            language={language}
        />
        
        <InfoModal 
            isOpen={activeModal === 'info'} 
            onClose={closeCurrentModal} 
            language={language}
        />
        
        <FeedbackModal 
            isOpen={activeModal === 'feedback'} 
            onClose={closeCurrentModal} 
            language={language}
        />
        
        <SearchModal 
            isOpen={activeModal === 'search'} 
            activeLeague={activeLeague}
            onClose={closeCurrentModal} 
            onPlayerClick={(id) => {
                if (activeLeague === 'NHL') {
                    handleOpenPlayer(id); 
                } else {
                    closeCurrentModal(); 
                    setSelectedLiigaPlayer(id); 
                }
            }}
            onTeamClick={(abbrev) => {
                if (activeLeague === 'NHL') {
                    handleOpenTeam(abbrev); 
                } else {
                    closeCurrentModal(); 
                    setSelectedLiigaTeam(abbrev); 
                }
            }} 
            language={language}
        />

        <PlayerModal 
            isOpen={activeModal === 'player'} 
            onClose={closeCurrentModal} 
            playerId={selectedPlayerId} 
            favPlayers={favPlayers}
            toggleFavPlayer={toggleFavPlayer}
            fantasyTeam={fantasyTeam}
            toggleFantasyPlayer={toggleFantasyPlayer}
            language={language}
        />

        <GameModal 
            isOpen={activeModal === 'game'} 
            onClose={closeCurrentModal} 
            gameData={selectedGame} 
            onTeamClick={handleOpenTeam}
            onPlayerClick={handleOpenPlayer}
            language={language}
        />

        <TeamModal 
            isOpen={activeModal === 'team'} 
            onClose={closeCurrentModal} 
            teamAbbrev={selectedTeam} 
            onPlayerClick={handleOpenPlayer}
            onGameClick={handleOpenGame}
            language={language}
        />

        <TeletextModal 
            isOpen={activeModal === 'teletext'} 
            onClose={closeCurrentModal} 
            pageType={teletextType}
            onPlayerClick={handleOpenPlayer} 
            language={language}
        />

        <PredictionModal 
            isOpen={activeModal === 'predictions'} 
            onClose={closeCurrentModal} 
            onPlayerClick={handleOpenPlayer} 
            language={language}
        />

        <FantasyModal 
            isOpen={activeModal === 'fantasy'} 
            onClose={closeCurrentModal} 
            playerId={selectedPlayerId}
            fantasyTeam={fantasyTeam}
            toggleFantasyPlayer={toggleFantasyPlayer}
            language={language}
        />

        {selectedLiigaPlayer && (
            <LiigaPlayerCard 
                isOpen={true} 
                playerId={selectedLiigaPlayer} 
                onClose={() => setSelectedLiigaPlayer(null)} 
                favPlayers={favPlayers}
                toggleFavPlayer={toggleFavPlayer}
            />
        )}

        {selectedLiigaTeam && (
            <LiigaTeamModal 
                isOpen={true} 
                teamAbbrev={selectedLiigaTeam} 
                onClose={() => setSelectedLiigaTeam(null)} 
                onPlayerClick={(id) => setSelectedLiigaPlayer(id)} 
                favTeams={favTeams}
                toggleFavTeam={toggleFavTeam}
            />
        )}

      </div>
    </>
  );
}

export default App;