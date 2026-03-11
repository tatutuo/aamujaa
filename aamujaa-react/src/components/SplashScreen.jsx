import React, { useState, useEffect } from 'react';

const SplashScreen = () => {
    const [isVisible, setIsVisible] = useState(true);
    const [opacity, setOpacity] = useState(1);

    useEffect(() => {
        const timer = setTimeout(() => {
            setOpacity(0); 
            setTimeout(() => setIsVisible(false), 500); 
        }, 2000); 

        return () => clearTimeout(timer);
    }, []);

    if (!isVisible) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: '#000', zIndex: 999999,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            opacity: opacity, transition: 'opacity 0.5s ease-out'
        }}>
            <div style={{
                position: 'relative', width: '100%', height: '100%', maxWidth: '600px',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                padding: '15%', // TÄMÄ PIENENTÄÄ KUVAA RUUDULLA
                boxShadow: 'inset 0 0 100px rgba(0, 212, 255, 0.5), inset 0 0 40px rgba(255, 215, 0, 0.2)'
            }}>
                <img 
                    src="./splash.png" 
                    alt="Aamujää" 
                    style={{
                        maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '12px',
                        animation: 'slowZoom 2.5s ease-out forwards'
                    }} 
                />
            </div>
            
            <style>{`
                @keyframes slowZoom {
                    0% { transform: scale(0.85); filter: brightness(0.7); }
                    100% { transform: scale(1.0); filter: brightness(1.1); }
                }
            `}</style>
        </div>
    );
};

export default SplashScreen;