/**
 * Build both LocalLLM variants (Classic + Aero/FraniumOS) sequentially.
 *
 * Usage:
 *   node scripts/build-variants.js          # Build both
 *   node scripts/build-variants.js classic   # Build classic only
 *   node scripts/build-variants.js aero      # Build aero only
 */
import { readFileSync, writeFileSync, copyFileSync, readdirSync, mkdirSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { platform } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TAURI_CONF = join(ROOT, "src-tauri", "tauri.conf.json");
const IS_LINUX = platform() === "linux";
const BUNDLE_BASE = join(ROOT, "src-tauri", "target", "release", "bundle");
const BUNDLE_DIR = IS_LINUX ? BUNDLE_BASE : join(BUNDLE_BASE, "nsis");
const OUTPUT_DIR = join(ROOT, "build_installator");

// Read and store the original config
const originalConfig = readFileSync(TAURI_CONF, "utf-8");

const variants = [
  {
    name: "classic",
    env: "classic",
    productName: "LocalLLM",
    identifier: "com.localllm.app",
    windowTitle: "LocalLLM",
    transparent: false,
    outputFilename: null, // uses default NSIS name
  },
  {
    name: "aero",
    env: "aero",
    productName: "LocalLLM For FraniumOS",
    identifier: "com.franiumos.localllm",
    windowTitle: "LocalLLM For FraniumOS",
    transparent: true,
    outputFilename: null,
  },
];

// Filter to specific variant if argument provided
// On Linux, skip Aero variant (FraniumOS is Windows-only)
const requestedVariant = process.argv[2];
let toBuild = requestedVariant
  ? variants.filter((v) => v.name === requestedVariant)
  : variants;

if (IS_LINUX) {
  toBuild = toBuild.filter((v) => v.name !== "aero");
  if (toBuild.length === 0 && requestedVariant === "aero") {
    console.error('The "aero" variant is not available on Linux.');
    process.exit(1);
  }
}

if (toBuild.length === 0) {
  console.error(`Unknown variant: "${requestedVariant}". Use "classic" or "aero".`);
  process.exit(1);
}

// Ensure output directory exists
mkdirSync(OUTPUT_DIR, { recursive: true });

for (const variant of toBuild) {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`  Building: ${variant.name} (${variant.productName})`);
  console.log(`${"=".repeat(50)}\n`);

  // Patch tauri.conf.json
  const config = JSON.parse(originalConfig);
  config.productName = variant.productName;
  config.identifier = variant.identifier;
  config.app.windows[0].title = variant.windowTitle;
  config.app.windows[0].transparent = variant.transparent;
  writeFileSync(TAURI_CONF, JSON.stringify(config, null, 2) + "\n");

  try {
    execSync("npm run tauri build", {
      cwd: ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        VITE_APP_VARIANT: variant.env,
      },
    });

    const version = config.version;

    if (IS_LINUX) {
      // Linux: collect .deb and .AppImage from their respective bundle dirs
      const debDir = join(BUNDLE_BASE, "deb");
      const appimageDir = join(BUNDLE_BASE, "appimage");
      let found = false;

      for (const [dir, ext] of [[debDir, ".deb"], [appimageDir, ".AppImage"]]) {
        if (existsSync(dir)) {
          const files = readdirSync(dir).filter((f) => f.endsWith(ext));
          for (const f of files) {
            copyFileSync(join(dir, f), join(OUTPUT_DIR, f));
            console.log(`\n  Installer: ${join(OUTPUT_DIR, f)}`);
            found = true;
          }
        }
      }

      if (!found) {
        console.warn(`\n  WARNING: No .deb or .AppImage found in bundle directory.`);
        console.warn(`  Checked: ${debDir}`);
        console.warn(`  Checked: ${appimageDir}`);
      }
    } else {
      // Windows: NSIS output: {productName}_{version}_x64-setup.exe
      const nsisFilename = `${variant.productName}_${version}_x64-setup.exe`;
      const src = join(BUNDLE_DIR, nsisFilename);

      if (existsSync(src)) {
        const dest = join(OUTPUT_DIR, nsisFilename);
        copyFileSync(src, dest);
        console.log(`\n  Installer: ${dest}`);
      } else {
        console.warn(`\n  WARNING: Expected installer not found at: ${src}`);
        console.warn(`  Checking bundle directory...`);
        const files = readdirSync(BUNDLE_DIR).filter((f) => f.endsWith("-setup.exe"));
        for (const f of files) {
          console.log(`    Found: ${f}`);
          copyFileSync(join(BUNDLE_DIR, f), join(OUTPUT_DIR, f));
        }
      }
    }
  } finally {
    // Always restore the original config
    writeFileSync(TAURI_CONF, originalConfig);
  }
}

console.log(`\n${"=".repeat(50)}`);
console.log(`  All done! Installers in: ${OUTPUT_DIR}`);
console.log(`${"=".repeat(50)}\n`);
