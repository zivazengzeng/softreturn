import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const sourceCat = fileURLToPath(new URL("../src/pet-cat.png", import.meta.url));
const appIconDir = new URL("../ios/App/App/Assets.xcassets/AppIcon.appiconset/", import.meta.url);
const splashDir = new URL("../ios/App/App/Assets.xcassets/Splash.imageset/", import.meta.url);

await mkdir(appIconDir, { recursive: true });
await mkdir(splashDir, { recursive: true });

const iconCat = await sharp(sourceCat).resize({ width: 760, fit: "inside" }).png().toBuffer();

await sharp({
  create: {
    width: 1024,
    height: 1024,
    channels: 4,
    background: "#f0efff",
  },
})
  .composite([
    {
      input: Buffer.from(
        `<svg width="1024" height="1024" viewBox="0 0 1024 1024">
          <circle cx="760" cy="170" r="220" fill="#ded8ff"/>
          <circle cx="210" cy="780" r="260" fill="#ffffff" opacity="0.55"/>
          <circle cx="360" cy="260" r="180" fill="#e9e5ff" opacity="0.88"/>
        </svg>`,
      ),
    },
    {
      input: iconCat,
      gravity: "center",
      top: 120,
      left: 112,
    },
  ])
  .png()
  .toFile(fileURLToPath(new URL("AppIcon-512@2x.png", appIconDir)));

const splashCat = await sharp(sourceCat).resize({ width: 760, fit: "inside" }).png().toBuffer();
const splashOverlay = Buffer.from(
  `<svg width="2732" height="2732" viewBox="0 0 2732 2732">
    <rect width="2732" height="2732" fill="#f0efff"/>
    <circle cx="2180" cy="420" r="560" fill="#ded8ff"/>
    <circle cx="420" cy="2140" r="680" fill="#ffffff" opacity="0.56"/>
    <circle cx="690" cy="610" r="430" fill="#e8e3ff" opacity="0.82"/>
    <text x="1366" y="1780" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, PingFang SC, sans-serif" font-size="150" font-weight="800" fill="#111111">慢慢回来</text>
    <text x="1366" y="1910" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, PingFang SC, sans-serif" font-size="58" font-weight="500" fill="#626086">今天不是战场</text>
  </svg>`,
);

for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
  await sharp({
    create: {
      width: 2732,
      height: 2732,
      channels: 4,
      background: "#f0efff",
    },
  })
    .composite([
      { input: splashOverlay },
      { input: splashCat, top: 650, left: 966 },
    ])
    .png()
    .toFile(fileURLToPath(new URL(name, splashDir)));
}
