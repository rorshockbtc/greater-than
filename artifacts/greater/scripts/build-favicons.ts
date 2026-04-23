import sharp from "sharp";
import pngToIco from "png-to-ico";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PINK = "#FE299E";
const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");
mkdirSync(PUBLIC, { recursive: true });

const chevronSvg = (size: number, color = PINK, bg = "none", radius = 0) => `
<svg width="${size}" height="${size}" viewBox="0 0 100 100"
     xmlns="http://www.w3.org/2000/svg">
  ${bg === "none" ? "" : `<rect width="100" height="100" rx="${radius}" fill="${bg}"/>`}
  <path d="M 28 22 L 72 50 L 28 78 L 28 62 L 48 50 L 28 38 Z" fill="${color}"/>
</svg>`;

async function pngFromSvg(svg: string, outPath: string) {
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log("wrote", outPath);
}

async function buildFavicons() {
  await pngFromSvg(chevronSvg(512), join(PUBLIC, "favicon-512.png"));
  await pngFromSvg(chevronSvg(32), join(PUBLIC, "favicon-32.png"));
  await pngFromSvg(chevronSvg(16), join(PUBLIC, "favicon-16.png"));
  await pngFromSvg(
    chevronSvg(180, "#FFFFFF", PINK, 36),
    join(PUBLIC, "apple-touch-icon.png"),
  );
  writeFileSync(
    join(PUBLIC, "favicon.svg"),
    chevronSvg(64).trim() + "\n",
    "utf8",
  );
  console.log("wrote", join(PUBLIC, "favicon.svg"));

  // Multi-size .ico for legacy browsers and bookmark folders.
  const ico = await pngToIco([
    join(PUBLIC, "favicon-16.png"),
    join(PUBLIC, "favicon-32.png"),
  ]);
  writeFileSync(join(PUBLIC, "favicon.ico"), ico);
  console.log("wrote", join(PUBLIC, "favicon.ico"));
}

async function buildOg() {
  const W = 1200;
  const H = 630;
  const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B0B0F"/>
      <stop offset="100%" stop-color="#15101A"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>

  <g transform="translate(80, 90)">
    <path d="M 0 0 L 80 50 L 0 100 L 0 72 L 36 50 L 0 28 Z" fill="${PINK}"/>
  </g>

  <text x="190" y="175" font-family="Inter, system-ui, sans-serif"
        font-size="56" font-weight="700" fill="#F5F2EE"
        letter-spacing="-2">Greater</text>

  <text x="80" y="320" font-family="Inter, system-ui, sans-serif"
        font-size="64" font-weight="600" fill="#F5F2EE"
        letter-spacing="-2">A chatbot that actually</text>
  <text x="80" y="400" font-family="Inter, system-ui, sans-serif"
        font-size="64" font-weight="600" fill="${PINK}"
        letter-spacing="-2">knows your business.</text>

  <text x="80" y="500" font-family="Inter, system-ui, sans-serif"
        font-size="28" font-weight="400" fill="#A9A2B0"
        letter-spacing="-0.5">FOSS shell. WebGPU in-browser inference. Six industry bots.</text>

  <text x="80" y="565" font-family="ui-monospace, SFMono-Regular, monospace"
        font-size="20" font-weight="500" fill="#7A7280"
        letter-spacing="1">HIRE.COLONHYPHENBRACKET.PINK</text>
</svg>`;
  await sharp(Buffer.from(svg))
    .jpeg({ quality: 88 })
    .toFile(join(PUBLIC, "opengraph.jpg"));
  console.log("wrote", join(PUBLIC, "opengraph.jpg"));
}

(async () => {
  await buildFavicons();
  await buildOg();
})();
