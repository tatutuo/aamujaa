/**
 * Odotettujen maalien (xG) mallin sovitus.
 *
 * Ajo:  node scripts/fit-xg.js [otteluita=600] [kausi=20252026]
 *
 * Hakee satunnaisotoksen kauden runkosarjaotteluista, poimii jokaisesta
 * torjumattomasta laukausyrityksestä (maali, torjuttu, ohi) piirteet ja
 * sovittaa logistisen regression. Tulostaa kertoimet muodossa, jonka voi
 * liittää tiedostoon src/lib/xg.js, sekä tarkkuuden erillisellä
 * testiotoksella (log loss, AUC, kalibrointi).
 *
 * Piirteet laskee sama koodi kuin sovelluksessa (src/lib/xg.js), joten
 * malli ja käyttö eivät voi erota toisistaan.
 */
import { shotFeatures, FEATURE_NAMES } from '../src/lib/xg.js';

const GAMES = Number(process.argv[2] ?? 600);
const SEASON = process.argv[3] ?? '20252026';

let failed = 0;
const saved = [];

/** Rauhallisesti: NHL vastaa 429:llä, jos pyyntöjä tulee liian tiheään. */
async function fetchJson(url) {
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'pucknower-xg-fit/1.0 (+https://d4nyyy.fi/hockey)', Accept: 'application/json' } });
            if (res.ok) return await res.json();
            if (res.status === 404) return null;
        } catch { /* uusi yritys */ }
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
    failed++;
    return null;
}

function sampleIds() {
    const ids = [];
    for (let n = 1; n <= 1312; n++) ids.push(Number(`${SEASON.slice(0, 4)}02${String(n).padStart(4, '0')}`));
    // Fisher–Yates kiinteällä siemenellä: sama otos joka ajolla.
    let seed = 12345;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids.slice(0, GAMES);
}

async function collect() {
    const ids = sampleIds();
    const rows = [];
    let done = 0;
    let index = 0;
    const worker = async () => {
        while (index < ids.length) {
            const id = ids[index++];
            const pbp = await fetchJson(`https://api-web.nhle.com/v1/gamecenter/${id}/play-by-play`);
            done++;
            if (!pbp) continue;
            const plays = pbp.plays ?? [];
            if (process.env.XG_SAVE) {
                saved.push({
                    id,
                    homeId: pbp.homeTeam?.id,
                    plays: plays.map((p) => ({
                        typeDescKey: p.typeDescKey, timeInPeriod: p.timeInPeriod, situationCode: p.situationCode,
                        homeTeamDefendingSide: p.homeTeamDefendingSide, periodDescriptor: p.periodDescriptor,
                        details: p.details && {
                            xCoord: p.details.xCoord, yCoord: p.details.yCoord, zoneCode: p.details.zoneCode,
                            eventOwnerTeamId: p.details.eventOwnerTeamId, shotType: p.details.shotType,
                        },
                    })),
                });
            }
            for (let i = 0; i < plays.length; i++) {
                const f = shotFeatures(plays, i, pbp.homeTeam?.id);
                if (!f || f.emptyNet) continue;
                rows.push({ x: f.vector, y: f.goal ? 1 : 0, game: id });
            }
            if (done % 100 === 0) process.stderr.write(`  ${done}/${ids.length} ottelua, ${rows.length} laukausta, epäonnistui ${failed}\n`);
            await new Promise((r) => setTimeout(r, 150));
        }
    };
    await Promise.all(Array.from({ length: 3 }, worker));
    process.stderr.write(`Valmis: ${rows.length} laukausta, epäonnistuneita otteluita ${failed}\n`);
    if (process.env.XG_SAVE) {
        const fs = await import('node:fs');
        fs.writeFileSync(process.env.XG_SAVE, JSON.stringify(saved));
    }
    return rows;
}

function fit(rows, { epochs = 400, lr = 0.5, l2 = 1e-4 } = {}) {
    const k = rows[0].x.length;
    const mean = Array(k).fill(0);
    const sd = Array(k).fill(0);
    for (const r of rows) r.x.forEach((v, j) => { mean[j] += v / rows.length; });
    for (const r of rows) r.x.forEach((v, j) => { sd[j] += (v - mean[j]) ** 2 / rows.length; });
    for (let j = 0; j < k; j++) sd[j] = Math.sqrt(sd[j]) || 1;
    const z = rows.map((r) => r.x.map((v, j) => (v - mean[j]) / sd[j]));

    const w = Array(k).fill(0);
    let b = Math.log(rows.reduce((s, r) => s + r.y, 0) / rows.length / (1 - rows.reduce((s, r) => s + r.y, 0) / rows.length));
    for (let e = 0; e < epochs; e++) {
        const gw = Array(k).fill(0);
        let gb = 0;
        for (let i = 0; i < rows.length; i++) {
            const p = 1 / (1 + Math.exp(-(b + z[i].reduce((s, v, j) => s + v * w[j], 0))));
            const err = p - rows[i].y;
            gb += err;
            for (let j = 0; j < k; j++) gw[j] += err * z[i][j];
        }
        b -= (lr * gb) / rows.length;
        for (let j = 0; j < k; j++) w[j] -= lr * (gw[j] / rows.length + l2 * w[j]);
    }
    // Takaisin alkuperäiseen mittakaavaan: kertoimet suoraan raakapiirteille.
    const raw = w.map((v, j) => v / sd[j]);
    const intercept = b - w.reduce((s, v, j) => s + (v * mean[j]) / sd[j], 0);
    return { intercept, weights: raw };
}

const predict = (model, x) => 1 / (1 + Math.exp(-(model.intercept + x.reduce((s, v, j) => s + v * model.weights[j], 0))));

function evaluate(model, rows) {
    const ps = rows.map((r) => predict(model, r.x));
    const base = rows.reduce((s, r) => s + r.y, 0) / rows.length;
    const ll = (p, y) => -(y * Math.log(Math.max(p, 1e-9)) + (1 - y) * Math.log(Math.max(1 - p, 1e-9)));
    const logLoss = rows.reduce((s, r, i) => s + ll(ps[i], r.y), 0) / rows.length;
    const baseLoss = rows.reduce((s, r) => s + ll(base, r.y), 0) / rows.length;

    // AUC rankingin kautta.
    const order = rows.map((r, i) => [ps[i], r.y]).sort((a, b) => a[0] - b[0]);
    let rankSum = 0;
    let pos = 0;
    order.forEach(([, y], i) => { if (y) { rankSum += i + 1; pos++; } });
    const neg = rows.length - pos;
    const auc = (rankSum - (pos * (pos + 1)) / 2) / (pos * neg);

    // Kalibrointi kymmenyksittäin.
    const deciles = Array.from({ length: 10 }, () => ({ xg: 0, goals: 0, n: 0 }));
    order.forEach(([p, y], i) => {
        const d = deciles[Math.min(9, Math.floor((i / order.length) * 10))];
        d.xg += p; d.goals += y; d.n++;
    });
    return {
        shots: rows.length,
        goals: pos,
        xg: ps.reduce((s, p) => s + p, 0),
        logLoss, baseLoss, auc,
        calibration: deciles.map((d) => `${(d.xg / d.n * 100).toFixed(1)}% vs ${(d.goals / d.n * 100).toFixed(1)}%`),
    };
}

/*
 * Tapahtumat voi tallentaa välimuistiin (XG_CACHE=polku), jolloin mallia
 * voi kokeilla uudelleen hakematta otteluita joka kerta NHL:ltä.
 */
async function loadRows() {
    const cache = process.env.XG_CACHE;
    const fs = await import('node:fs');
    if (cache && fs.existsSync(cache)) {
        const games = JSON.parse(fs.readFileSync(cache, 'utf8'));
        const rows = [];
        for (const g of games) {
            for (let i = 0; i < g.plays.length; i++) {
                const f = shotFeatures(g.plays, i, g.homeId);
                if (!f || f.emptyNet) continue;
                rows.push({ x: f.vector, y: f.goal ? 1 : 0, game: g.id, f });
            }
        }
        return rows;
    }
    if (cache) process.env.XG_SAVE = cache;
    return collect();
}

const rows = await loadRows();
// Testiotos otteluittain, ettei saman ottelun laukauksia ole molemmissa.
const testGames = new Set([...new Set(rows.map((r) => r.game))].filter((_, i) => i % 5 === 0));
const train = rows.filter((r) => !testGames.has(r.game));
const test = rows.filter((r) => testGames.has(r.game));

const model = fit(train);
console.log('Opetus:', JSON.stringify(evaluate(model, train), null, 1));
console.log('Testi:', JSON.stringify(evaluate(model, test), null, 1));
console.log('\nexport const MODEL = {');
console.log(`    season: '${SEASON}', games: ${GAMES}, shots: ${rows.length},`);
console.log(`    intercept: ${model.intercept.toFixed(5)},`);
console.log('    weights: {');
FEATURE_NAMES.forEach((name, j) => console.log(`        ${JSON.stringify(name)}: ${model.weights[j].toFixed(5)},`));
console.log('    },\n};');
