import React from 'react';
import { formatLong } from '../utils/dates';

const DateNavigation = ({ currentDateObj, onPrevDay, onNextDay, onRefresh, isRefreshing, language }) => {
    const isFi = language === 'fi';

    return (
        <div className="date-nav">
            <span className="date-nav-label">{isFi ? 'OTTELUKIERROS' : 'GAMEDAY'}</span>

            <div className="date-nav-row">
                <button
                    type="button"
                    className="sched-filter-btn date-nav-arrow"
                    onClick={onPrevDay}
                    aria-label={isFi ? 'Edellinen päivä' : 'Previous day'}
                >
                    &#10094;
                </button>

                <div className="date-nav-current">
                    <span aria-hidden="true">🏒</span>
                    <span>{formatLong(currentDateObj, language)}</span>

                    {onRefresh && (
                        <button
                            type="button"
                            className={`date-nav-refresh ${isRefreshing ? 'is-spinning' : ''}`}
                            onClick={onRefresh}
                            aria-label={isFi ? 'Päivitä' : 'Refresh'}
                        >
                            🔄
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    className="sched-filter-btn date-nav-arrow"
                    onClick={onNextDay}
                    aria-label={isFi ? 'Seuraava päivä' : 'Next day'}
                >
                    &#10095;
                </button>
            </div>
        </div>
    );
};

export default DateNavigation;
