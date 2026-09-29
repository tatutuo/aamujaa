import React from 'react';

/**
 * Valitsin: rivi toisensa poissulkevia vaihtoehtoja (esim. Divisioonat /
 * Konferenssit / Liiga). Radioryhmä semanttisesti, jotta ruudunlukija kertoo
 * mikä on valittu ja montako vaihtoehtoa on.
 */
export default function Segmented({ options, value, onChange, label, size = 'md' }) {
    return (
        <div className={`segmented segmented-${size}`} role="radiogroup" aria-label={label}>
            {options.map((option) => {
                const selected = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`segmented-option ${selected ? 'is-selected' : ''}`}
                        onClick={() => onChange(option.value)}
                    >
                        {option.icon && <option.icon size={16} stroke={1.9} aria-hidden="true" />}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
