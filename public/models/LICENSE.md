# 3D patient model

**No model file is bundled yet.** The app renders a stylised primitive mannequin
(`src/exam3d/Mannequin.tsx`) built from capsules and spheres.

## Adding a real model
- **License:** CC0 or CC-BY only. Record the source URL, author, license and any required
  attribution below before committing the file.
- **File:** `public/models/patient.glb` (glTF binary). Keep it under ~5 MB for iPad performance.
- **Integration:** swap the meshes in `Mannequin.tsx` (`UpperBody` / `LowerBody`) for the model.
  A rigged model should bend at the hips so the upper body follows the backrest angle (bone names are
  listed per anchor in `src/exam3d/regionAnchors.ts`). Do **not** change region ids: move the anchor
  points onto the model's surface instead, and run `npm test` (anchor coverage and pose tests).

## Attribution
| File | Source | Author | License |
|---|---|---|---|
| — | — | — | — |
