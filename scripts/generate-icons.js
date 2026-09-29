/**
 * Luo sovelluksen ikonit yhdestä lähdekuvasta.
 *
 * Aja `npm run icons` aina kun public/icon-512.png vaihtuu.
 *
 * Maskable-ikoni on Play Store -julkaisussa oleellinen: Android leikkaa
 * tavallisen ikonin oman maskinsa mukaan, joten logon on mahduttava 80 %:n
 * turva-alueelle. Ilman erillistä maskable-versiota logon reunat leikkautuvat.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const PUBLIC_DIR = 'public';
const SOURCE = path.join(PUBLIC_DIR, 'icon-512.png');
const SAFE_ZONE_RATIO = 0.78;
const BACKGROUND = { r: 10, g: 10, b: 10, alpha: 1 };
const PNG_OPTIONS = { compressionLevel: 9, effort: 10, palette: true };

if (!fs.existsSync(SOURCE)) {
    console.error(`Lähdekuvaa ei löydy: ${SOURCE}`);
    process.exit(1);
}

const out = (name) => path.join(PUBLIC_DIR, name);

const sizes = [
    { name: 'icon-192.png', size: 192 },
    { name: 'apple-touch-icon.png', size: 180 },
];

for (const { name, size } of sizes) {
    await sharp(SOURCE).resize(size, size).png(PNG_OPTIONS).toFile(out(`tmp-${name}`));
    fs.renameSync(out(`tmp-${name}`), out(name));
    console.log(`✓ ${name} (${size}x${size})`);
}

const maskableSize = 512;
const inner = Math.round(maskableSize * SAFE_ZONE_RATIO);
const logo = await sharp(SOURCE).resize(inner, inner, { fit: 'contain' }).toBuffer();

await sharp({
    create: { width: maskableSize, height: maskableSize, channels: 4, background: BACKGROUND },
})
    .composite([{ input: logo, gravity: 'centre' }])
    .png(PNG_OPTIONS)
    .toFile(out('icon-maskable-512.png'));

console.log(`✓ icon-maskable-512.png (${maskableSize}x${maskableSize}, turva-alue ${SAFE_ZONE_RATIO * 100} %)`);
