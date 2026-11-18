# 3D asset credits

| File | Model | Author | Licence | Notes |
|---|---|---|---|---|
| _Legacy Sketchfab models (M2, M235i, M3, M3 Touring, M4, M4 CS VR46, M5 G90, M8, X3 M50, X5 M)_ | removed from the repo 2026-11-11; the files and their credit lines are in git history before commit "remove unused" | see history | see history | not served by the app |
| `../env/studio_small_09_1k.hdr` | [Studio Small 09](https://polyhaven.com/a/studio_small_09) | Poly Haven | CC0 | Studio reflections. |
| `m5_g90.glb` | Prepared package BMW_M5_G90.zip (Drive > 3d cars) | not stated | **Licence not confirmed** | Game-derived per the package READ ME: prototype use only until a licence is in hand. Wheels replaced in the app; paint material `Paint`. |
| `m5_touring_g99.glb` | Prepared package BMW_M5_Touring_G99.zip (Drive > 3d cars) | not stated | **Licence not confirmed** | Game-derived per the package READ ME: prototype use only until a licence is in hand. Wheels replaced in the app; paint material `Paint`. |
| `m4_cs_g82.glb` | Prepared package BMW_M4_CS_G82.zip (Drive > 3d cars) | not stated | **Licence not confirmed** | Game-derived per the package READ ME: prototype use only until a licence is in hand. Wheels replaced in the app; paint material `Paint`. |
| `m2_g87.glb` | Prepared package bmw_m2_cs_g87.glb (Drive > 3d cars) | not stated | **Licence not confirmed** | Game-derived per the package READ ME: prototype use only until a licence is in hand. Wheels replaced in the app; paint material `Paint`. |

| _(no file: frames only)_ `../renders/ix3_m60/` | [BMW iX3 M60 2027](https://www.blendkit.com/asset-gallery-detail/e1fa17a8-122c-4ec3-93e7-1e30e106cb0d/) (Blendkit asset base `f822dd79-2e65-43f5-a787-f08ad9a8344e`) | Zifir3D Fedorov | Blendkit **Royalty Free** (paid plan, the owner's account) | The licence forbids assets that are directly extractable from the distribution, so the GLB is **never** served: only Cycles frames and per-view depth images, rendered at build time from a private copy (`docs/ADD_PREPARED_CAR.md`, "Frames-only cars"). Wheels replaced in the app; number plates replaced by the engine's. Open questions for the owner: real-car trademarks, and whether the right to use the renders outlasts the subscription. |
| _(no file: frames only)_ `../renders/m3_g80/` | [BMW M3 Sedan 2025](https://www.blendkit.com/asset-gallery-detail/55e4fc40-73ee-4723-8365-486c6260c87e/) (Blendkit asset base `2af75b3c-2cb7-4eec-8729-3eea3bdaff8e`) | Zifir3D Fedorov | Blendkit **Royalty Free** (paid plan, the owner's account) | Frames-only, as the iX3 M60 above. The carbon roof's weave maps are missing from the download, so the roof renders as plain dark gloss. Same open licence questions. |
| _(no file: frames only)_ `../renders/m3_touring_g81/` | [BMW M3 Touring 2025](https://www.blendkit.com/asset-gallery-detail/23f46f0d-c60c-4f0f-ba36-6e2e5dadba71/) (Blendkit asset base `5ce1d020-8df5-4281-929b-6ab6768c5c94`) | Zifir3D Fedorov | Blendkit **Royalty Free** (paid plan, the owner's account) | Frames-only, as the iX3 M60 above. Scaled 0.9% up in the export to the real car's length. Same open licence questions. |
| _(no file: frames only)_ `../renders/x1_u11/` | [BMW X1 M Sportpaket](https://www.blendkit.com/asset-gallery-detail/6ec0fdde-711f-43e9-bbd0-dd6b71559bc6/) (Blendkit asset base `0bfe594c-da67-4935-9a1e-9c265a32b6aa`) | Zifir3D Fedorov | Blendkit **Royalty Free** (paid plan, the owner's account) | Frames-only, as the iX3 M60 above. Its axles were merged into one mesh each and its geometry turned 1 degree: prepare_blend.py splits and levels it. Scaled 3.5% down to the real length. Same open licence questions. |
| _(no file: frames only)_ `../renders/x3_g45/` | [Bmw x3 m50 2025](https://www.blendkit.com/asset-gallery-detail/e7ac1bd4-2ba1-4ad7-b2c0-2bc0c96e165e/) (Blendkit asset base `c13d312f-9c9c-4e1c-894b-6fa20d081a7f`) | Zifir3D Fedorov | Blendkit **Royalty Free** (paid plan, the owner's account) | Frames-only, as the iX3 M60 above. Its axles were merged into one mesh each: prepare_blend.py splits them. Scaled 0.8% down to the real length. Same open licence questions. |
| _(no file: frames only)_ `../renders/m3_cs_g80/` | [Bmw m3 cs](https://www.blendkit.com/asset-gallery-detail/33f266c4-0357-4cdc-a7c6-e64b650c0dcc/) (Blendkit asset base `4911851b-ee18-4017-8404-077c98d1f57e`) | Zifir3D Fedorov | Blendkit **Royalty Free** (paid plan, the owner's account) | Frames-only, as the iX3 M60 above. Scaled by the wheelbase, not the length: the source model's splitter blade stands 34 mm proud of the bumper (about 1 mm on the car), so scaled to BMW's 4.795 m the wheelbase would be 0.8% short (2.833 m against BMW's 2.857 m). In the private copy the blade is slid back to lead the nose by 1 mm, and the export uses `len=4.8035` (1.5% down from the download): wheelbase 2.857 m, the model 4.803 m long (8 mm over BMW's). Also in the private copy: the carbon parts (roof, splitter, intakes, mirror caps, boot lip, diffuser) lost the model's weave map (it had exported as a light-grey base colour) and the two bonnet indents, bare carbon on the car, joined them: the roof and the indents are plain dark carbon, the small parts carry a generated 2x2 twill (8 mm repeat, seen in the wheel close-up); in the scene the carbon gets the clear coat the export drops (crisp on the roof and the indents, softer on the small parts); the carbon and the side and rear glass are exported at the model's render subdivision level; the lamp parts got materials the export can carry and lamp names, so the covers render clear, the tail lamps show their lit bar and the daytime running lights glow in the M3 CS's yellow; the two reflex reflectors on the rear bumper, which shared the tail lamps' lit lens, got their own unlit dark red; the red grille contour and M stripes got their own material; and both FORGED plates were moved from the engine's bumper heights to where the model's own plates sat (the rear one on the boot lid between the tail lamps). Same open licence questions. |

All car files were compressed for the web (meshopt geometry, WebP textures up to 2048 px) with gltf-transform.


## Rim models (`rims/`)

The six stocked FORGEDSA designs (`docs/WHEEL_INVENTORY.md`). All seven files were supplied by the
owner from the FORGEDSA website repository (`Forgedwebsite/public/models/wheels/`, whose `README.md`
describes the file format but names no creator) and packed for the configurator with
`scripts/rim3d/pack.mjs` (meshopt; the website's brake caliper and rotor meshes dropped). The files
carry only a glTF-Transform generator tag, no author metadata.

| File | Wheel | Source file | Author | Licence | Notes |
|---|---|---|---|---|---|
| `rims/forged_fsa001.glb` | FSA001 (2-piece), front 19×9.5 | website `stf399-front.glb` | not stated; FORGEDSA's own product design | owner-supplied, confirm creator credit | The website README calls STF399 a prototype; sold as FSA001 per the stock sheet. Brake meshes in the source used assumed G80/G82 dimensions and are dropped. |
| `rims/forged_fsa001-rear.glb` | FSA001 (2-piece), rear 20×11 | website `stf399-rear.glb` | not stated; FORGEDSA's own product design | owner-supplied, confirm creator credit | Rear of the staggered set (`rearModelUrl`). |
| `rims/forged_fsa002.glb` | FSA002 | website `fsa002.glb` | not stated; FORGEDSA's own product design | owner-supplied, confirm creator credit | |
| `rims/forged_fsa_03.glb` | FSA003 | website `fsa003.glb` | not stated; FORGEDSA's own product design | owner-supplied, confirm creator credit | Keeps the older wheel id `forged_fsa_03` so old share codes still open. |
| `rims/forged_fsa004.glb` | FSA004 | website `fsa004.glb` | not stated; FORGEDSA's own product design | owner-supplied, confirm creator credit | |
| `rims/sixnine_ff1.glb` | FF-1 | website `ff-1.glb` | not stated; FORGEDSA's own product design | owner-supplied, confirm creator credit | The `sixnine_` id is historical; confirm with the owner that FF-1 is a FORGEDSA design, not a third-party brand's. |
| `rims/sixnine_ff3.glb` | FF-3 | website `ff-3.glb` | not stated; FORGEDSA's own product design | owner-supplied, confirm creator credit | As FF-1. |

## Rim thumbnails (`../rim-images/*.webp`)

Shown by `RimThumb` on the wheel picker and the rim pages.

| File | Wheel | Source | Licence | Notes |
|---|---|---|---|---|
| `../rim-images/forged_fsa001.webp` | FSA001 | Blender render of `rims/forged_fsa001.glb` (`scripts/rim3d/preview.py`) | owner-supplied (derivative of the owner's rim file) | No website photo existed for STF399/FSA001. |
| `../rim-images/forged_fsa002.webp` | FSA002 | cut-out (rembg) of the owner's product photo from the FORGEDSA website | owner-supplied product photo | |
| `../rim-images/forged_fsa_03.webp` | FSA003 | cut-out (rembg) of the owner's product photo from the FORGEDSA website | owner-supplied product photo | |
| `../rim-images/forged_fsa004.webp` | FSA004 | cut-out (rembg) of the owner's product photo from the FORGEDSA website | owner-supplied product photo | |
| `../rim-images/sixnine_ff1.webp` | FF-1 | cut-out (rembg) of the owner's product photo from the FORGEDSA website | owner-supplied product photo | |
| `../rim-images/sixnine_ff3.webp` | FF-3 | cut-out (rembg) of the owner's product photo from the FORGEDSA website | owner-supplied product photo | |

The in-app credits page (`/credits`, copy in `config/pages.ts`) must be kept in step with this file.
