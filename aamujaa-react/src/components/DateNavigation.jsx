import React from 'react';

const DateNavigation = ({ currentDateObj, onPrevDay, onNextDay, onRefresh, isRefreshing, language, theme }) => {
    const formattedDate = currentDateObj.toLocaleDateString(
        language === 'fi' ? 'fi-FI' : 'en-US', 
        { weekday: 'short', day: 'numeric', month: 'long' }
    ).toUpperCase();

    // Määritellään pääväri teeman mukaan
    const mainColor = theme === 'liiga' ? '#ff6600' : '#00d4ff';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '20px 0 30px 0', width: '100%', boxSizing: 'border-box', padding: '0 5px' }}>
            
            <span style={{ color: mainColor, fontSize: '0.75rem', letterSpacing: '2px', fontWeight: 'bold', marginBottom: '8px' }}>
                {language === 'fi' ? 'OTTELUKIERROS' : 'GAMEDAY'}
            </span>
            
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', width: '100%' }}>
                
                <button className="sched-filter-btn" onClick={onPrevDay} style={{ fontSize: '1.2rem', padding: '6px 14px', borderRadius: '20px', flexShrink: 0 }}>
                    &#10094;
                </button>
                
                <div style={{ fontSize: 'clamp(1rem, 4vw, 1.5rem)', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.4rem' }}>🏒</span>
                    {formattedDate}
                    
                    {onRefresh && (
                        <button 
                            onClick={onRefresh} 
                            style={{ 
                                background: 'none', border: 'none', cursor: 'pointer', 
                                fontSize: '1.3rem', padding: '0', 
                                color: mainColor, 
                                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                                marginLeft: '2px'
                            }}
                            title="Päivitä"
                        >
                            🔄
                        </button>
                    )}
                </div>

                <button className="sched-filter-btn" onClick={onNextDay} style={{ fontSize: '1.2rem', padding: '6px 14px', borderRadius: '20px', flexShrink: 0 }}>
                    &#10095;
                </button>
            </div>
        </div>
    );
};

export default DateNavigation;