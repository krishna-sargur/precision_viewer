# Precision Viewer

A Next.js dashboard for the Pesaran Lab's Precision BCI patient cohort. Displays pipeline status, RAVE reconstructions, precision recordings, and a multi-patient 3D electrode atlas.

---

## Deploying to Cortex (128.91.19.199:8443)

The site is served as a static export by Apache from `/opt/precision_viewer/out/`. There is no running Node server — every deploy is a full rebuild.

### One-liner deploy (run on cortex as `krishna`)

```bash
cd /opt/precision_viewer && git push origin main
```

Then SSH into cortex and run:

```bash
cd /opt/precision_viewer && \
  git fetch origin && git reset --hard origin/main && \
  sed -i -E '/basePath:|assetPrefix:|output:/d' next.config.ts && \
  sed -i 's/const nextConfig: NextConfig = {/const nextConfig: NextConfig = {\n  output: "export",/' next.config.ts && \
  mv app/api /tmp/precision_api_backup && \
  npm ci && npm run build && \
  mv /tmp/precision_api_backup app/api && \
  sed -i '/output: "export"/d' next.config.ts && \
  chmod -R o+rX out/ && \
  echo "Done"
```

### What each step does

| Step | Why |
|------|-----|
| `git reset --hard origin/main` | Pull latest code from GitHub |
| `sed -i ... output: "export"` | Temporarily inject static-export mode into `next.config.ts` (not kept in git so API routes work in dev) |
| `mv app/api /tmp/...` | Remove API route directory — Next.js static export fails if any API routes exist |
| `npm ci && npm run build` | `npm run build` runs `scripts/bake-static-data.js` first (copies RAVE files, atlas, precision recordings from `/vol/brains/`) then calls `next build` which outputs to `out/` |
| `mv /tmp/... app/api` | Restore API routes for future dev use |
| `sed -i ... output: "export"` (second) | Remove the injected export line so `next.config.ts` stays clean in git |
| `chmod -R o+rX out/` | Make `out/` readable by Apache (`www-data`) |

### Notes

- **No sudo needed.** Krishna does not have sudo access; Apache is already configured to serve from `/opt/precision_viewer/out/`.
- **Atlas data** is baked automatically at build time from `/vol/brains/bd1/restorelab/RAVE_Reconstructions/atlas/`. If you add new patients, re-run `python3 scripts/generate_atlas_data.py` on cortex first, then redeploy.
- **RAVE files** are copied from `/vol/brains/bd1/restorelab/RAVE_Reconstructions/` at build time.
- **Precision recordings** are read from `/vol/brains/bd1/restorelab/Precision_Data/precision_list.json` at build time.
- **Patient spreadsheet** lives at `public/patient_control_sheet.xlsx` — edit and push to GitHub, then redeploy.

---

## Local development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). API routes (`app/api/`) work in dev mode; they are stripped for the static build.

---

## Regenerating atlas data (add new patients)

Run once on cortex after new RAVE/YAEL data is available:

```bash
python3 /opt/precision_viewer/scripts/generate_atlas_data.py
```

Then redeploy using the one-liner above.
