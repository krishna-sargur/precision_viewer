"""
generate_atlas_data.py
Exports two files to RAVE_Reconstructions/atlas/:
  - lh_pial.bin / rh_pial.bin   compact binary brain meshes (fsaverage, MNI305 space)
  - electrode_mni152.json        per-subject MNI152 electrode XYZ coordinates

Run once (and re-run whenever new subjects are added):
  python3 /opt/precision_viewer/scripts/generate_atlas_data.py
"""

import struct, os, glob, csv, json
import numpy as np

LEADDBS_FS = "/vol/brains/raid/leaddbs/ext_libs/surfice/fs"
RAVE_DATA  = "/bdz/restorelab/RAVE_Reconstructions/RAVEData/YAEL"
OUT_DIR    = "/bdz/restorelab/RAVE_Reconstructions/atlas"

os.makedirs(OUT_DIR, exist_ok=True)


def read_fs_surface(path):
    with open(path, "rb") as f:
        magic = struct.unpack(">3B", f.read(3))
        assert magic == (255, 255, 254), f"Unexpected magic bytes: {magic}"
        f.readline()   # creation date
        f.readline()   # comment
        n_verts, n_faces = struct.unpack(">2I", f.read(8))
        verts = np.frombuffer(f.read(n_verts * 3 * 4), dtype=">f4").astype(np.float32).reshape(n_verts, 3)
        faces = np.frombuffer(f.read(n_faces * 3 * 4), dtype=">i4").astype(np.uint32).reshape(n_faces, 3)
    return verts, faces


def write_bin_mesh(verts, faces, path):
    """
    Binary format (little-endian):
      uint32  n_verts
      uint32  n_faces
      float32 verts[n_verts * 3]   (x, y, z interleaved)
      uint32  faces[n_faces * 3]   (i0, i1, i2 interleaved)
    """
    with open(path, "wb") as f:
        f.write(struct.pack("<II", len(verts), len(faces)))
        f.write(verts.astype("<f4").tobytes())
        f.write(faces.astype("<u4").tobytes())


# --- Brain meshes -----------------------------------------------------------
for hemi in ("lh", "rh"):
    src = os.path.join(LEADDBS_FS, f"{hemi}.pial")
    dst = os.path.join(OUT_DIR, f"{hemi}_pial.bin")
    verts, faces = read_fs_surface(src)
    write_bin_mesh(verts, faces, dst)
    size_mb = os.path.getsize(dst) / 1e6
    print(f"{hemi}.pial → {dst}  ({len(verts):,} verts, {len(faces):,} faces, {size_mb:.1f} MB)")


# --- Electrode coordinates --------------------------------------------------
electrodes = {}
pattern = os.path.join(RAVE_DATA, "*/rave/meta/electrodes_surf_interp_07.csv")
csv_files = sorted(glob.glob(pattern))

if not csv_files:
    print(f"WARNING: no electrode CSVs found matching {pattern}")

for csv_path in csv_files:
    with open(csv_path, newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            subj = (row.get("SubjectCode") or "").strip().strip('"')
            if not subj:
                continue
            try:
                x = float(row["MNI152_x"])
                y = float(row["MNI152_y"])
                z = float(row["MNI152_z"])
                if any(v != v for v in (x, y, z)):   # NaN check
                    continue
                electrodes.setdefault(subj, []).append(
                    [round(x, 3), round(y, 3), round(z, 3)]
                )
            except (KeyError, ValueError):
                continue

out_json = os.path.join(OUT_DIR, "electrode_mni152.json")
with open(out_json, "w") as fh:
    json.dump(electrodes, fh, separators=(",", ":"))

print(f"\nElectrode JSON → {out_json}")
for subj, pts in sorted(electrodes.items()):
    print(f"  {subj}: {len(pts)} electrodes")
