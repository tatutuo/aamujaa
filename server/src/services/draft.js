import { web } from '../lib/nhlApi.js';
import { getOrFetch } from '../lib/cache.js';

/**
 * Draft: varaustilaisuuden valinnat ja NHL Central Scoutingin rankingit.
 *
 * Varauslistassa ei ole NHL:n pelaajatunnisteita, joten rivejä ei voi
 * avata pelaajakortiksi. Pituus ja paino muunnetaan senteiksi ja kiloiksi.
 */

const TTL_DRAFT = 6 * 60 * 60_000;

const cm = (inches) => (inches ? Math.round(inches * 2.54) : null);
const kg = (pounds) => (pounds ? Math.round(pounds * 0.4536) : null);

const RANKING_CATEGORIES = { 1: 'na-skater', 2: 'intl-skater', 3: 'na-goalie', 4: 'intl-goalie' };

export async function getDraftPicks(year) {
    const key = year ?? 'now';
    return getOrFetch(`draft:picks:${key}`, TTL_DRAFT, async () => {
        // "now" palauttaa vain ensimmäisen kierroksen, joten vuosi selvitetään ensin.
        const draftYear = year ?? (await web('/draft/picks/now')).draftYear;
        const data = await web(`/draft/picks/${draftYear}/all`);
        return {
            year: data.draftYear,
            years: data.draftYears ?? [],
            picks: (data.picks ?? []).map((p) => ({
                id: p.overallPick,
                round: p.round,
                pickInRound: p.pickInRound,
                overall: p.overallPick,
                team: p.teamAbbrev,
                history: p.teamPickHistory && p.teamPickHistory !== p.teamAbbrev ? p.teamPickHistory : null,
                name: `${p.firstName?.default ?? ''} ${p.lastName?.default ?? ''}`.trim(),
                pos: p.positionCode,
                nat: p.countryCode,
                height: cm(p.height),
                weight: kg(p.weight),
                club: p.amateurClubName ?? null,
                league: p.amateurLeague ?? null,
            })),
        };
    });
}

export async function getDraftRankings(year, category = 1) {
    const key = `${year ?? 'now'}:${category}`;
    return getOrFetch(`draft:rankings:${key}`, TTL_DRAFT, async () => {
        const draftYear = year ?? (await web('/draft/rankings/now')).draftYear;
        const data = await web(`/draft/rankings/${draftYear}/${category}`).catch(() => null);
        return {
            year: data?.draftYear ?? draftYear,
            category: RANKING_CATEGORIES[data?.categoryId ?? category] ?? null,
            categoryId: data?.categoryId ?? category,
            years: data?.draftYears ?? [],
            rankings: (data?.rankings ?? []).map((r, i) => ({
                id: `${i}-${r.lastName}`,
                rank: r.finalRank ?? r.midtermRank ?? null,
                midterm: r.midtermRank ?? null,
                final: r.finalRank ?? null,
                name: `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim(),
                pos: r.positionCode,
                shoots: r.shootsCatches,
                nat: r.birthCountry,
                birthDate: r.birthDate,
                height: cm(r.heightInInches),
                weight: kg(r.weightInPounds),
                club: r.lastAmateurClub ?? null,
                league: r.lastAmateurLeague ?? null,
            })),
        };
    });
}
