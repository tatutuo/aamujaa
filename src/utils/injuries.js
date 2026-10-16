/**
 * Loukkaantumisten tilat ja vammatyypit suomeksi (lähde ESPN).
 * Rivikomponentit: components/Injuries.jsx.
 */

/** ESPN:n pelipaikat NHL:n koodeiksi. */
export const ESPN_POSITIONS = { LW: 'L', RW: 'R', C: 'C', D: 'D', G: 'G', F: 'C' };

const STATUS = {
    'IR-LT': { fi: 'Pitkäaikainen IR', en: 'Long-term IR', tone: 'long' },
    IR: { fi: 'Loukkaantuneiden lista', en: 'Injured reserve', tone: 'long' },
    'IR-NR': { fi: 'Loukkaantuneiden lista', en: 'Injured reserve', tone: 'long' },
    'Day-To-Day': { fi: 'Päivä kerrallaan', en: 'Day-to-day', tone: 'short' },
    OUT: { fi: 'Sivussa', en: 'Out', tone: 'out' },
};

const INJURY_TYPES = {
    'Lower Body': 'Alavartalo', 'Upper Body': 'Ylävartalo', Undisclosed: 'Ei kerrottu', Knee: 'Polvi',
    Shoulder: 'Olkapää', Hip: 'Lonkka', Abdomen: 'Vatsa', Concussion: 'Aivotärähdys', Foot: 'Jalkaterä',
    Personal: 'Henkilökohtainen syy', 'Lower Leg': 'Sääri', Groin: 'Nivus', Pectoral: 'Rintalihas', Hand: 'Käsi',
    Back: 'Selkä', Ankle: 'Nilkka', Wrist: 'Ranne', Illness: 'Sairaus', Head: 'Pää', Leg: 'Jalka',
    Achilles: 'Akillesjänne', Elbow: 'Kyynärpää', Neck: 'Niska', Face: 'Kasvot', Hamstring: 'Takareisi',
    Thumb: 'Peukalo', Finger: 'Sormi', Rib: 'Kylkiluu', Oblique: 'Kylki', Calf: 'Pohje', Arm: 'Käsivarsi',
    Eye: 'Silmä', Jaw: 'Leuka', Collarbone: 'Solisluu', Chest: 'Rintakehä', Quadriceps: 'Etureisi',
    Suspension: 'Pelikielto', 'Contract Dispute': 'Sopimuskiista', 'Not Injury Related': 'Muu kuin loukkaantuminen',
    Heel: 'Kantapää', Toe: 'Varvas', Forearm: 'Kyynärvarsi', Spleen: 'Perna', Lung: 'Keuhko', Nose: 'Nenä',
};

export function statusOf(row, lang) {
    if (row.status === 'Suspension') return { label: lang === 'en' ? 'Suspended' : 'Pelikielto', tone: 'out' };
    const s = STATUS[row.statusCode] ?? STATUS[row.status];
    return s ? { label: s[lang], tone: s.tone } : { label: row.status, tone: 'out' };
}

export function typeOf(row, lang) {
    // Pelikielto näkyy jo tilassa; ei toisteta sitä vammana.
    if (!row.type || row.status === 'Suspension') return null;
    return lang === 'en' ? row.type : (INJURY_TYPES[row.type] ?? row.type);
}
