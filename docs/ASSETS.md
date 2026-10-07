# 3D assets

## Patient model
- **Built, not downloaded at runtime.** `npm run assets:patient` fetches the MakeHuman CC0 sources once into `.cache/makehuman` (git-ignored). It writes:
  - `public/models/patient.glb`;
  - `public/models/patient-female.glb`;
  - `src/scene/patientRig.generated.ts` (rig, skin landmarks and projected exam anchors).
- **Spec the runtime expects** (any replacement GLB must match):
  - **Frame:** metres, +Y up, the patient faces +Z, and the patient's left is +X. The origin is at the root joint (pelvis centre).
  - **Skinning:** skinned meshes named `skin` (the body; raycast target), `eyes`, `mouth`, `hair`, `pupils`, and gown panels `gown_chest`, `gown_abdomen`, `gown_back` (the drape system fades these per zone).
  - **Bones:** identity rest rotation, with names as in `patientRig.generated.ts`:
    - spine: `root`, `spine05`…`spine01`;
    - neck and head: `neck01`…`neck03`, `head`, `jaw`;
    - eyes and lids: `eye_L/R`, `orbicularis03_L/R` (upper lid), `orbicularis04_L/R` (lower lid), `pupil_L/R` (scaled by the penlight);
    - arms: `clavicle_*`, `shoulder01_*`, `upperarm01/02_*`, `lowerarm01/02_*`, `wrist_*`, `finger1-1…finger5-1_*`;
    - legs: `pelvis_*`, `upperleg01/02_*`, `lowerleg01/02_*`, `foot_*`, `toe1-1_*`.
  - **Visible landmarks** on the mesh: sternal notch, clavicles, nipples, costal margins, umbilicus, iliac crests, scapulae and spine, ears, eyes with pupils, jaw, knuckles, feet and toes.
  - **Budget:** 30–80k triangles, meshopt geometry, WebP textures (KTX2 needs `toktx`, which isn't installed in the build container).
- **Current build:**
  - 31.4k triangles and 57 bones;
  - about 0.42 MB per variant;
  - 1024² skin texture painted in UV space from 3D landmarks (areolae, umbilicus, lips, brows, tone variation).
- **Anchors** are defined clinically (landmark + offset in cm + tolerance in cm) in `src/exam3d/anchorDefs.ts` and projected onto the skin by the build. Re-run the build after editing them.

## Room props
- **Procedural.** Poly Haven, Kenney and Quaternius are not reachable from the build container, so every prop is a simple, clean model in code:
  - `src/scene/room/ExamRoom.tsx`: corridor, door with placard, sink, exam table with an adjustable head section, stool, chair, wall computer, curtain, wastebasket;
  - `src/scene/room/Dispenser.tsx`: the sanitiser;
  - `src/scene/room/ToolTable.tsx`: stethoscope, reflex hammer, 128/512 Hz forks, penlight, otoscope/ophthalmoscope, cotton swabs, BP cuff.
- **Replacing with GLBs.** Each prop is one component with a stable `name` (e.g. `door`, `sanitiser-dispenser`, `tool:stethoscope`, `table-head-control`, `stool`). A CC0 GLB can replace a component's meshes if it keeps the name and roughly the same footprint. Record each replacement here and in `public/models/LICENSE.md`.

| Prop | Now | Suggested CC0 replacement |
|---|---|---|
| Exam table | procedural, adjustable head section | Poly Haven / Kenney medical bed (needs a hinged head section) |
| Sink, sanitiser | procedural | Kenney furniture kit sink; any CC0 wall dispenser |
| Tool trolley and instruments | procedural | Quaternius / Poly Haven medical props |
| Stool, chair, curtain, computer, wastebasket | procedural | Kenney furniture kit |

## Performance
- **Budget:** initial download ≤ 15 MB. The e2e size check sums the JS chunks and `/models`.
- **Quality setting:** "Graphics: High/Low" in the station header. Low sets dpr 1 and turns off shadows and antialiasing. It defaults to Low on iPad and phones.
- **FPS:** `?fps` on the station URL shows a frame-rate readout. An iPad measurement is a manual check.

## Language model files (Phase 4)

Vendored into `public/lang/` by `npm run lang:vendor` (git-ignored; runs on install, test and build).

| Files | Source | Licence | Notes |
|---|---|---|---|
| `public/lang/models/Xenova/all-MiniLM-L6-v2/` (q8 ONNX + tokenizer, ~23 MB) | sentence-transformers/all-MiniLM-L6-v2, ONNX export by Xenova, taken from the npm package `@ryanstark24/sfgraph-models@1.1.3` because huggingface.co is not reachable from the build environment | Apache-2.0 | sha256 pinned in `scripts/lang/vendor.ts`, plus a functional ordering check. The upstream hash could not be verified here (open question in `docs/PLAN-phase4.md`) |
| `public/lang/ort/` | onnxruntime-web (Microsoft), from `node_modules` | MIT | wasm runtime for the browser |
| server inference | `@huggingface/transformers` 4.3.1 + `onnxruntime-node` | Apache-2.0 / MIT | `serverExternalPackages` in `next.config.ts` |
| optional "Enhanced patient" | `@mlc-ai/web-llm` 0.2.85 (Apache-2.0) loading `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` (Apache-2.0, ~945 MB) from the MLC CDN | Apache-2.0 | off by default; WebGPU only; display-only rewording behind a faithfulness guard |

The embedding model turns text into vectors so a student's words can be compared with a case's example
questions and the mark sheets' example sentences. It never generates text, facts or scores.
`npm run lang:embed` precomputes the case and bank phrase vectors into `src/lang/generated/` (int8, committed).
