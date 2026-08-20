import sharp from "sharp";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = resolve(__dirname, "../apps/mobile/assets");

const BRAND = {
  bg: "#14181D",
  primary: "#5B5BF0",
  primaryStrong: "#3E3ED8",
  secondary: "#B34AF0",
  accent: "#38BDF8",
  white: "#FFFFFF",
  neutral900: "#14181D",
  neutral800: "#232A33",
};

function makeIconSvg(size) {
  const s = size;
  const r = s * 0.22;
  const cx = s / 2;
  const cy = s / 2;
  const orbR = s * 0.14;

  return `
  <svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="auroraBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${BRAND.primary}" />
        <stop offset="45%" stop-color="${BRAND.secondary}" />
        <stop offset="100%" stop-color="${BRAND.accent}" />
      </linearGradient>
      <linearGradient id="orbGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${BRAND.primary}" stop-opacity="0.9" />
        <stop offset="100%" stop-color="${BRAND.secondary}" stop-opacity="0.7" />
      </linearGradient>
      <linearGradient id="orbGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${BRAND.accent}" stop-opacity="0.8" />
        <stop offset="100%" stop-color="${BRAND.primary}" stop-opacity="0.6" />
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${BRAND.white}" stop-opacity="0.15" />
        <stop offset="100%" stop-color="${BRAND.white}" stop-opacity="0" />
      </radialGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="${s * 0.01}" stdDeviation="${s * 0.02}" flood-color="${BRAND.bg}" flood-opacity="0.4"/>
      </filter>
    </defs>

    <!-- Background -->
    <rect width="${s}" height="${s}" fill="${BRAND.bg}" rx="${r * 0.3}" />

    <!-- Aurora orbs -->
    <circle cx="${cx - orbR * 0.7}" cy="${cy - orbR * 0.4}" r="${orbR * 1.6}" fill="url(#orbGrad1)" opacity="0.55" />
    <circle cx="${cx + orbR * 0.6}" cy="${cy + orbR * 0.5}" r="${orbR * 1.4}" fill="url(#orbGrad2)" opacity="0.45" />
    <circle cx="${cx}" cy="${cy - orbR * 0.1}" r="${orbR * 0.9}" fill="url(#glow)" />

    <!-- "C" letterform -->
    <text x="${cx}" y="${cy + s * 0.04}" text-anchor="middle" dominant-baseline="central"
          font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"
          font-size="${s * 0.38}" font-weight="700" fill="${BRAND.white}"
          letter-spacing="${s * -0.01}">
      C
    </text>

    <!-- Subtle "AI" label -->
    <text x="${cx}" y="${cy + s * 0.18}" text-anchor="middle" dominant-baseline="central"
          font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"
          font-size="${s * 0.065}" font-weight="600" fill="${BRAND.white}" opacity="0.7"
          letter-spacing="${s * 0.012}">
      AI
    </text>
  </svg>`;
}

function makeSplashIconSvg(size) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const orbR = s * 0.14;

  return `
  <svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="orbGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${BRAND.primary}" stop-opacity="0.9" />
        <stop offset="100%" stop-color="${BRAND.secondary}" stop-opacity="0.7" />
      </linearGradient>
      <linearGradient id="orbGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${BRAND.accent}" stop-opacity="0.8" />
        <stop offset="100%" stop-color="${BRAND.primary}" stop-opacity="0.6" />
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${BRAND.white}" stop-opacity="0.15" />
        <stop offset="100%" stop-color="${BRAND.white}" stop-opacity="0" />
      </radialGradient>
    </defs>

    <!-- Aurora orbs -->
    <circle cx="${cx - orbR * 0.7}" cy="${cy - orbR * 0.4}" r="${orbR * 1.6}" fill="url(#orbGrad1)" opacity="0.55" />
    <circle cx="${cx + orbR * 0.6}" cy="${cy + orbR * 0.5}" r="${orbR * 1.4}" fill="url(#orbGrad2)" opacity="0.45" />
    <circle cx="${cx}" cy="${cy - orbR * 0.1}" r="${orbR * 0.9}" fill="url(#glow)" />

    <!-- "C" letterform -->
    <text x="${cx}" y="${cy + s * 0.04}" text-anchor="middle" dominant-baseline="central"
          font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"
          font-size="${s * 0.38}" font-weight="700" fill="${BRAND.white}"
          letter-spacing="${s * -0.01}">
      C
    </text>

    <!-- Subtle "AI" label -->
    <text x="${cx}" y="${cy + s * 0.18}" text-anchor="middle" dominant-baseline="central"
          font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"
          font-size="${s * 0.065}" font-weight="600" fill="${BRAND.white}" opacity="0.7"
          letter-spacing="${s * 0.012}">
      AI
    </text>
  </svg>`;
}

function makeSplashSvg(w, h) {
  return `
  <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${BRAND.neutral900}" />
        <stop offset="100%" stop-color="${BRAND.neutral800}" />
      </linearGradient>
      <linearGradient id="auroraTop" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${BRAND.primary}" stop-opacity="0.45" />
        <stop offset="50%" stop-color="${BRAND.secondary}" stop-opacity="0.35" />
        <stop offset="100%" stop-color="${BRAND.accent}" stop-opacity="0.25" />
      </linearGradient>
      <radialGradient id="centerGlow" cx="50%" cy="45%" r="35%">
        <stop offset="0%" stop-color="${BRAND.primary}" stop-opacity="0.2" />
        <stop offset="100%" stop-color="${BRAND.primary}" stop-opacity="0" />
      </radialGradient>
    </defs>

    <!-- Background -->
    <rect width="${w}" height="${h}" fill="url(#bgGrad)" />

    <!-- Aurora orbs -->
    <ellipse cx="${w * 0.3}" cy="${h * 0.32}" rx="${w * 0.45}" ry="${h * 0.18}" fill="url(#auroraTop)" />
    <ellipse cx="${w * 0.7}" cy="${h * 0.65}" rx="${w * 0.35}" ry="${h * 0.15}" fill="url(#auroraTop)" opacity="0.3" />
    <ellipse cx="${w * 0.5}" cy="${h * 0.45}" rx="${w * 0.5}" ry="${h * 0.25}" fill="url(#centerGlow)" />

    <!-- Logo "C" -->
    <text x="${w / 2}" y="${h * 0.42}" text-anchor="middle" dominant-baseline="central"
          font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"
          font-size="${w * 0.12}" font-weight="700" fill="${BRAND.white}">
      C
    </text>
    <text x="${w / 2}" y="${h * 0.50}" text-anchor="middle" dominant-baseline="central"
          font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"
          font-size="${w * 0.025}" font-weight="600" fill="${BRAND.white}" opacity="0.7"
          letter-spacing="${w * 0.005}">
      AI
    </text>

    <!-- App name -->
    <text x="${w / 2}" y="${h * 0.62}" text-anchor="middle" dominant-baseline="central"
          font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"
          font-size="${w * 0.045}" font-weight="700" fill="${BRAND.white}"
          letter-spacing="${w * 0.002}">
      CareerOS AI
    </text>
    <text x="${w / 2}" y="${h * 0.67}" text-anchor="middle" dominant-baseline="central"
          font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"
          font-size="${w * 0.018}" font-weight="500" fill="${BRAND.white}" opacity="0.55"
          letter-spacing="${w * 0.003}">
      Your AI Career Companion
    </text>
  </svg>`;
}

async function generate() {
  console.log("Generating app icon (1024x1024)...");
  const iconSvg = makeIconSvg(1024);
  await sharp(Buffer.from(iconSvg)).png().toFile(resolve(ASSETS_DIR, "icon.png"));

  console.log("Generating adaptive icon foreground (1024x1024)...");
  const iconFgSvg = makeIconSvg(1024);
  await sharp(Buffer.from(iconFgSvg)).png().toFile(resolve(ASSETS_DIR, "adaptive-icon.png"));

  console.log("Generating transparent splash logo (512x512)...");
  const splashIconSvg = makeSplashIconSvg(512);
  await sharp(Buffer.from(splashIconSvg)).png().toFile(resolve(ASSETS_DIR, "splash-icon.png"));

  console.log("Generating splash (1284x2778)...");
  const splashSvg = makeSplashSvg(1284, 2778);
  await sharp(Buffer.from(splashSvg)).png().toFile(resolve(ASSETS_DIR, "splash.png"));

  console.log("Generating splash (200x400) for tablet...");
  const splashTabletSvg = makeSplashSvg(200, 400);
  await sharp(Buffer.from(splashTabletSvg)).png().toFile(resolve(ASSETS_DIR, "splash-tablet.png"));

  console.log("Generating favicon (48x48)...");
  const faviconSvg = makeIconSvg(48);
  await sharp(Buffer.from(faviconSvg)).png().toFile(resolve(ASSETS_DIR, "favicon.png"));

  console.log("Done. Assets written to", ASSETS_DIR);
}

generate().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
