const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const logo = path.join(__dirname, '..', 'public', 'logo.png');
const outDir = path.join(__dirname, '..', 'public');

const sizes = [192, 512, 180];

async function main() {
  for (const size of sizes) {
    const bg = Buffer.from(
      `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1a4fd6"/>
            <stop offset="100%" stop-color="#0d2137"/>
          </linearGradient>
        </defs>
        <rect width="${size}" height="${size}" fill="url(#g)" rx="${Math.round(size * 0.22)}"/>
      </svg>`
    );

    const logoSize = Math.round(size * 0.65);
    const offset = Math.round((size - logoSize) / 2);

    const logoResized = await sharp(logo)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    await sharp(bg)
      .composite([{ input: logoResized, top: offset, left: offset }])
      .png()
      .toFile(path.join(outDir, `icon-${size}.png`));

    console.log(`Created icon-${size}.png`);
  }
}

main().catch(console.error);
