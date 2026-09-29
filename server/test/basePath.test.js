import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { stripBasePath } from '../src/lib/basePath.js';

/**
 * Frontendin juuritiedostot sellaisina kuin ne ovat oikeassa dist-kansiossa.
 */
const DIST = new Set([
    'index.html',
    'assets',
    'manifest.webmanifest',
    'icon-192.png',
    'icon-512.png',
    'apple-touch-icon.png',
    'splash.png',
    'sw.js',
]);

describe('alipolun tunnistus ilman asetusta', () => {
    // Palvelin välittää polun alipolun kanssa (Passenger, cPanel).
    test('karsii alipolun rajapintapyynnöstä', () => {
        assert.equal(stripBasePath('/hockey/api/nhl/standings', DIST), '/api/nhl/standings');
    });

    test('karsii alipolun tiedostopyynnöstä', () => {
        assert.equal(stripBasePath('/hockey/assets/index-abc123.css', DIST), '/assets/index-abc123.css');
    });

    test('karsii alipolun manifestista', () => {
        assert.equal(stripBasePath('/hockey/manifest.webmanifest', DIST), '/manifest.webmanifest');
    });

    test('alipolku ilman kauttaviivaa muuttuu juureksi', () => {
        assert.equal(stripBasePath('/hockey', DIST), '/');
    });

    test('alipolku kauttaviivan kanssa muuttuu juureksi', () => {
        assert.equal(stripBasePath('/hockey/', DIST), '/');
    });

    test('kyselymerkkijono säilyy', () => {
        assert.equal(stripBasePath('/hockey/api/nhl/day?date=2026-10-07', DIST), '/api/nhl/day?date=2026-10-07');
    });

    // Palvelin karsii alipolun jo itse — polkua ei saa karsia toiseen kertaan.
    test('valmiiksi karsittu rajapintapolku säilyy', () => {
        assert.equal(stripBasePath('/api/nhl/standings', DIST), '/api/nhl/standings');
    });

    test('valmiiksi karsittu tiedostopolku säilyy', () => {
        assert.equal(stripBasePath('/assets/index-abc123.css', DIST), '/assets/index-abc123.css');
    });

    test('juuri säilyy juurena', () => {
        assert.equal(stripBasePath('/', DIST), '/');
    });

    test('juuren tiedosto säilyy', () => {
        assert.equal(stripBasePath('/manifest.webmanifest', DIST), '/manifest.webmanifest');
    });

    test('alipolku voi olla mikä tahansa, ei vain hockey', () => {
        assert.equal(stripBasePath('/aamujaa-api/api/health', DIST), '/api/health');
    });
});

describe('pakotettu BASE_PATH', () => {
    test('karsii määritellyn alipolun', () => {
        assert.equal(stripBasePath('/hockey/api/health', DIST, '/hockey'), '/api/health');
    });

    test('pelkkä alipolku muuttuu juureksi', () => {
        assert.equal(stripBasePath('/hockey', DIST, '/hockey'), '/');
    });

    /*
     * Tärkein tapaus: BASE_PATH on asetettu, mutta palvelin karsiikin polun
     * itse. Silloin polkua ei saa karsia uudelleen — muuten '/api/health'
     * muuttuisi merkkijonoksi 'health' ja mikään ei löytyisi.
     */
    test('ei karsi toiseen kertaan jos palvelin karsi jo', () => {
        assert.equal(stripBasePath('/api/health', DIST, '/hockey'), '/api/health');
        assert.equal(stripBasePath('/assets/index.css', DIST, '/hockey'), '/assets/index.css');
    });
});
