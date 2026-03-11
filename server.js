require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const app = express();
const nodemailer = require('nodemailer');

const ADMIN_TUNNUS = process.env.ADMIN_TUNNUS;
const ADMIN_SALASANA = process.env.ADMIN_SALASANA;

// --- MIDDLEWARET ---
app.use(express.json());

// ==========================================
// 1. SIVUT (HTML/CSS) - NÄMÄ OVAT KANSIOITA
// ==========================================

app.use('/guestbook', express.static(path.join(__dirname, 'public', 'guestbook')));
app.use('/space', express.static(path.join(__dirname, 'public', 'space')));
app.use('/hockey', express.static(path.join(__dirname, 'public', 'hockey')));
app.use('/dinos', express.static(path.join(__dirname, 'public', 'dinos')));

// ==========================================
// 8. ETUSIVU (BENTO BOX PORTAALI)
// ==========================================

app.use(express.static(path.join(__dirname, 'public'))); 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================
// 2. TIETOKANTA
// ==========================================
const dbPath = path.join(__dirname, 'vieraskirja.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Virhe tietokannassa:', err.message);
    else console.log('Tietokanta OK');
});

const initDb = () => {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS viestit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nimi TEXT,
            teksti TEXT,
            piilotettu INTEGER DEFAULT 0, 
            aika DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS ai_predictions (
            date TEXT PRIMARY KEY,
            players_json TEXT,
            teams_json TEXT,
            matches_json TEXT
        )`);

        // Yritetään lisätä matches_json sarake, jos sitä ei vielä ole (estää kaatumisen vanhalla tietokannalla)
        db.run(`ALTER TABLE ai_predictions ADD COLUMN matches_json TEXT`, (err) => {
            // Virhe on normaali, jos sarake on jo olemassa
        });
    });
};
initDb();

// ==========================================
// 3. API-KOMENNOT
// ==========================================

app.post('/appi/lisaa-viesti', (req, res) => {
    const { nimi, teksti } = req.body;
    const sql = `INSERT INTO viestit (nimi, teksti) VALUES (?, ?)`;
    db.run(sql, [nimi, teksti], function(err) {
        if (err) return res.status(500).json({ virhe: err.message });
        res.json({ viesti: 'OK', id: this.lastID });
    });
});

app.get('/appi/hae-viestit', (req, res) => {
    const sql = "SELECT * FROM viestit WHERE piilotettu = 0 ORDER BY aika DESC";
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ virhe: err.message });
        res.json(rows);
    });
});

app.post('/appi/hae-admin-viestit', (req, res) => {
    const { tunnus, salasana } = req.body;
    if (tunnus !== ADMIN_TUNNUS || salasana !== ADMIN_SALASANA) return res.status(403).json({ virhe: "Ei oikeuksia" });
    
    db.all("SELECT * FROM viestit ORDER BY aika DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ virhe: err.message });
        res.json(rows);
    });
});

app.post('/appi/kirjaudu', (req, res) => {
    const { tunnus, salasana } = req.body;
    if (tunnus === ADMIN_TUNNUS && salasana === ADMIN_SALASANA) res.json({ success: true });
    else res.status(401).json({ success: false });
});

const muutaTila = (req, res, tila) => {
    const { id, tunnus, salasana } = req.body;
    if (tunnus !== ADMIN_TUNNUS || salasana !== ADMIN_SALASANA) return res.status(403).json({ virhe: "Ei oikeuksia" });

    db.run("UPDATE viestit SET piilotettu = ? WHERE id = ?", [tila, id], function(err) {
        if (err) return res.status(500).json({ virhe: err.message });
        res.json({ success: true });
    });
};
app.post('/appi/piilota-viesti', (req, res) => muutaTila(req, res, 1));
app.post('/appi/palauta-viesti', (req, res) => muutaTila(req, res, 0));

app.get('/api/space-data', (req, res) => {
    const dataPath = path.join(__dirname, 'data', 'taivaankappaleet.json');
    fs.readFile(dataPath, 'utf8', (err, data) => {
        if (err) {
            console.error("Virhe JSON-luvussa:", err);
            res.status(500).json({ virhe: "Tietokantavirhe" });
        } else {
            res.json(JSON.parse(data));
        }
    });
});

// ==========================================
// 6. API-REITIT: NHL (PROXY)
// ==========================================

app.get('/api/nhl/score', async (req, res) => { 
    try {
        const dateParam = req.query.date;
        const url = dateParam 
            ? `https://api-web.nhle.com/v1/score/${dateParam}` 
            : 'https://api-web.nhle.com/v1/score/now';

        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Score virhe:", error);
        res.status(500).json({ error: "Ei voitu hakea tuloksia" });
    }
});

app.get('/api/nhl/game/:id', async (req, res) => {
    try {
        const gameId = req.params.id;
        const url = `https://api-web.nhle.com/v1/gamecenter/${gameId}/landing`;
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });

        if (!response.ok) throw new Error(`NHL API virhe: ${response.status}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Pelitietoja ei löytynyt" });
    }
});

app.get('/api/nhl/player/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const url = `https://api-web.nhle.com/v1/player/${id}/landing`;
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        
        if (!response.ok) throw new Error(`NHL API virhe: ${response.status}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Tietoja ei löytynyt" });
    }
});

app.get('/api/nhl/hot', async (req, res) => {
    try {
        const dateParam = req.query.date;
        const url = dateParam 
            ? `https://api-web.nhle.com/v1/score/${dateParam}` 
            : 'https://api-web.nhle.com/v1/score/now';

        const scoreRes = await fetch(url);
        const scoreData = await scoreRes.json();
        const games = scoreData.games || [];
        
        let allSkaters = [];
        let allGoalies = [];

        for (const game of games) {
            if (game.gameState !== "FUT" && game.gameState !== "PRE") {
                const boxRes = await fetch(`https://api-web.nhle.com/v1/gamecenter/${game.id}/boxscore`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                if (!boxRes.ok) continue;
                const boxData = await boxRes.json();

                const processTeam = (teamStats, abbrev) => {
                    if (!teamStats) return;
                    ['forwards', 'defense'].forEach(group => {
                        if (teamStats[group]) {
                            teamStats[group].forEach(p => {
                                const s = p.stats || {};
                                const g = p.goals ?? s.goals ?? 0;
                                const a = p.assists ?? s.assists ?? 0;
                                const pts = p.points ?? s.points ?? 0;
                                const pm = p.plusMinus ?? s.plusMinus ?? 0;
                                const laukaukset = p.sog ?? p.shots ?? s.sog ?? s.shots ?? 0;
                                const peliaika = p.toi || s.toi || "0:00";
                                
                                if (pts >= 2) {
                                    allSkaters.push({
                                        id: p.playerId,
                                        name: p.name?.default || `${p.firstName?.default} ${p.lastName?.default}`,
                                        team: abbrev,
                                        position: p.position || 'F',
                                        stats: { goals: g, assists: a, points: pts, shots: laukaukset, plusMinus: pm, toi: peliaika }
                                    });
                                }
                            });
                        }
                    });
                    
                    if (teamStats.goalies) {
                        teamStats.goalies.forEach(p => {
                            const s = p.stats || {};
                            const sa = p.shotsAgainst ?? s.shotsAgainst ?? 0;
                            const saves = p.saves ?? s.saves ?? 0;
                            const ga = p.goalsAgainst ?? s.goalsAgainst ?? 0;
                            const svPct = p.savePctg ?? s.savePctg ?? (sa > 0 ? saves/sa : 0);
                            const peliaika = p.toi || s.toi || "0:00";
                            
                            if (svPct >= 0.930 && sa >= 20) {
                                allGoalies.push({
                                    id: p.playerId,
                                    name: p.name?.default || `${p.firstName?.default} ${p.lastName?.default}`,
                                    team: abbrev,
                                    position: 'G',
                                    stats: { savePctg: svPct, saves: saves, shotsAgainst: sa, goalsAgainst: ga, toi: peliaika }
                                });
                            }
                        });
                    }
                };

                if (boxData.playerByGameStats) {
                    processTeam(boxData.playerByGameStats.awayTeam, boxData.awayTeam?.abbrev);
                    processTeam(boxData.playerByGameStats.homeTeam, boxData.homeTeam?.abbrev);
                }
                await new Promise(r => setTimeout(r, 100)); 
            }
        }

        allSkaters.sort((a, b) => b.stats.points - a.stats.points || b.stats.goals - a.stats.goals);
        allGoalies.sort((a, b) => b.stats.savePctg - a.stats.savePctg);

        res.json({
            skaters: allSkaters.slice(0, 5), 
            goalies: allGoalies.slice(0, 3)  
        });

    } catch (error) {
        console.error("Hot players error:", error);
        res.status(500).json({ error: "Virhe tulikuumien haussa" });
    }
});

app.get('/api/nhl/suomalaiset', async (req, res) => {
    try {
        const alue = req.query.alue || 'fi';
        
        const SUOMI_LISTA = [
            // Olemassa olevat tähdet ja vakiopelaajat
            "Aleksander Barkov", "Mikko Rantanen", "Sebastian Aho", "Roope Hintz",
            "Miro Heiskanen", "Mikael Granlund", "Teuvo Teravainen", "Artturi Lehkonen",
            "Anton Lundell", "Matias Maccelli", "Erik Haula", "Eetu Luostarinen",
            "Jesperi Kotkaniemi", "Kaapo Kakko", "Patrik Laine", "Esa Lindell",
            "Niko Mikkola", "Olli Maatta", "Henri Jokiharju", "Rasmus Ristolainen",
            "Juuso Valimaki", "Urho Vaakanainen", "Jani Hakanpaa", "Joel Armia",
            "Kasperi Kapanen", "Oliver Kapanen", "Eeli Tolvanen", "Jesse Puljujarvi", 
            "Juuso Parssinen", "Valtteri Puustinen", "Aatu Raty", "Mikael Pyyhtia", 
            "Jesse Ylonen", "Brad Lambert", "Juuse Saros", "Ukko-Pekka Luukkonen", 
            "Kevin Lankinen", "Justus Annunen", "Joonas Korpisalo", "Ville Husso", "Joel Blomqvist",
            
            // --- UUDET LISÄYKSET (Junnut, Hissipelaajat ja Puuttuvat) ---
            "Kaapo Kahkonen", "Samuel Helenius", "Waltteri Merela", "Mikko Kokkonen",
            "Santeri Hatakka", "Aku Raty", "Roby Jarventie", "Eetu Makiniemi", 
            "Leevi Merilainen", "Joakim Kemell", "Konsta Helenius", "Jani Nyman",
            "Lenni Hameenaho", "Kasper Halttunen", "Emil Hemming", "Topi Niemela", 
            "Aron Kiviharju"
        ];

        const EURO_LISTA = [
            "Nikita Kucherov", "Artemi Panarin", "David Pastrnak", "William Nylander", 
            "Mikko Rantanen", "Leon Draisaitl", "Kirill Kaprizov", "Elias Pettersson", 
            "Roman Josi", "Victor Hedman", "Aleksander Barkov", "Jesper Bratt", 
            "Kevin Fiala", "Tim Stutzle", "Sebastian Aho", "Filip Forsberg", 
            "Mika Zibanejad", "Lucas Raymond", "Pavel Buchnevich", "Andrei Svechnikov", 
            "Roope Hintz", "Martin Necas", "Tomas Hertl", "Nico Hischier", "Juraj Slafkovsky", 
            "Rasmus Dahlin", "Miro Heiskanen", "Igor Shesterkin", "Andrei Vasilevskiy", 
            "Ilya Sorokin", "Sergei Bobrovsky", "Juuse Saros", "Linus Ullmark", "Lukas Dostal"
        ];

        const siistiNimi = (nimi) => {
            if (!nimi) return "";
            return String(nimi).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "").toLowerCase().trim();
        };

        const valittuAitoLista = (alue === 'en') ? EURO_LISTA : SUOMI_LISTA;
        const vertailuLista = valittuAitoLista.map(siistiNimi);

        const etsiAitoNimi = (apiNimi) => {
            for (let i = 0; i < vertailuLista.length; i++) {
                const seurattava = vertailuLista[i];
                if (seurattava === apiNimi) return valittuAitoLista[i];
                const osat = seurattava.split(" ");
                if (osat.length >= 2) {
                    const ekaKirjain = osat[0].charAt(0);
                    const suku = osat.slice(1).join(" ");
                    const lyhenne = `${ekaKirjain} ${suku}`;
                    if (apiNimi === lyhenne) return valittuAitoLista[i];
                }
            }
            return null;
        };

        const dateParam = req.query.date;
        const url = dateParam 
            ? `https://api-web.nhle.com/v1/score/${dateParam}` 
            : 'https://api-web.nhle.com/v1/score/now';

        const scoreRes = await fetch(url);
        const scoreData = await scoreRes.json();
        const games = scoreData.games || [];
        let pStats = [];

        for (const game of games) {
            if (game.gameState !== "FUT" && game.gameState !== "PRE") {
                const boxRes = await fetch(`https://api-web.nhle.com/v1/gamecenter/${game.id}/boxscore`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                if (!boxRes.ok) continue;
                const boxData = await boxRes.json();

                const parsePlayers = (teamStats, teamAbbrev) => {
                    if (!teamStats) return;
                    ['forwards', 'defense', 'goalies'].forEach(group => {
                        if (teamStats[group]) {
                            teamStats[group].forEach(p => {
                                const etu = (typeof p.firstName === 'object' ? p.firstName?.default : p.firstName) || '';
                                const suku = (typeof p.lastName === 'object' ? p.lastName?.default : p.lastName) || '';
                                const valmisNimi = (typeof p.name === 'object' ? p.name?.default : p.name) || '';
                                const kokoNimi = valmisNimi ? valmisNimi : `${etu} ${suku}`.trim();
                                const puhdasNimi = siistiNimi(kokoNimi);
                                
                                const aitoKokoNimi = etsiAitoNimi(puhdasNimi);
                                if (aitoKokoNimi) {
                                    const s = p.stats || {};
                                    pStats.push({
                                        name: aitoKokoNimi,
                                        team: teamAbbrev,
                                        position: p.position || 'F',
                                        id: p.playerId,
                                        stats: {
                                            goals: p.goals ?? s.goals ?? 0,
                                            assists: p.assists ?? s.assists ?? 0,
                                            points: p.points ?? s.points ?? 0,
                                            plusMinus: p.plusMinus ?? s.plusMinus ?? 0,
                                            toi: p.toi || s.toi || "0:00",
                                            saves: p.saves ?? s.saves ?? 0,
                                            shotsAgainst: p.shotsAgainst ?? s.shotsAgainst ?? 0
                                        },
                                        headshot: `https://assets.nhle.com/mugs/nhl/latest/backgroundless/256/${p.playerId || 8478427}.png`
                                    });
                                }
                            });
                        }
                    });
                };

                if (boxData.playerByGameStats) {
                    parsePlayers(boxData.playerByGameStats.awayTeam, boxData.awayTeam?.abbrev || "AWAY");
                    parsePlayers(boxData.playerByGameStats.homeTeam, boxData.homeTeam?.abbrev || "HOME");
                }
                await new Promise(r => setTimeout(r, 50)); 
            } 
            else {
                const fetchRoster = async (teamAbbrev) => {
                    try {
                        const res = await fetch(`https://api-web.nhle.com/v1/roster/${teamAbbrev}/current`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                        if (!res.ok) return;
                        const rosterData = await res.json();
                        
                        ['forwards', 'defensemen', 'goalies'].forEach(group => {
                            if (rosterData[group]) {
                                rosterData[group].forEach(p => {
                                    const etu = p.firstName?.default || '';
                                    const suku = p.lastName?.default || '';
                                    const puhdasNimi = siistiNimi(`${etu} ${suku}`);
                                    const aitoKokoNimi = etsiAitoNimi(puhdasNimi);
                                    
                                    if (aitoKokoNimi) {
                                        pStats.push({
                                            name: aitoKokoNimi,
                                            team: teamAbbrev,
                                            position: p.positionCode || 'F',
                                            id: p.id,
                                            stats: { goals: 0, assists: 0, points: 0, plusMinus: 0, toi: "0:00", saves: 0, shotsAgainst: 0 },
                                            headshot: p.headshot || `https://assets.nhle.com/mugs/nhl/latest/backgroundless/256/${p.id}.png`
                                        });
                                    }
                                });
                            }
                        });
                    } catch (e) {
                        console.error("Roster fetch failed for", teamAbbrev);
                    }
                };
                
                await Promise.all([
                    fetchRoster(game.awayTeam.abbrev),
                    fetchRoster(game.homeTeam.abbrev)
                ]);
            }
        }

        res.json(pStats);
    } catch (error) {
        console.error("Virhe:", error);
        res.status(500).json({ error: "Virhe haussa" });
    }
});

app.get('/api/nhl/boxscore/:id', async (req, res) => {
    try {
        const gameId = req.params.id;
        const response = await fetch(`https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!response.ok) throw new Error("API-virhe");
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Kokoonpanoja ei löytynyt" });
    }
});

app.get('/api/nhl/tekstitv', async (req, res) => {
    try {
        const alue = req.query.alue || 'fi';
        const season = "20252026";
        
        let natExp = 'nationalityCode="FIN"';
        if (alue === 'en') {
            natExp = "nationalityCode%20in%20('FIN','SWE','RUS','CZE','SUI','SVK','GER','DEN','LVA','AUT','FRA','NOR','SLO','BLR')";
        }
        
        const skaterUrl = `https://api.nhle.com/stats/rest/en/skater/summary?limit=100&sort=[{"property":"points","direction":"DESC"}]&cayenneExp=seasonId=${season}%20and%20gameTypeId=2%20and%20${natExp}`;
        const skaterRes = await fetch(skaterUrl);
        const skaterJson = await skaterRes.json();

        const goalieUrl = `https://api.nhle.com/stats/rest/en/goalie/summary?limit=10&sort=[{"property":"savePct","direction":"DESC"}]&cayenneExp=seasonId=${season}%20and%20gameTypeId=2%20and%20${natExp}%20and%20gamesPlayed>=5`;
        const goalieRes = await fetch(goalieUrl);
        const goalieJson = await goalieRes.json();

        const pisteelliset = (skaterJson.data || []).filter(p => p.points > 0);

        res.json({ skaters: pisteelliset, goalies: goalieJson.data || [] });
    } catch (error) {
        console.error("Teksti-TV virhe:", error);
        res.status(500).json({ error: "Ei voitu hakea Teksti-TV dataa" });
    }
});

app.get('/api/nhl/tekstitv-kaikki', async (req, res) => {
    try {
        const season = "20252026";
        
        const skaterUrl = `https://api.nhle.com/stats/rest/en/skater/summary?limit=100&sort=[{"property":"points","direction":"DESC"}]&cayenneExp=seasonId=${season}%20and%20gameTypeId=2`;
        const skaterRes = await fetch(skaterUrl);
        const skaterJson = await skaterRes.json();

        if (skaterJson.data && skaterJson.data.length > 0) {
            const pIds = skaterJson.data.map(p => p.playerId).join(',');
            const query = encodeURIComponent(`seasonId=${season} and playerId in (${pIds})`);
            const biosUrl = `https://api.nhle.com/stats/rest/en/skater/bios?limit=-1&cayenneExp=${query}`;
            
            const biosRes = await fetch(biosUrl);
            const biosJson = await biosRes.json();
            
            skaterJson.data.forEach(p => {
                const bio = (biosJson.data || []).find(b => b.playerId === p.playerId);
                p.nationalityCode = bio ? bio.nationalityCode : 'N/A';
            });
        }

        const goalieUrl = `https://api.nhle.com/stats/rest/en/goalie/summary?limit=50&sort=[{"property":"savePct","direction":"DESC"}]&cayenneExp=seasonId=${season}%20and%20gameTypeId=2%20and%20gamesPlayed>=5`;
        const goalieRes = await fetch(goalieUrl);
        const goalieJson = await goalieRes.json();

        if (goalieJson.data && goalieJson.data.length > 0) {
            const gIds = goalieJson.data.map(g => g.playerId).join(',');
            const gQuery = encodeURIComponent(`seasonId=${season} and playerId in (${gIds})`);
            const gBiosUrl = `https://api.nhle.com/stats/rest/en/goalie/bios?limit=-1&cayenneExp=${gQuery}`;
            
            const gBiosRes = await fetch(gBiosUrl);
            const gBiosJson = await gBiosRes.json();
            
            goalieJson.data.forEach(g => {
                const bio = (gBiosJson.data || []).find(b => b.playerId === g.playerId);
                g.nationalityCode = bio ? bio.nationalityCode : 'N/A';
            });
        }

        res.json({ skaters: skaterJson.data || [], goalies: goalieJson.data || [] });
    } catch (error) {
        console.error("Koko NHL Teksti-TV virhe:", error);
        res.status(500).json({ error: "Ei voitu hakea Teksti-TV dataa" });
    }
});

app.get('/api/nhl/schedule', async (req, res) => {
    try {
        const startDate = req.query.startDate || new Date().toLocaleDateString('en-CA');
        const endDate = req.query.endDate || null;
        const daysToFetch = parseInt(req.query.days) || 7;
        
        let url = `https://api-web.nhle.com/v1/schedule/${startDate}`;
        let allDates = [];
        let gamesData = [];
        let keepFetching = true;

        while (keepFetching) {
            const response = await fetch(url);
            const data = await response.json();

            for (const day of data.gameWeek) {
                if (endDate && day.date > endDate) {
                    keepFetching = false;
                    break;
                }
                if (!endDate && allDates.length >= daysToFetch) {
                    keepFetching = false;
                    break;
                }

                if (day.date >= startDate && !allDates.includes(day.date)) {
                    allDates.push(day.date);
                    gamesData.push(day);
                }
            }

            if (keepFetching && data.nextStartDate) {
                url = `https://api-web.nhle.com/v1/schedule/${data.nextStartDate}`;
            } else {
                break;
            }
        }

        const teams = {};

        gamesData.forEach(day => {
            const date = day.date;
            day.games.forEach(game => {
                const away = game.awayTeam.abbrev;
                const home = game.homeTeam.abbrev;

                if (!teams[away]) {
                    teams[away] = { abbrev: away, gamesCount: 0, homeGames: 0, awayGames: 0, schedule: {} };
                    allDates.forEach(d => teams[away].schedule[d] = null);
                }
                if (!teams[home]) {
                    teams[home] = { abbrev: home, gamesCount: 0, homeGames: 0, awayGames: 0, schedule: {} };
                    allDates.forEach(d => teams[home].schedule[d] = null);
                }

                teams[away].gamesCount++;
                teams[away].awayGames++;
                teams[away].schedule[date] = { opponent: home, isHome: false };

                teams[home].gamesCount++;
                teams[home].homeGames++;
                teams[home].schedule[date] = { opponent: away, isHome: true };
            });
        });

        const sortedTeams = Object.values(teams).sort((a, b) => b.gamesCount - a.gamesCount);
        res.json({ dates: allDates, teams: sortedTeams });

    } catch (error) {
        console.error("Schedule virhe:", error);
        res.status(500).json({ error: "Ei voitu hakea otteluohjelmaa" });
    }
});

app.get('/api/nhl/standings', async (req, res) => {
    try {
        const response = await fetch('https://api-web.nhle.com/v1/standings/now');
        const data = await response.json();
        
        const sorted = data.standings.sort((a, b) => b.points - a.points || b.pointPctg - a.pointPctg);

        const eastern = sorted.filter(t => t.conferenceName === 'Eastern');
        const western = sorted.filter(t => t.conferenceName === 'Western');

        res.json({ eastern, western });
    } catch (error) {
        console.error("Standings virhe:", error);
        res.status(500).json({ error: "Ei voitu hakea sarjataulukkoa" });
    }
});

app.get('/api/nhl/leaders/:type', async (req, res) => {
    try {
        const type = req.params.type; 
        const season = "20252026";
        
        const url = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=false&sort=[{"property":"${type}","direction":"DESC"},{"property":"points","direction":"DESC"}]&start=0&limit=50&factCayenneExp=gamesPlayed>=1&cayenneExp=gameTypeId=2%20and%20seasonId<=${season}%20and%20seasonId>=${season}`;
        
        const response = await fetch(url);
        const json = await response.json();
        let data = json.data || [];

        if (data.length > 0) {
            const pIds = data.map(p => p.playerId).join(',');
            const query = encodeURIComponent(`seasonId=${season} and playerId in (${pIds})`);
            const biosUrl = `https://api.nhle.com/stats/rest/en/skater/bios?limit=-1&cayenneExp=${query}`;
            
            const biosRes = await fetch(biosUrl);
            const biosJson = await biosRes.json();
            
            data.forEach(p => {
                const bio = (biosJson.data || []).find(b => b.playerId === p.playerId);
                p.nationalityCode = bio ? bio.nationalityCode : 'N/A';
            });
        }
        
        res.json(data);
    } catch (error) {
        console.error("Leaders virhe:", error);
        res.status(500).json({ error: "Ei voitu hakea tilastoja" });
    }
});

app.get('/api/nhl/team/:abbrev', async (req, res) => {
    try {
        const abbrev = req.params.abbrev;
        const url = `https://api-web.nhle.com/v1/club-schedule-season/${abbrev}/20252026`;
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        
        if (!response.ok) throw new Error("API-virhe");
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Joukkue-virhe:", error);
        res.status(500).json({ error: "Joukkueen tietoja ei löytynyt" });
    }
});

app.get('/api/nhl/team-schedule/:abbrev', async (req, res) => {
    try {
        const abbrev = req.params.abbrev;
        const response = await fetch(`https://api-web.nhle.com/v1/club-schedule-season/${abbrev}/now`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (!response.ok) throw new Error("Verkkovirhe");
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error(`Virhe haettaessa ohjelmaa joukkueelle ${req.params.abbrev}:`, error);
        res.status(500).json({ error: "Ei voitu hakea joukkueen ohjelmaa" });
    }
});

app.get('/api/nhl/playbyplay/:id', async (req, res) => {
    try {
        const response = await fetch(`https://api-web.nhle.com/v1/gamecenter/${req.params.id}/play-by-play`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.json({ plays: [] });
    }
});

app.get('/api/nhl/calendar/:date', async (req, res) => {
    try {
        const response = await fetch(`https://api-web.nhle.com/v1/schedule/${req.params.date}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Kalenterin haku epäonnistui:", error);
        res.status(500).json({ error: "Ei voitu hakea kalenteria" });
    }
});

app.get('/api/nhl/roster/:abbrev', async (req, res) => {
    try {
        const response = await fetch(`https://api-web.nhle.com/v1/roster/${req.params.abbrev}/current`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Rosterin haku epäonnistui:", error);
        res.status(500).json({ error: "Ei voitu hakea kokoonpanoa" });
    }
});

const NHL_TEAMS = [
    { name: "Anaheim Ducks", abbrev: "ANA" }, { name: "Boston Bruins", abbrev: "BOS" }, 
    { name: "Buffalo Sabres", abbrev: "BUF" }, { name: "Calgary Flames", abbrev: "CGY" },
    { name: "Carolina Hurricanes", abbrev: "CAR" }, { name: "Chicago Blackhawks", abbrev: "CHI" },
    { name: "Colorado Avalanche", abbrev: "COL" }, { name: "Columbus Blue Jackets", abbrev: "CBJ" },
    { name: "Dallas Stars", abbrev: "DAL" }, { name: "Detroit Red Wings", abbrev: "DET" },
    { name: "Edmonton Oilers", abbrev: "EDM" }, { name: "Florida Panthers", abbrev: "FLA" },
    { name: "Los Angeles Kings", abbrev: "LAK" }, { name: "Minnesota Wild", abbrev: "MIN" },
    { name: "Montréal Canadiens", abbrev: "MTL" }, { name: "Nashville Predators", abbrev: "NSH" },
    { name: "New Jersey Devils", abbrev: "NJD" }, { name: "New York Islanders", abbrev: "NYI" },
    { name: "New York Rangers", abbrev: "NYR" }, { name: "Ottawa Senators", abbrev: "OTT" },
    { name: "Philadelphia Flyers", abbrev: "PHI" }, { name: "Pittsburgh Penguins", abbrev: "PIT" },
    { name: "San Jose Sharks", abbrev: "SJS" }, { name: "Seattle Kraken", abbrev: "SEA" },
    { name: "St. Louis Blues", abbrev: "STL" }, { name: "Tampa Bay Lightning", abbrev: "TBL" },
    { name: "Toronto Maple Leafs", abbrev: "TOR" }, { name: "Utah Hockey Club", abbrev: "UTA" },
    { name: "Vancouver Canucks", abbrev: "VAN" }, { name: "Vegas Golden Knights", abbrev: "VGK" },
    { name: "Washington Capitals", abbrev: "WSH" }, { name: "Winnipeg Jets", abbrev: "WPG" }
];

app.get('/api/nhl/search', async (req, res) => {
    try {
        const query = (req.query.q || '').toLowerCase();
        if (query.length < 2) return res.json([]);

        const teamResults = NHL_TEAMS
            .filter(t => t.name.toLowerCase().includes(query) || t.abbrev.toLowerCase().includes(query))
            .map(t => ({ type: 'JOUKKUE', name: t.name, abbrev: t.abbrev }));

        const response = await fetch(`https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=15&q=${encodeURIComponent(query)}`);
        const playerData = await response.json();
        
        const playerResults = (playerData || []).map(p => ({
            type: 'PELAAJA',
            name: p.name,
            id: p.playerId,
            abbrev: p.teamAbbrev,
            position: p.positionCode
        }));

        res.json([...teamResults, ...playerResults]);
    } catch (error) {
        console.error("Hakuvirhe:", error);
        res.status(500).json({ error: "Haku epäonnistui" });
    }
});


// =================================================================
// 🤖 AI & D4NY KRISTALLIPALLO (TIETOKANTA-REITIT)
// =================================================================

app.get('/api/nhl/predictions/dates', (req, res) => {
    db.all("SELECT date FROM ai_predictions ORDER BY date DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => r.date));
    });
});

app.get('/api/nhl/predictions', (req, res) => {
    const queryDate = req.query.date;
    
    if (queryDate) {
        db.get("SELECT * FROM ai_predictions WHERE date = ?", [queryDate], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (row) {
                res.json({
                    date: row.date,
                    players: JSON.parse(row.players_json || "[]"),
                    teams: JSON.parse(row.teams_json || "[]"),
                    matches: JSON.parse(row.matches_json || "[]") 
                });
            } else {
                res.json({ players: [], teams: [], matches: [], error: "Ei dataa" });
            }
        });
    } else {
        res.json({ 
            players: aiPredictionsCache, 
            teams: aiTeamCache,
            matches: matchPredictionsCache
        });
    }
});


// =================================================================
// 🤖 AI & D4NY KRISTALLIPALLO LASKENTAMALLIT
// =================================================================

let aiPredictionsCache = [];
let aiTeamCache = [];
let matchPredictionsCache = [];

function getAge(birthDateString) {
    if (!birthDateString) return 27; 
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
}

// Apufunktio Poisson-jakaumalle (Maaliarvonta Monte Carloon)
function simulatePoisson(lambda) {
    let L = Math.exp(-lambda);
    let p = 1.0;
    let k = 0;
    do {
        k++;
        p *= Math.random();
    } while (p > L);
    return k - 1;
}

async function generateAIPredictions() {
    try {
        console.log("🤖 AI aloittaa Level 4 pelaajasimuloinnin (Ikä, TOI-trendi, YV-tehokkuus)...");
        
        const season = "20252026"; 

        const standingsRes = await fetch('https://api-web.nhle.com/v1/standings/now', { headers: { 'User-Agent': 'Mozilla/5.0' }});
        const standingsData = await standingsRes.json();
        const teamGamesPlayed = {};
        standingsData.standings.forEach(t => teamGamesPlayed[t.teamAbbrev.default] = t.gamesPlayed);

        let recentStats = {};
        try {
            const today = new Date();
            const pastDate = new Date();
            pastDate.setDate(today.getDate() - 21);
            const dateStr = pastDate.toISOString().split('T')[0];
            
            const factQuery = encodeURIComponent(`gamesPlayed>=1`);
            const cayenneQuery = encodeURIComponent(`gameDate>="${dateStr}" and gameTypeId=2`);
            
            const recentUrl = `https://api.nhle.com/stats/rest/en/skater/summary?limit=-1&factCayenneExp=${factQuery}&cayenneExp=${cayenneQuery}`;
            const recentRes = await fetch(recentUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            
            if (recentRes.ok) {
                const recentData = await recentRes.json();
                if (recentData && recentData.data) {
                    recentData.data.forEach(p => {
                        recentStats[p.playerId] = { gp: p.gamesPlayed, g: p.goals, a: p.assists, shots: p.shots, toi: p.timeOnIcePerGame };
                    });
                }
            } else {
                console.log(`⚠️ Kuntopuntaria ei saatu, rajapinta vastasi: ${recentRes.status}`);
            }
        } catch (e) { console.log("Kuntopuntari-haussa ohitettiin virhe:", e.message); }

        const summaryQuery = encodeURIComponent(`seasonId=${season} and gameTypeId=2`);
        const biosQuery = encodeURIComponent(`seasonId=${season}`);

        const summaryUrl = `https://api.nhle.com/stats/rest/en/skater/summary?limit=-1&cayenneExp=${summaryQuery}`;
        const biosUrl = `https://api.nhle.com/stats/rest/en/skater/bios?limit=-1&cayenneExp=${biosQuery}`;

        const [summaryRes, biosRes] = await Promise.all([
            fetch(summaryUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
            fetch(biosUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        ]);

        if (!summaryRes.ok) throw new Error(`Summary API kaatui! Status: ${summaryRes.status}`);
        if (!biosRes.ok) throw new Error(`Bios API kaatui! Status: ${biosRes.status}`);

        const summaryData = await summaryRes.json();
        const biosData = await biosRes.json();

        const biosMap = {};
        if (biosData && biosData.data) {
            biosData.data.forEach(b => biosMap[b.playerId] = { birthDate: b.birthDate });
        }

        let allPlayers = (summaryData.data || []).filter(p => p.gamesPlayed >= 10);

        const processed = allPlayers.map(p => {
            const teamAbbrev = p.teamAbbrevs ? p.teamAbbrevs.split(',').pop().trim() : "UNK"; 
            const teamGP = teamGamesPlayed[teamAbbrev] || p.gamesPlayed;
            let gamesLeft = 82 - teamGP; 
            if (gamesLeft <= 0) gamesLeft = 0;

            const seasonAssistsPerGame = p.assists / p.gamesPlayed;
            const seasonShotsPerGame = p.shots / p.gamesPlayed;
            
            let weightedAssistsPerGame = seasonAssistsPerGame;
            let weightedShotsPerGame = seasonShotsPerGame;
            let trendMultiplier = 1.0; 

            const age = biosMap[p.playerId] ? getAge(biosMap[p.playerId].birthDate) : 27;
            if (age <= 23) trendMultiplier *= 1.03; 
            else if (age >= 32) trendMultiplier *= 0.96; 

            const ppPointsPerGame = p.ppPoints / p.gamesPlayed;
            if (ppPointsPerGame > 0.3) {
                trendMultiplier *= 1.02; 
            }

            const recent = recentStats[p.playerId];
            if (recent && recent.gp >= 3) {
                const recentAssistsPerGame = recent.a / recent.gp;
                const recentShotsPerGame = recent.shots / recent.gp;
                
                weightedAssistsPerGame = (seasonAssistsPerGame * 0.7) + (recentAssistsPerGame * 0.3);
                weightedShotsPerGame = (seasonShotsPerGame * 0.7) + (recentShotsPerGame * 0.3);

                const toiDelta = recent.toi - p.timeOnIcePerGame; 
                if (toiDelta > 60) trendMultiplier *= 1.04; 
                else if (toiDelta < -60) trendMultiplier *= 0.96; 
            }

            const expectedAssistsLeft = (weightedAssistsPerGame * trendMultiplier) * gamesLeft;
            const expectedShotsLeft = (weightedShotsPerGame * trendMultiplier) * gamesLeft;

            const leagueAvgShPct = 0.11; 
            let currentShPct = p.shootingPctg ? (p.shootingPctg / 100) : leagueAvgShPct; 
            const normalizedShPct = (currentShPct * 0.6) + (leagueAvgShPct * 0.4); 
            const expectedGoalsLeft = expectedShotsLeft * normalizedShPct;

            const expectedTotalGoals = Math.round(p.goals + expectedGoalsLeft);
            const expectedTotalAssists = Math.round(p.assists + expectedAssistsLeft);
            const expectedTotalPoints = expectedTotalGoals + expectedTotalAssists;

            return {
                id: p.playerId,
                name: p.skaterFullName,
                team: teamAbbrev,
                currentStats: { gp: p.gamesPlayed, g: p.goals, a: p.assists, p: p.points, shPct: (currentShPct * 100).toFixed(1) },
                predictedStats: { g: expectedTotalGoals, a: expectedTotalAssists, p: expectedTotalPoints }
            };
        });

        processed.sort((a, b) => b.predictedStats.p - a.predictedStats.p);
        aiPredictionsCache = processed.slice(0, 100);
        console.log("✅ Pelaajaennusteet valmiit! Level 4 algoritmi (TOI, Ikä, YV) suoritettu.");

    } catch (err) {
        console.error("❌ Kriittinen virhe AI pelaajaennusteissa:", err.message);
    }
}

async function generateTeamPredictions() {
    try {
        console.log("🤖 AI aloittaa Level 4 joukkuesimuloinnin (Pythagoras, L10, Fatigue-matriisi)...");
        
        const res = await fetch('https://api-web.nhle.com/v1/standings/now', { headers: { 'User-Agent': 'Mozilla/5.0' }});
        const data = await res.json();
        const standings = data.standings;

        const teamStrength = {};
        
        standings.forEach(t => {
            const exponent = 2.0; 
            const gf = t.goalFor || 0;
            const ga = t.goalAgainst || 0;
            
            let pythagoreanPct = Math.pow(gf, exponent) / (Math.pow(gf, exponent) + Math.pow(ga, exponent));
            if (isNaN(pythagoreanPct)) pythagoreanPct = 0.5;

            const l10PtsPct = ((t.l10Wins || 0) * 2 + (t.l10OtLosses || 0)) / 20;
            const trueTalent = (pythagoreanPct * 0.50) + (t.pointPctg * 0.30) + (l10PtsPct * 0.20);
            
            teamStrength[t.teamAbbrev.default] = trueTalent;
        });

        const projectedTeams = [];

        for (const t of standings) {
            const abbrev = t.teamAbbrev.default;
            const currentPoints = t.points;
            let projectedFuturePoints = 0;
            
            try {
                const schedRes = await fetch(`https://api-web.nhle.com/v1/club-schedule-season/${abbrev}/now`, { headers: { 'User-Agent': 'Mozilla/5.0' }});
                if (!schedRes.ok) throw new Error("Ei ohjelmaa");
                const schedData = await schedRes.json();
                
                let previousGameDate = null;

                schedData.games.forEach(game => {
                    if (game.gameState === "FUT" || game.gameState === "PRE") {
                        const isHome = game.homeTeam.abbrev === abbrev;
                        const opponent = isHome ? game.awayTeam.abbrev : game.homeTeam.abbrev;
                        const oppStrength = teamStrength[opponent] || 0.5;
                        const myStrength = teamStrength[abbrev];

                        let gameMultiplier = 1.0;

                        if (isHome) gameMultiplier *= 1.06; 
                        else gameMultiplier *= 0.94;

                        gameMultiplier *= (1 + (0.500 - oppStrength));

                        const gameDate = new Date(game.startTimeUTC);
                        if (previousGameDate) {
                            const hoursDiff = (gameDate - previousGameDate) / (1000 * 60 * 60);
                            const daysOff = Math.floor(hoursDiff / 24);
                            
                            if (daysOff < 1) {
                                gameMultiplier *= 0.88; 
                            } else if (daysOff >= 3) {
                                gameMultiplier *= 1.03; 
                            }
                        }
                        previousGameDate = gameDate;

                        let expectedGamePoints = (2 * myStrength) * gameMultiplier;
                        if (expectedGamePoints > 2) expectedGamePoints = 2; 

                        projectedFuturePoints += expectedGamePoints;
                    }
                });

                projectedTeams.push({
                    teamName: t.teamName.default,
                    teamAbbrev: abbrev,
                    conference: t.conferenceName,
                    division: t.divisionName,
                    currentPoints,
                    projectedPoints: Math.round(currentPoints + projectedFuturePoints),
                    ptsPct: (t.pointPctg * 100).toFixed(1)
                });

            } catch (e) {
                const gamesRemaining = 82 - t.gamesPlayed;
                projectedTeams.push({
                    teamName: t.teamName.default,
                    teamAbbrev: abbrev,
                    conference: t.conferenceName,
                    division: t.divisionName,
                    currentPoints,
                    projectedPoints: Math.round(currentPoints + (gamesRemaining * 2 * t.pointPctg)),
                    ptsPct: (t.pointPctg * 100).toFixed(1)
                });
            }
            await new Promise(r => setTimeout(r, 1000));
        }

        aiTeamCache = projectedTeams.sort((a, b) => b.projectedPoints - a.projectedPoints);
        console.log("✅ Joukkue-ennusteet valmiit! (Pythagoras-malli korjattu)");
    } catch (err) {
        console.error("Virhe joukkue-ennusteissa:", err);
    }
}

async function generateMatchPredictions() {
    try {
        console.log("🎯 AI aloittaa 10 000 iteraation Monte Carlo -simulaatiot (Translation Keys)...");
        
        const dateObj = new Date();
        const dateStr = dateObj.toLocaleDateString('en-CA'); 
        
        const yesterdayObj = new Date();
        yesterdayObj.setDate(yesterdayObj.getDate() - 1);
        const yesterdayStr = yesterdayObj.toLocaleDateString('en-CA');

        const [schedRes, yestRes] = await Promise.all([
            fetch(`https://api-web.nhle.com/v1/schedule/${dateStr}`),
            fetch(`https://api-web.nhle.com/v1/schedule/${yesterdayStr}`)
        ]);
        const schedData = await schedRes.json();
        const yestData = await yestRes.json();
        
        const games = schedData.gameWeek[0]?.games || [];
        if (games.length === 0) return;

        const b2bTeams = new Set();
        const yestGames = yestData.gameWeek[0]?.games || [];
        yestGames.forEach(g => {
            b2bTeams.add(g.homeTeam.abbrev);
            b2bTeams.add(g.awayTeam.abbrev);
        });

        const season = "20252026";
        const goaliesQuery = encodeURIComponent(`seasonId=${season} and gameTypeId=2`);
        const goaliesRes = await fetch(`https://api.nhle.com/stats/rest/en/goalie/summary?limit=-1&cayenneExp=${goaliesQuery}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const goaliesData = await goaliesRes.json();

        const teamGoalies = {};
        if (goaliesData && goaliesData.data) {
            goaliesData.data.forEach(g => {
                const abbrev = g.teamAbbrevs ? g.teamAbbrevs.split(',').pop().trim() : null;
                if (abbrev) {
                    if (!teamGoalies[abbrev]) teamGoalies[abbrev] = [];
                    teamGoalies[abbrev].push(g);
                }
            });
            for (const team in teamGoalies) {
                teamGoalies[team].sort((a, b) => b.timeOnIce - a.timeOnIce);
            }
        }

        const standRes = await fetch('https://api-web.nhle.com/v1/standings/now', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const standData = await standRes.json();
        const standings = standData.standings;

        const schedPromises = standings.map(t => fetch(`https://api-web.nhle.com/v1/club-schedule-season/${t.teamAbbrev.default}/${season}`).then(r => r.json()).catch(()=>null));
        const allScheds = await Promise.all(schedPromises);
        const schedMap = {};
        standings.forEach((t, i) => { if(allScheds[i]) schedMap[t.teamAbbrev.default] = allScheds[i]; });

        const getTeamStats = (abbrev) => standings.find(t => t.teamAbbrev.default === abbrev) || {};
        const LEAGUE_AVG_GOALS = 3.15; 
        const LEAGUE_AVG_SV = 0.903; 

        const predictions = games.map(game => {
            const home = game.homeTeam.abbrev;
            const away = game.awayTeam.abbrev;
            const hStats = getTeamStats(home);
            const aStats = getTeamStats(away);

            if (!hStats.gamesPlayed || !aStats.gamesPlayed) return null;

            let homeReasons = [];
            let awayReasons = [];

            // --- STEP 1: BASE MODEL (xG) ---
            const hGFPG = (hStats.goalFor || 0) / hStats.gamesPlayed;
            const hGAPG = (hStats.goalAgainst || 0) / hStats.gamesPlayed;
            const aGFPG = (aStats.goalFor || 0) / aStats.gamesPlayed;
            const aGAPG = (aStats.goalAgainst || 0) / aStats.gamesPlayed;

            const hAttackStrength = hGFPG / LEAGUE_AVG_GOALS;
            const hDefenseStrength = hGAPG / LEAGUE_AVG_GOALS;
            const aAttackStrength = aGFPG / LEAGUE_AVG_GOALS;
            const aDefenseStrength = aGAPG / LEAGUE_AVG_GOALS;

            let homeXG = LEAGUE_AVG_GOALS * hAttackStrength * aDefenseStrength;
            let awayXG = LEAGUE_AVG_GOALS * aAttackStrength * hDefenseStrength;

            // --- STEP 2: ADJUSTMENTS ---
            let hMult = 1.0;
            let aMult = 1.0;

            // A) KOTIETU
            const hHomeGP = (hStats.homeWins||0) + (hStats.homeLosses||0) + (hStats.homeOtLosses||0);
            const hHomePtPct = hHomeGP > 0 ? (((hStats.homeWins||0)*2) + (hStats.homeOtLosses||0)) / (hHomeGP*2) : 0.5;
            const aRoadGP = (aStats.roadWins||0) + (aStats.roadLosses||0) + (aStats.roadOtLosses||0);
            const aRoadPtPct = aRoadGP > 0 ? (((aStats.roadWins||0)*2) + (aStats.roadOtLosses||0)) / (aRoadGP*2) : 0.5;

            if (hHomePtPct > 0.60) { hMult *= 1.06; homeReasons.push({ key: "reasonStrongHome", type: "plus" }); }
            else if (hHomePtPct > 0.50) { hMult *= 1.02; } // Perus kotietu, ei tekstiä
            else if (hHomePtPct < 0.45) { hMult *= 0.96; homeReasons.push({ key: "reasonWeakHome", type: "minus" }); }

            if (aRoadPtPct > 0.60) { aMult *= 1.04; awayReasons.push({ key: "reasonStrongRoad", type: "plus" }); }
            else if (aRoadPtPct < 0.45) { aMult *= 0.96; awayReasons.push({ key: "reasonWeakRoad", type: "minus" }); }

            // B) B2B
            const homeB2B = b2bTeams.has(home);
            const awayB2B = b2bTeams.has(away);

            if (homeB2B && !awayB2B) {
                hMult *= 0.96; homeReasons.push({ key: "reasonB2BFatigue", type: "minus" });
                awayReasons.push({ key: "reasonRestAdvantage", type: "plus" });
            } else if (awayB2B && !homeB2B) {
                aMult *= 0.96; awayReasons.push({ key: "reasonB2BFatigue", type: "minus" });
                homeReasons.push({ key: "reasonRestAdvantage", type: "plus" });
            }

            // C) L10 KUNTO & PUTKET
            const hL10Pts = ((hStats.l10Wins || 0) * 2) + (hStats.l10OtLosses || 0);
            const aL10Pts = ((aStats.l10Wins || 0) * 2) + (aStats.l10OtLosses || 0);
            const l10Diff = (hL10Pts - aL10Pts) / 20; 
            hMult *= (1 + (l10Diff * 0.15));
            aMult *= (1 - (l10Diff * 0.15));

            if (l10Diff > 0.1) { homeReasons.push({ key: "reasonFormAdvantage", type: "plus" }); awayReasons.push({ key: "reasonWeakForm", type: "minus" }); } 
            else if (l10Diff < -0.1) { awayReasons.push({ key: "reasonFormAdvantage", type: "plus" }); homeReasons.push({ key: "reasonWeakForm", type: "minus" }); }

            const hStreak = hStats.streakCode || ''; const hStreakCount = hStats.streakCount || 0;
            const aStreak = aStats.streakCode || ''; const aStreakCount = aStats.streakCount || 0;
            if (hStreak === 'W' && hStreakCount >= 3) { hMult *= 1.03; homeReasons.push({ key: "reasonWinStreak", val: hStreakCount, type: "plus" }); } 
            else if (hStreak === 'L' && hStreakCount >= 3) { hMult *= 0.97; homeReasons.push({ key: "reasonLoseStreak", val: hStreakCount, type: "minus" }); }
            if (aStreak === 'W' && aStreakCount >= 3) { aMult *= 1.03; awayReasons.push({ key: "reasonWinStreak", val: aStreakCount, type: "plus" }); } 
            else if (aStreak === 'L' && aStreakCount >= 3) { aMult *= 0.97; awayReasons.push({ key: "reasonLoseStreak", val: aStreakCount, type: "minus" }); }

            // D) ERIKOISTILANTEET
            const hPP = hStats.powerPlayPctg || 20; const aPK = aStats.penaltyKillPctg || 80;
            const aPP = aStats.powerPlayPctg || 20; const hPK = hStats.penaltyKillPctg || 80;
            if (hPP > aPK - 55) { hMult *= 1.04; homeReasons.push({ key: "reasonPPvsPK", type: "plus" }); awayReasons.push({ key: "reasonPKIssues", type: "minus" }); } 
            else if (aPP > hPK - 55) { aMult *= 1.04; awayReasons.push({ key: "reasonPPvsPK", type: "plus" }); homeReasons.push({ key: "reasonPKIssues", type: "minus" }); }

            // E) H2H
            let hH2H = 0; let aH2H = 0;
            (schedMap[home]?.games || []).forEach(g => {
                if ((g.gameState === "FINAL" || g.gameState === "OFF") && g.gameType === 2) {
                    const isHomeGame = g.homeTeam.abbrev === home;
                    if ((isHomeGame ? g.awayTeam.abbrev : g.homeTeam.abbrev) === away) {
                        const myScore = isHomeGame ? g.homeTeam.score : g.awayTeam.score;
                        const oppScore = isHomeGame ? g.awayTeam.score : g.homeTeam.score;
                        if (myScore > oppScore) hH2H++; else if (oppScore > myScore) aH2H++;
                    }
                }
            });
            if (hH2H > aH2H) { hMult *= 1.03; homeReasons.push({ key: "reasonH2H", val: `${hH2H}-${aH2H}`, type: "plus" }); }
            else if (aH2H > hH2H) { aMult *= 1.03; awayReasons.push({ key: "reasonH2H", val: `${aH2H}-${hH2H}`, type: "plus" }); }

            hMult = Math.min(Math.max(hMult, 0.80), 1.20);
            aMult = Math.min(Math.max(aMult, 0.80), 1.20);
            homeXG *= hMult;
            awayXG *= aMult;

            // --- STEP 3: WEIGHTED GOALIE IMPACT ---
            const getGoalieAdj = (teamGoalieList, isB2B) => {
                if (!teamGoalieList || teamGoalieList.length === 0) return 0;
                const totalToi = teamGoalieList.reduce((sum, g) => sum + g.timeOnIce, 0);
                if (totalToi === 0) return 0;

                let probs = teamGoalieList.map(g => g.timeOnIce / totalToi);
                if (isB2B && teamGoalieList.length > 1) {
                    const reduction = probs[0] * 0.4; 
                    probs[0] -= reduction;
                    probs[1] += reduction; 
                }

                let expectedAdj = 0;
                teamGoalieList.forEach((g, i) => {
                    const svPct = g.savePct || LEAGUE_AVG_SV;
                    const impact = (svPct - LEAGUE_AVG_SV) * 8; 
                    expectedAdj += probs[i] * impact;
                });
                return expectedAdj;
            };

            const homeGoalieAdj = getGoalieAdj(teamGoalies[home], homeB2B);
            const awayGoalieAdj = getGoalieAdj(teamGoalies[away], awayB2B);

            awayXG -= homeGoalieAdj;
            homeXG -= awayGoalieAdj;

            if (homeXG < 0.5) homeXG = 0.5;
            if (awayXG < 0.5) awayXG = 0.5;

            if (homeGoalieAdj > 0.15) homeReasons.push({ key: "reasonStrongGoalie", type: "plus" });
            else if (homeGoalieAdj < -0.15) homeReasons.push({ key: "reasonWeakGoalie", type: "minus" });

            if (awayGoalieAdj > 0.15) awayReasons.push({ key: "reasonStrongGoalie", type: "plus" });
            else if (awayGoalieAdj < -0.15) awayReasons.push({ key: "reasonWeakGoalie", type: "minus" });


            // --- STEP 4: MONTE CARLO ---
            const SIMULATIONS = 10000;
            let homeWins = 0; let awayWins = 0;
            let homeRegWins = 0; let awayRegWins = 0;
            let otGames = 0; let over55 = 0;
            const scoreFrequencies = {};

            for (let i = 0; i < SIMULATIONS; i++) {
                let hGoals = simulatePoisson(homeXG);
                let aGoals = simulatePoisson(awayXG);
                let ot = false;

                if (hGoals + aGoals > 5.5) over55++;

                if (hGoals === aGoals) {
                    ot = true;
                    otGames++;
                    if (Math.random() < (homeXG / (homeXG + awayXG))) { hGoals++; homeWins++; } 
                    else { aGoals++; awayWins++; }
                } else if (hGoals > aGoals) { homeRegWins++; homeWins++; } 
                else { awayRegWins++; awayWins++; }

                const scoreKey = ot ? `${hGoals}-${aGoals} OT` : `${hGoals}-${aGoals}`;
                scoreFrequencies[scoreKey] = (scoreFrequencies[scoreKey] || 0) + 1;
            }

            let mostLikelyScore = "";
            let highestFreq = 0;
            for (const [score, freq] of Object.entries(scoreFrequencies)) {
                if (freq > highestFreq) {
                    highestFreq = freq;
                    mostLikelyScore = score;
                }
            }

            const isOT = mostLikelyScore.includes('OT');
            const scoreParts = mostLikelyScore.replace(' OT', '').split('-');
            
            homeReasons.sort((a, b) => (a.type === 'plus' ? -1 : 1));
            awayReasons.sort((a, b) => (a.type === 'plus' ? -1 : 1));

            return { 
                gameId: game.id, home, away, 
                homeScore: parseInt(scoreParts[0]), awayScore: parseInt(scoreParts[1]), isOT, 
                homeWinProb: Math.round((homeWins / SIMULATIONS) * 100), 
                awayWinProb: Math.round((awayWins / SIMULATIONS) * 100),
                homeRegProb: Math.round((homeRegWins / SIMULATIONS) * 100),
                awayRegProb: Math.round((awayRegWins / SIMULATIONS) * 100),
                otProb: Math.round((otGames / SIMULATIONS) * 100),
                over55Prob: Math.round((over55 / SIMULATIONS) * 100),
                homeReasons, awayReasons 
            };
        }).filter(Boolean);

        matchPredictionsCache = predictions;
        console.log(`✅ Otteluennusteet valmiit!`);

    } catch (err) {
        console.error("Virhe otteluennusteissa:", err);
    }
}

// =================================================================
// 🚀 AI:N KÄYNNISTYSKESKUS (AAMUJÄÄ KLO 09:00 + TIETOKANTA)
// =================================================================

async function runAndSavePredictions() {
    await generateAIPredictions();
    await generateTeamPredictions();
    await generateMatchPredictions(); 
    
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const playersJson = JSON.stringify(aiPredictionsCache);
    const teamsJson = JSON.stringify(aiTeamCache);
    const matchesJson = JSON.stringify(matchPredictionsCache);
    
    // Tallennetaan kaikki kolme datasettiä kerralla tietokantaan historiaa varten
    db.run(`INSERT OR REPLACE INTO ai_predictions (date, players_json, teams_json, matches_json) VALUES (?, ?, ?, ?)`, 
        [dateStr, playersJson, teamsJson, matchesJson], 
        (err) => {
            if (err) console.error("❌ Virhe ennusteiden tallennuksessa tietokantaan:", err);
            else console.log(`💾 Kristallipallon tulokset (sis. ottelut) tallennettu tietokantaan päivälle ${dateStr}`);
        }
    );
}

runAndSavePredictions();

function scheduleNextMorningUpdate() {
    const now = new Date();
    const next9AM = new Date();
    next9AM.setHours(9, 0, 0, 0);
    if (now > next9AM) next9AM.setDate(next9AM.getDate() + 1);
    
    const timeUntil9AM = next9AM - now;
    console.log(`⏰ Seuraava AI-päivitys ajastettu: ${next9AM.toLocaleString('fi-FI')}`);

    setTimeout(() => {
        console.log("🌅 Huomenta! Ajetaan päivittäinen AI-päivitys...");
        runAndSavePredictions();
        
        setInterval(() => {
            console.log("🌅 Huomenta! Ajetaan päivittäinen AI-päivitys...");
            runAndSavePredictions();
        }, 24 * 60 * 60 * 1000);
    }, timeUntil9AM);
}

scheduleNextMorningUpdate();

// ==========================================
// 7. API-REITIT: DINOSAURUKSET
// ==========================================

app.use('/dinos', express.static(path.join(__dirname, 'public', 'dinos')));

app.get('/api/dinos/data', (req, res) => {
    const dataPath = path.join(__dirname, 'data', 'dinos.json');
    fs.readFile(dataPath, 'utf8', (err, data) => {
        if (err) {
            console.error("Virhe Dino-JSONissa:", err);
            res.status(500).json({ virhe: "Dinoja ei löytynyt" });
        } else {
            res.json(JSON.parse(data));
        }
    });
});

// --- PALAUTELOMAKKEEN KÄSITTELY ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS
    }
});

app.post('/api/palaute', (req, res) => {
    const { viesti, lahettaja } = req.body;

    if (!viesti || viesti.trim() === "") {
        return res.status(400).json({ error: "Viesti puuttuu." });
    }

    const mailOptions = {
        from: `Aamujää posti <${process.env.EMAIL_USER}`,
        to: process.env.EMAIL_RECEIVER,
        subject: '📩 Uusi palaute Aamujäiltä',
        text: `Sait uutta palautetta!\n\nLähettäjä: ${lahettaja || "Anonyymi"}\n\nViesti:\n${viesti}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error("Sähköpostivirhe:", error);
            res.status(500).json({ error: "Lähetys epäonnistui." });
        } else {
            console.log('Sähköposti lähetetty: ' + info.response);
            res.json({ status: "ok", message: "Palaute lähetetty!" });
        }
    });
});

// ==========================================
// 9. API-REITIT: SUOMEN LIIGA (ILTAJÄÄ)
// ==========================================
let liigaGamesCache = [];
let lastLiigaGamesFetch = 0;

// Oikea kauden laskenta: Syksy 2025 ja Kevät 2026 = Kausi 2026.
const getLiigaSeason = () => {
    const d = new Date();
    // Jos kuukausi on elokuu (7) tai myöhemmin, seuraava kevät on kauden vuosi.
    return d.getMonth() >= 7 ? d.getFullYear() + 1 : d.getFullYear();
};

// Reitti 1: Liigan Ottelut
app.get('/api/liiga/games', async (req, res) => {
    try {
        const now = Date.now();
        const activeSeason = getLiigaSeason();

        if (now - lastLiigaGamesFetch > 60000 || liigaGamesCache.length === 0) {
            console.log(`🏒 Haetaan Liigan kauden ${activeSeason} tulokset välimuistiin...`);
            const url = `https://liiga.fi/api/v2/games?tournament=runkosarja&season=${activeSeason}`;
            const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });

            if (response.ok) {
                liigaGamesCache = await response.json();
                lastLiigaGamesFetch = now;
            }
        }

        let targetDate = req.query.date;
        if (!targetDate) {
            const nowFi = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Helsinki" }));
            if (nowFi.getHours() < 10) nowFi.setDate(nowFi.getDate() - 1);
            targetDate = `${nowFi.getFullYear()}-${String(nowFi.getMonth() + 1).padStart(2, '0')}-${String(nowFi.getDate()).padStart(2, '0')}`;
        }

        const requestedGames = liigaGamesCache.filter(g => g.start && g.start.startsWith(targetDate));
        res.json(requestedGames);
    } catch (error) {
        console.error("❌ Liiga pelien haku kaatui:", error.message);
        res.status(500).json({ error: "Liiga-dataa ei saatu" });
    }
});

// Reitti 2: Liigan Sarjataulukko
app.get('/api/liiga/standings', async (req, res) => {
    try {
        if (liigaGamesCache.length === 0) return res.json([]);
        const teamsMap = {};

        liigaGamesCache.forEach(game => {
            if (!game.ended) return; 

            const hName = game.homeTeam.teamName;
            const aName = game.awayTeam.teamName;

            if (!teamsMap[hName]) teamsMap[hName] = { teamId: hName, teamName: hName, games: 0, wins: 0, losses: 0, points: 0 };
            if (!teamsMap[aName]) teamsMap[aName] = { teamId: aName, teamName: aName, games: 0, wins: 0, losses: 0, points: 0 };

            teamsMap[hName].games++;
            teamsMap[aName].games++;

            const hG = game.homeTeam.goals;
            const aG = game.awayTeam.goals;
            const isReg = game.finishedType === "ENDED_DURING_REGULAR_GAME_TIME";

            if (hG > aG) {
                teamsMap[hName].wins++;
                teamsMap[hName].points += isReg ? 3 : 2;
                if (!isReg) teamsMap[aName].points += 1;
                if (isReg) teamsMap[aName].losses++;
            } else if (aG > hG) {
                teamsMap[aName].wins++;
                teamsMap[aName].points += isReg ? 3 : 2;
                if (!isReg) teamsMap[hName].points += 1;
                if (isReg) teamsMap[hName].losses++;
            }
        });

        const standings = Object.values(teamsMap).sort((a, b) => b.points - a.points);
        res.json(standings);
    } catch (error) {
        console.error("❌ Sarjataulukkovirhe:", error.message);
        res.status(500).json({ error: "Sarjataulukkoa ei saatu" });
    }
});

// Reitti 3: Liigan Pistepörssi (OMA LASKENTA - TOIMII VARMASTI!)
app.get('/api/liiga/players', async (req, res) => {
    try {
        if (liigaGamesCache.length === 0) return res.json([]);
        const playersMap = {};

        liigaGamesCache.forEach(game => {
            if (!game.started) return;

            // 1. Maalit ja syötöt
            const processGoals = (teamEvents, teamName) => {
                if (!teamEvents) return;
                teamEvents.forEach(g => {
                    if (g.scorerPlayerId && g.scorerPlayer) {
                        const pid = g.scorerPlayerId;
                        if (!playersMap[pid]) playersMap[pid] = { id: pid, firstName: g.scorerPlayer.firstName, lastName: g.scorerPlayer.lastName, teamId: teamName, goals: 0, assists: 0, points: 0, pim: 0 };
                        playersMap[pid].goals++;
                        playersMap[pid].points++;
                    }
                    if (g.assistantPlayers) {
                        g.assistantPlayers.forEach(a => {
                            const pid = a.playerId;
                            if (!playersMap[pid]) playersMap[pid] = { id: pid, firstName: a.firstName, lastName: a.lastName, teamId: teamName, goals: 0, assists: 0, points: 0, pim: 0 };
                            playersMap[pid].assists++;
                            playersMap[pid].points++;
                        });
                    }
                });
            };

            // 2. Jäähyt (Lisätty omaan toimivaan koodiisi!)
            const processPenalties = (teamEvents, teamName) => {
                if (!teamEvents) return;
                teamEvents.forEach(p => {
                    if (p.playerId && p.player) {
                        const pid = p.playerId;
                        if (!playersMap[pid]) playersMap[pid] = { id: pid, firstName: p.player.firstName, lastName: p.player.lastName, teamId: teamName, goals: 0, assists: 0, points: 0, pim: 0 };
                        playersMap[pid].pim += (p.duration || 2); // Jos ei lue minuutteja, oletetaan 2min
                    }
                });
            };

            processGoals(game.homeTeam.goalEvents, game.homeTeam.teamName);
            processGoals(game.awayTeam.goalEvents, game.awayTeam.teamName);
            
            processPenalties(game.homeTeam.penaltyEvents, game.homeTeam.teamName);
            processPenalties(game.awayTeam.penaltyEvents, game.awayTeam.teamName);
        });

        // Lajitellaan oletuksena pisteiden mukaan
        const topPlayers = Object.values(playersMap)
            .sort((a, b) => b.points - a.points || b.goals - a.goals)
            .slice(0, 50);

        res.json(topPlayers);
    } catch (error) {
        console.error("❌ Pistepörssivirhe:", error.message);
        res.status(500).json({ error: "Pistepörssiä ei saatu" });
    }
});

// Reitti 4: Yksittäisen pelin SYVÄDATA (Kokoonpanot ja tilastot)
app.get('/api/liiga/game/:id', async (req, res) => {
    try {
        const gameId = req.params.id;
        const activeSeason = getLiigaSeason();

        const gameUrl = `https://liiga.fi/api/v2/games/${activeSeason}/${gameId}`;
        const statsUrl = `https://liiga.fi/api/v2/games/${gameId}/statistics`;

        const [gameRes, statsRes] = await Promise.all([
            fetch(gameUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
            fetch(statsUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        ]);

        const gameData = await gameRes.json();
        const statsData = statsRes.ok ? await statsRes.json() : null;

        // yhdistetään stats ilman että rikotaan rakennetta
        gameData.statistics = statsData;

        res.json(gameData);

    } catch (error) {
        console.error("❌ Liiga pelin tietojen haku kaatui:", error.message);
        res.status(500).json({ error: "Pelitietoja ei saatu" });
    }
});

// Reitti 5: Liiga Joukkueen tiedot (Otteluohjelma ja Viimeisin Kokoonpano)
app.get('/api/liiga/team/:teamId', async (req, res) => {
    try {
        const teamId = req.params.teamId.toUpperCase();
        
        if (liigaGamesCache.length === 0) {
            return res.json({ schedule: [], roster: [] });
        }

        // Sanakirja: Muutetaan lyhenne Liigan API:n käyttämäksi nimeksi
        const TEAM_MAP = {
            "HIFK": "HIFK", "HPK": "HPK", "ILV": "ILVES", "JUK": "JUKURIT",
            "JYP": "JYP", "KAL": "KALPA", "K-ESPOO": "KIEKKO-ESPOO", "KOO": "KOOKOO",
            "KÄR": "KÄRPÄT", "LUK": "LUKKO", "PEL": "PELICANS", "SAI": "SAIPA",
            "SPO": "SPORT", "TAP": "TAPPARA", "TPS": "TPS", "ÄSS": "ÄSSÄT"
        };
        const searchName = TEAM_MAP[teamId] || teamId;

        // 1. Etsitään KAIKKI joukkueen pelit (Koti ja Vieras) nimen perusteella
        const teamGames = liigaGamesCache.filter(g => {
            const homeName = g.homeTeam.teamName ? g.homeTeam.teamName.toUpperCase() : "";
            const awayName = g.awayTeam.teamName ? g.awayTeam.teamName.toUpperCase() : "";
            
            // Puhdistetaan roska (esim. "362185137:tappara" -> "TAPPARA")
            const cleanHome = homeName.includes(':') ? homeName.split(':').pop() : homeName;
            const cleanAway = awayName.includes(':') ? awayName.split(':').pop() : awayName;

            return cleanHome === searchName || cleanAway === searchName;
        });

        // 2. Etsitään viimeisin pelattu peli, jotta saadaan tuorein kokoonpano
        const playedGames = teamGames.filter(g => g.started || g.ended).sort((a, b) => new Date(b.start) - new Date(a.start));
        let roster = [];

        if (playedGames.length > 0) {
            const lastGame = playedGames[0];
            const activeSeason = getLiigaSeason(); 
            
            const deepRes = await fetch(`https://liiga.fi/api/v2/games/${activeSeason}/${lastGame.id}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            
            if (deepRes.ok) {
                const deepData = await deepRes.json();
                
                const deepHomeName = deepData.homeTeam?.teamName ? deepData.homeTeam.teamName.toUpperCase() : "";
                const cleanDeepHome = deepHomeName.includes(':') ? deepHomeName.split(':').pop() : deepHomeName;

                const isHome = cleanDeepHome === searchName;
                roster = isHome ? (deepData.homeTeamPlayers || []) : (deepData.awayTeamPlayers || []);
            }
        }

        res.json({
            schedule: teamGames,
            roster: roster
        });

    } catch (error) {
        console.error("❌ Joukkueen haussa virhe:", error.message);
        res.status(500).json({ error: "Joukkuedataa ei saatu" });
    }
});

// ==========================================
// 4. KÄYNNISTYS
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Palvelin käynnissä portissa ${PORT}`);
});