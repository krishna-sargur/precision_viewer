#!/usr/bin/env node
// Runs before `next build` to copy RAVE HTML files and precision recordings
// into public/ so they are served as static assets in the out/ export.
const fs   = require("fs");
const path = require("path");

const RAVE_DIR       = "/vol/brains/bd1/restorelab/RAVE_Reconstructions";
const PRECISION_JSON = "/vol/brains/bd1/restorelab/Precision_Data/precision_list.json";
const PUBLIC         = path.join(__dirname, "..", "public");

// --- RAVE files ---
const raveOut = path.join(PUBLIC, "rave");
if (fs.existsSync(RAVE_DIR)) {
  fs.mkdirSync(raveOut, { recursive: true });
  const files = fs.readdirSync(RAVE_DIR).filter((f) => /\.(html|htm)$/i.test(f));
  for (const file of files) {
    fs.copyFileSync(path.join(RAVE_DIR, file), path.join(raveOut, file));
  }
  fs.writeFileSync(
    path.join(PUBLIC, "rave_manifest.json"),
    JSON.stringify({ available: true, files })
  );
  console.log(`[bake] Copied ${files.length} RAVE file(s) → public/rave/`);
} else {
  fs.writeFileSync(
    path.join(PUBLIC, "rave_manifest.json"),
    JSON.stringify({ available: false, files: [] })
  );
  console.log("[bake] RAVE directory not found — skipping");
}

// --- Atlas files (brain mesh + electrode coordinates) ---
const ATLAS_SRC = path.join(RAVE_DIR, "atlas");
const atlasOut  = path.join(PUBLIC, "atlas");
if (fs.existsSync(ATLAS_SRC)) {
  fs.mkdirSync(atlasOut, { recursive: true });
  const files = fs.readdirSync(ATLAS_SRC);
  for (const file of files) {
    fs.copyFileSync(path.join(ATLAS_SRC, file), path.join(atlasOut, file));
  }
  console.log(`[bake] Copied ${files.length} atlas file(s) → public/atlas/`);
} else {
  console.log("[bake] Atlas directory not found — skipping");
}

// --- Precision recordings ---
if (fs.existsSync(PRECISION_JSON)) {
  const json = JSON.parse(fs.readFileSync(PRECISION_JSON, "utf-8"));
  const recordings = {};
  for (const ptField of Object.keys(json)) {
    const ptNum = String(ptField).replace(/[^0-9]/g, "");
    if (!ptNum) continue;
    const recs = json[ptField]?.recordings;
    if (!recs || typeof recs !== "object") continue;
    recordings[ptNum] = Object.values(recs).filter((v) => typeof v === "string");
  }
  fs.writeFileSync(
    path.join(PUBLIC, "precision_recordings.json"),
    JSON.stringify({ available: true, recordings })
  );
  console.log("[bake] Wrote precision_recordings.json");
} else {
  fs.writeFileSync(
    path.join(PUBLIC, "precision_recordings.json"),
    JSON.stringify({ available: false, recordings: {} })
  );
  console.log("[bake] precision_list.json not found — skipping");
}
