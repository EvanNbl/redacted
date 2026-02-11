/**
 * Génère un fichier icon.ico Windows valide à partir de logo.webp.
 * Requis pour le build Tauri sur Windows (RC.EXE refuse le .ico généré par Sharp).
 * Usage: node scripts/generate-ico.cjs
 */

const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const LOGO = path.join(ROOT, "public", "icon", "logo.webp");
const OUT_DIR = path.join(ROOT, "src-tauri", "icons");
const OUT_ICO = path.join(OUT_DIR, "icon.ico");

const SIZES = [16, 32, 48, 256];

async function main() {
  if (!fs.existsSync(LOGO)) {
    console.error("Logo introuvable:", LOGO);
    process.exit(1);
  }

  const tempFiles = [];
  try {
    const buffers = [];
    for (const size of SIZES) {
      const buf = await sharp(LOGO)
        .resize(size, size)
        .png()
        .toBuffer();
      const tmpPath = path.join(OUT_DIR, `_ico_${size}.png`);
      fs.writeFileSync(tmpPath, buf);
      tempFiles.push(tmpPath);
      buffers.push(buf);
    }

    const { default: pngToIco } = await import("png-to-ico");
    const icoBuf = await pngToIco(buffers);
    fs.writeFileSync(OUT_ICO, icoBuf);
    console.log("Écrit:", OUT_ICO);
  } finally {
    for (const f of tempFiles) {
      try {
        fs.unlinkSync(f);
      } catch (_) {}
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
