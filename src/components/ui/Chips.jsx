import React from 'react';

/**
 * Suodatinsirut: yksi valittuna kerrallaan. Vieritettävä rivi, jos sirut
 * eivät mahdu (esim. monta seurattua kansallisuutta).
 */
export default function Chips({ options, value, onChange, label }) {
    return (
        <div className="chips" role="radiogroup" aria-label={label}>
            {options.map((option) => {
                const selected = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`chip ${selected ? 'is-selected' : ''}`}
                        onClick={() => onChange(option.value)}
                    >
                        {option.label}
                        {typeof option.count === 'number' && <span className="chip-count">{option.count}</span>}
                    </button>
                );
            })}
        </div>
    );
}
