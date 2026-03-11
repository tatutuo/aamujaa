import React from 'react';

const LiigaBottomNav = ({ currentView, setCurrentView }) => {
    
    // Apufunktio: Yhteiset tyylit jokaiselle napille, jotta koodi pysyy siistinä
    const getBtnStyle = (isActive) => ({
        background: 'transparent', // Poistaa valkoisen taustan!
        border: 'none',            // Poistaa selaimen oletusrajat
        display: 'flex',
        flexDirection: 'column',   // Asettaa kuvakkeen ylös, tekstin alas
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,                   // Jakaa tila tasan 3 napin kesken
        height: '100%',
        cursor: 'pointer',
        color: isActive ? '#ff6600' : '#888', // Aktiivinen oranssi, muut harmaa
        transition: 'color 0.2s, transform 0.2s',
        transform: isActive ? 'translateY(-2px)' : 'none', // Pieni "nosto" aktiiviselle napille
        padding: 0
    });

    return (
        <nav className="bottom-nav" style={{ display: 'flex', justifyContent: 'space-around', height: '65px', borderTop: '2px solid #ff6600', background: '#0a0e17' }}>
            
            <button 
                onClick={() => setCurrentView('home')}
                style={getBtnStyle(currentView === 'home')}
            >
                <span style={{ fontSize: '1.5rem', marginBottom: '4px', filter: currentView === 'home' ? 'none' : 'grayscale(1)' }}>
                    🏒
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1px' }}>
                    OTTELUT
                </span>
            </button>
            
            <button 
                onClick={() => setCurrentView('standings')}
                style={getBtnStyle(currentView === 'standings')}
            >
                <span style={{ fontSize: '1.5rem', marginBottom: '4px', filter: currentView === 'standings' ? 'none' : 'grayscale(1)' }}>
                    📊
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1px' }}>
                    TAULUKOT
                </span>
            </button>
            
            <button 
                onClick={() => setCurrentView('stats')}
                style={getBtnStyle(currentView === 'stats')}
            >
                <span style={{ fontSize: '1.5rem', marginBottom: '4px', filter: currentView === 'stats' ? 'none' : 'grayscale(1)' }}>
                    ⭐
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1px' }}>
                    TILASTOT
                </span>
            </button>

        </nav>
    );
};

export default LiigaBottomNav;