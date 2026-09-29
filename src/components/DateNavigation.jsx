import React from 'react';
import { IconChevronLeft, IconChevronRight, IconRefresh } from '@tabler/icons-react';

/** "lauantai 26. syyskuuta" -> "Lauantai 26. syyskuuta". */
function dayLabel(date, language) {
    const text = date.toLocaleDateString(language === 'fi' ? 'fi-FI' : 'en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Ottelukierroksen valinta etusivulla: edellinen / nykyinen / seuraava.
 * "Tänään" ilmestyy vain kun ollaan jollain muulla kierroksella, jotta
 * paluu nykyiseen on yksi napautus eikä monta nuolta.
 */
const DateNavigation = ({ currentDateObj, onPrevDay, onNextDay, onRefresh, isRefreshing, onToday, isToday, language }) => {
    const fi = language !== 'en';

    return (
        <div className="date-nav">
            <div className="date-nav-top">
                <span className="date-nav-label">{fi ? 'Ottelukierros' : 'Game day'}</span>
                {!isToday && onToday && (
                    <button type="button" className="date-nav-today" onClick={onToday}>
                        {fi ? 'Tänään' : 'Today'}
                    </button>
                )}
            </div>

            <div className="date-nav-row">
                <button
                    type="button"
                    className="date-nav-arrow"
                    onClick={onPrevDay}
                    aria-label={fi ? 'Edellinen päivä' : 'Previous day'}
                >
                    <IconChevronLeft size={20} stroke={2} aria-hidden="true" />
                </button>

                <div className="date-nav-current">
                    <span className="date-nav-day">{dayLabel(currentDateObj, language)}</span>
                    {onRefresh && (
                        <button
                            type="button"
                            className={`date-nav-refresh ${isRefreshing ? 'is-spinning' : ''}`}
                            onClick={onRefresh}
                            aria-label={fi ? 'Päivitä' : 'Refresh'}
                        >
                            <IconRefresh size={16} stroke={2} aria-hidden="true" />
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    className="date-nav-arrow"
                    onClick={onNextDay}
                    aria-label={fi ? 'Seuraava päivä' : 'Next day'}
                >
                    <IconChevronRight size={20} stroke={2} aria-hidden="true" />
                </button>
            </div>
        </div>
    );
};

export default DateNavigation;
