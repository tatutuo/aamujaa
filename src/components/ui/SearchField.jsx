import React from 'react';
import { IconSearch, IconX } from '@tabler/icons-react';

/** Hakukenttä listan suodattamiseen nimellä. */
export default function SearchField({ value, onChange, placeholder }) {
    return (
        <label className="search-field">
            <IconSearch size={16} stroke={1.9} aria-hidden="true" />
            <input
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                autoComplete="off"
                spellCheck={false}
            />
            {value && (
                <button type="button" className="search-clear" onClick={() => onChange('')} aria-label="Tyhjennä">
                    <IconX size={14} stroke={2} aria-hidden="true" />
                </button>
            )}
        </label>
    );
}
