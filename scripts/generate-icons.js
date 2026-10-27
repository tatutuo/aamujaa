/**
 * Luo sovelluksen ikonit logon SVG:stä (public/icon.svg).
 *
 * Aja `npm run icons` aina kun logo muuttuu.
 *
 * Maskable-ikoni on Play Store -julkaisussa oleellinen: Android leikkaa
 * tavallisen ikonin oman maskinsa mukaan, joten logon on mahduttava 80 %:n
 * turva-alueelle. Ilman erillistä maskable-versiota logon reunat leikkautuvat.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const PUBLIC_DIR = 'public';
const SOURCE = path.join(PUBLIC_DIR, 'icon.svg');
const SAFE_ZONE_RATIO = 0.78;
const BACKGROUND = { r: 26, g: 29, b: 33, alpha: 1 }; // grafiitti #1a1d21
const PNG_OPTIONS = { compressionLevel: 9, effort: 10, palette: true };

if (!fs.existsSync(SOURCE)) {
    console.error(`Lähdekuvaa ei löydy: ${SOURCE}`);
    process.exit(1);
}

const out = (name) => path.join(PUBLIC_DIR, name);
// Korkea tiheys: SVG piirretään tarkkana ja pienennetään, ei venytetä.
const render = (size) => sharp(SOURCE, { density: 300 }).resize(size, size);

const sizes = [
    { name: 'icon-512.png', size: 512 },
    { name: 'icon-192.png', size: 192 },
    { name: 'apple-touch-icon.png', size: 180 },
];

for (const { name, size } of sizes) {
    await render(size).png(PNG_OPTIONS).toFile(out(`tmp-${name}`));
    fs.renameSync(out(`tmp-${name}`), out(name));
    console.log(`✓ ${name} (${size}x${size})`);
}

const maskableSize = 512;
const inner = Math.round(maskableSize * SAFE_ZONE_RATIO);
const logo = await render(inner).png().toBuffer();

await sharp({
    create: { width: maskableSize, height: maskableSize, channels: 4, background: BACKGROUND },
})
    .composite([{ input: logo, gravity: 'centre' }])
    .png(PNG_OPTIONS)
    .toFile(out('icon-maskable-512.png'));

console.log(`✓ icon-maskable-512.png (${maskableSize}x${maskableSize}, turva-alue ${SAFE_ZONE_RATIO * 100} %)`);
