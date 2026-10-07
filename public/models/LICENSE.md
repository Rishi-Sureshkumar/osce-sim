# Patient models: sources and licences

| File | Source | Licence |
|---|---|---|
| `patient.glb` (68-year-old man) | Built by `npm run assets:patient` (`scripts/assets/build-patient.ts`) from the MakeHuman 1.x base mesh `hm08` (`makehuman/data/3dobjs/base.obj`), the default skeleton and weights (`makehuman/data/rigs/default.mhskel`, `default_weights.mhw`) and the macro shape targets `{caucasian,african,asian}-male-{old,young}` | CC0 1.0 (MakeHuman assets, see `LICENSE.ASSETS.md` in the MakeHuman repository). Our build output is also CC0. |
| `patient-female.glb` (young adult woman) | Same pipeline, targets `{caucasian,african,asian}-female-young` | CC0 1.0 |

Generated parts (ours, CC0): the skin, eye and gown textures and materials, the gown panels, hair cap and pupil discs, and the reduced 57-bone rig.

Only CC0 or CC-BY assets may be added here. Record each one in this table, and in `docs/ASSETS.md`.
