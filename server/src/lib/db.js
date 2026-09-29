import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { brierScore } from '../predictions/math.js';

/**
 * Ennusteiden tallennus.
 *
 * Vaihdettu sqlite3 → better-sqlite3: synkroninen API poistaa vanhan koodin
 * callback-suppilot ja new Promise -kääreet, ja se on nopeampi. Tietokannassa on
 * enää yksi taulu — vanhan app.js:n vieraskirja ja admin-kirjautuminen eivät
 * kuulu Aamujäähän.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '..', 'data');

fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'aamujaa.db'));

db.pragma('journal_mode = WAL');

db.exec(`
    CREATE TABLE IF NOT EXISTS predictions (
        date         TEXT PRIMARY KEY,
        players_json TEXT NOT NULL DEFAULT '[]',
        teams_json   TEXT NOT NULL DEFAULT '[]',
        matches_json TEXT NOT NULL DEFAULT '[]',
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prediction_results (
        game_id           INTEGER PRIMARY KEY,
        date              TEXT NOT NULL,
        predicted_winner  TEXT,
        actual_winner     TEXT,
        home_win_prob     INTEGER,
        -- Tarkka todennäköisyys talletetaan erikseen: Brier-pisteitä ei voi
        -- laskea pyöristetystä prosenttiluvusta ilman virhettä.
        home_win_probability REAL,
        home_won          INTEGER,
        correct           INTEGER,
        checked_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_results_date ON prediction_results(date);
`);

/**
 * Kevyt migraatio olemassa oleville tietokannoille.
 *
 * CREATE TABLE IF NOT EXISTS ei lisää uusia sarakkeita vanhaan tauluun, joten
 * ilman tätä jo kertaalleen ajettu palvelin kaatuisi käynnistyksessä. Puuttuvat
 * sarakkeet lisätään yksitellen; jo olemassa oleva sarake ei ole virhe.
 */
function ensureColumns(table, columns) {
    const existing = new Set(db.pragma(`table_info(${table})`).map((c) => c.name));
    for (const [name, definition] of Object.entries(columns)) {
        if (!existing.has(name)) {
            db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
            console.log(`[tietokanta] Lisätty sarake ${table}.${name}`);
        }
    }
}

ensureColumns('prediction_results', {
    home_win_probability: 'REAL',
    home_won: 'INTEGER',
});

const statements = {
    savePredictions: db.prepare(`
        INSERT INTO predictions (date, players_json, teams_json, matches_json)
        VALUES (@date, @players, @teams, @matches)
        ON CONFLICT(date) DO UPDATE SET
            players_json = excluded.players_json,
            teams_json   = excluded.teams_json,
            matches_json = excluded.matches_json,
            created_at   = datetime('now')
    `),
    getByDate: db.prepare('SELECT * FROM predictions WHERE date = ?'),
    listDates: db.prepare('SELECT date FROM predictions ORDER BY date DESC LIMIT ?'),
    // Ei koskaan poisteta juuri kirjoitettua riviä, vaikka sen päivämäärä olisi
    // säilytysikkunan ulkopuolella (esim. kun ennusteita lasketaan takautuvasti).
    pruneOld: db.prepare("DELETE FROM predictions WHERE date < date('now', '-90 days') AND date != ?"),
    saveResult: db.prepare(`
        INSERT INTO prediction_results
            (game_id, date, predicted_winner, actual_winner, home_win_prob, home_win_probability, home_won, correct)
        VALUES
            (@gameId, @date, @predictedWinner, @actualWinner, @homeWinProb, @homeWinProbability, @homeWon, @correct)
        ON CONFLICT(game_id) DO UPDATE SET
            actual_winner = excluded.actual_winner,
            home_won      = excluded.home_won,
            correct       = excluded.correct,
            checked_at    = datetime('now')
    `),
    scoredResults: db.prepare(`
        SELECT home_win_probability AS probability, home_won AS outcome
        FROM prediction_results
        WHERE date >= date('now', ?) AND home_win_probability IS NOT NULL
    `),
    accuracy: db.prepare(`
        SELECT COUNT(*) AS total, SUM(correct) AS hits
        FROM prediction_results
        WHERE date >= date('now', ?)
    `),
};

export function savePredictions(date, { players, teams, matches }) {
    statements.savePredictions.run({
        date,
        players: JSON.stringify(players ?? []),
        teams: JSON.stringify(teams ?? []),
        matches: JSON.stringify(matches ?? []),
    });
    statements.pruneOld.run(date);
}

export function getPredictions(date) {
    const row = statements.getByDate.get(date);
    if (!row) return null;
    return {
        date: row.date,
        players: JSON.parse(row.players_json),
        teams: JSON.parse(row.teams_json),
        matches: JSON.parse(row.matches_json),
        createdAt: row.created_at,
    };
}

export function listPredictionDates(limit = 60) {
    return statements.listDates.all(limit).map((r) => r.date);
}

export function saveResult(result) {
    statements.saveResult.run(result);
}

/**
 * Osumatarkkuus viimeisiltä n päivältä.
 * Tämä puuttui kokonaan vanhasta versiosta: ennusteita tehtiin, mutta kukaan ei
 * koskaan mitannut osuivatko ne. Ilman mittaria mallia ei voi parantaa.
 */
export function getAccuracy(days = 30) {
    const row = statements.accuracy.get(`-${days} days`);
    const total = row?.total ?? 0;
    const hits = row?.hits ?? 0;

    // Osumaprosentti yksin ei kerro mallin laadusta tarpeeksi: se ei erottele
    // varmaa oikeaa arvausta täpärästä. Brier-pisteet mittaavat myös sen,
    // olivatko todennäköisyydet oikean suuruisia.
    const scored = statements.scoredResults.all(`-${days} days`);
    const brier = brierScore(scored);

    return {
        days,
        total,
        hits,
        percentage: total > 0 ? Math.round((hits / total) * 100) : null,
        brierScore: brier === null ? null : Number(brier.toFixed(4)),
        // Vertailukohta: 0.25 vastaa kolikonheittoa.
        coinFlipBrier: 0.25,
    };
}
