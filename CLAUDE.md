# Pastel Village — Living Ecosystem Web Sandbox

Project context for Claude Code. Read this fully before doing any work in this repo.

## What this project is

A small "alive" 3D village that runs entirely in the browser: NPCs with homes/jobs/
schedules, day/night cycle, weather, and a zombie-infection sandbox experiment.
Static-hosted on GitHub Pages (no backend). Mobile-first for iPhone/iPad, also
playable on desktop.

- **Live URL:** https://icelolan-ai.github.io/-pastel-village/
- **Repo:** https://github.com/icelolan-ai/-pastel-village (branch `main`)

## Non-negotiable rules (apply to every phase)

1. **Static-first.** Everything must run from GitHub Pages with no dedicated backend
   server. If something needs a backend eventually, it must be an optional service
   that the MVP does not depend on.
2. **Simulation ≠ Rendering.** Keep simulation state (plain data) separate from
   Three.js render objects. Render reads from sim state; it never writes back.
3. **Free/OSS only.** No paid AI, paid asset generators, paid backend, or paid
   runtime services. Any external asset's license must be logged in
   `ASSET_LICENSES.md` before it's merged to `main`.
4. **Art direction:** cute, pastel, organic, rounded, toy-diorama 3D. Never
   Minecraft-like/blocky, never flat 2D, never primitive-looking as *final* visuals
   (primitives are fine as a technical base early on, per Phase 1-2).
5. **Camera:** fixed low/medium isometric 3/4 perspective. No free-rotate in the
   MVP — only pan + zoom (touch and mouse).
6. **Mobile-first:** designed for iPhone/iPad from the start, not shrunk down from
   desktop. Cap `devicePixelRatio` at 2, handle WebGL context loss, use
   `100dvh`/`100svh` and `env(safe-area-inset-*)`, `touch-action: none` on canvas.
7. **Village layout is organic, not a rigid grid** — roads curve, branch, and
   connect; zones are irregular polygons, not neat rectangles.
8. **Simulation LOD** matters once NPCs exist: NEAR (full tick), MEDIUM (reduced),
   FAR (interpolate only, no AI). Population targets: 10-1000.
9. **Every phase must build clean, deploy clean, and pass a regression check**
   against everything shipped in prior phases (see each phase's Acceptance
   Criteria) before it's reported as done.

## Tech stack (fixed — don't introduce alternatives without discussion)

TypeScript, Three.js (WebGL2), Vite (`base: '/-pastel-village/'` — must match the
repo name including the leading hyphen), vanilla HTML/CSS for UI (no framework),
IndexedDB via `idb` for saves (not used yet), Vitest (unit) + Playwright (E2E,
incl. iPhone 13 / iPad viewport emulation), GitHub Actions → GitHub Pages
(deploy from Actions, not a `gh-pages` branch).

## Workflow

- **Zip upload = project revision.** If the user uploads a `.zip` file in chat,
  treat it as a revised version of this project, regardless of file type or
  content. Extract it, and for every path contained in the zip, delete the
  existing file/folder at that path in the repo and replace it with the
  extracted version. Do **not** delete any repo file/folder whose path is not
  present in the zip. This applies no matter what phase is in progress or what
  the zip contains.
  - Safety net that still applies (does not require asking first, but is not
    skipped): run `npm run build` (and `npm run test:e2e` if available) after
    replacing files, per the rule below; if the build breaks, report exactly
    what failed instead of pushing broken code. Never commit files that look
    like secrets/credentials without flagging it first. Follow the normal git
    commit/push flow below — nothing here authorizes force-pushes, history
    rewrites, or skipping `git status` checks.
  - This rule itself is not a file inside any given zip's contents to drop:
    if an uploaded zip's own `CLAUDE.md` doesn't carry this rule (e.g. it was
    packaged before this rule existed), keep this block when adopting the
    rest of that `CLAUDE.md`, so the policy survives future uploads.
- **Commit and push directly with `git`.** Do not upload files through the GitHub
  web UI — a prior attempt at that silently dropped the `.github/` folder because
  browsers/OS treat dot-folders as hidden, which broke the deploy pipeline. Always
  verify `git status` is clean before starting, and that `.github/workflows/deploy.yml`
  is actually present in the working tree before pushing.
- **Build and test locally before pushing:** `npm run build` must succeed with no
  errors; run `npm run test:e2e` if Playwright browsers are available locally.
- Report phase completion back in the planning chat ("Chat A") with: what was
  built, files changed, test results against that phase's Acceptance Criteria,
  known issues, and anything that deviates from the Build Specification.
- Don't start work on a phase beyond the one currently specified below.

## Project status

- **Phase 0 — Master Blueprint:** `APPROVED`
- **Phase 1 — GitHub + Web Foundation:** `APPROVED` / live. Ground plane, pastel
  sky dome, one directional + hemisphere light, one placeholder pastel sphere,
  pan/zoom camera controls, FPS-only debug overlay, GitHub Actions deploy
  pipeline. Inline SVG favicon added post-launch to eliminate a `favicon.ico` 404.
- **Phase 2 — 3D Village Foundation:** built, tested locally (20 Vitest unit
  tests passing, `npm run build` clean), pending push + live verification.
  Added `World` scene hierarchy (9 named groups), an organic non-circular
  terrain sized to always cover the road graph + zones, a road graph (data +
  debug line rendering), 5 zone types (debug colored patches, toggle with R/Z
  keys), and camera pan bounds now derived from the real terrain footprint
  instead of Phase 1's hardcoded ±30. Full spec below for reference.
- **Phase 3 onward:** not started.

---

# BUILD SPECIFICATION — PHASE 2: 3D VILLAGE FOUNDATION

**สถานะ:** `PLANNED`
**อ้างอิง:** PHASE_0_MASTER_BLUEPRINT.md (Section 6-11), ต่อยอดจาก Phase 1 (`APPROVED`)

## เป้าหมาย Phase นี้

Phase 1 พิสูจน์ว่า Pipeline ทำงาน (Render/Deploy/Controls) แต่ Scene ยังเป็น Ground
วงกลมเปล่า ๆ + ลูกบอล 1 ลูก

**Phase 2 คือการวาง "โครงกระดูก" ของหมู่บ้าน** — สร้างระบบ Data Structure และ Scene
Hierarchy ที่ Phase 3 (Buildings+Roads+Nature+Objects) จะเอา Asset จริงมาเสียบใส่
ทีหลัง **ยังไม่ใส่ Asset ภายนอกใด ๆ ในเฟสนี้**

พูดง่าย ๆ: Phase นี้ทำให้หมู่บ้าน "มีผังจริง" (ถนน โซนต่าง ๆ ขอบเขตพื้นที่) แต่ยังเป็น
Placeholder Geometry เหมือนเดิม ไม่ใช่โมเดลอาคาร/ต้นไม้จริง

## Scope (อยู่ในขอบเขต)

1. **World Scene Hierarchy** — จัดโครง Scene ใหม่: `World > { Terrain, Roads,
   Buildings, Nature, Props, NPCs, Zombies, SkyDome, Lights }` (กลุ่มที่ยังไม่มี
   เนื้อหาให้เป็น Empty `THREE.Group` รอ Phase หลังเติม)
2. **Terrain** — เปลี่ยนจาก Ground วงกลมสมบูรณ์แบบของ Phase 1 เป็นรูปทรงหมู่บ้านที่
   ดูเป็นธรรมชาติมากขึ้น (ไม่ต้องมี Height variation ยัง — แค่ Outline ไม่กลม
   สมบูรณ์แบบ) ขนาดใหญ่พอครอบคลุม Road graph + Zone ทั้งหมด
3. **Road Graph (Data + Debug Render)** — ระบบ Data ถนนแบบ Node/Edge ตาม Interface
   ด้านล่าง พร้อม Debug visualization (เส้นบาง ๆ) — **ยังไม่ใช่ Road Mesh จริงแบบ
   Modular** (นั่นคือ Phase 3)
4. **Zones** — พื้นที่ Residential/Shop/Park/Village-Center/Nature-buffer เป็น
   Data รูปหลายเหลี่ยม พร้อม Debug overlay สีบนพื้น (Toggle เปิด-ปิดได้)
5. **Camera Pan Bounds** — คำนวณจากขอบเขต Terrain จริง แทนค่า Hardcode
   `panBounds: 30` ของ Phase 1
6. **Debug Overlay เพิ่มเติม** — ปุ่ม/คีย์ Toggle "Show Road Graph" และ "Show Zones"
   (Dev only)

## Out of Scope (ห้ามทำใน Phase นี้)

- โมเดลอาคาร/ถนน/ต้นไม้จริง หรือ Asset จาก Kenney/Quaternius ใด ๆ (Phase 3)
- NPC, Navigation, Population (Phase 5-6)
- Time of Day / Weather (Phase 4)
- Zombie/Infection (Phase 7-8)

## Reference Village Layout (จุดเริ่มต้น — ปรับตัวเลขได้ แต่ต้อง "ไม่เป็น Grid แข็ง")

```
Village Center (0, 0)
  └─ Main Loop Road: วงรีไม่สมมาตร ~รัศมี 14-18 หน่วย รอบศูนย์กลาง (6 nodes)
       ├─ แยกแขนงไปทาง Shop Zone (ทิศตะวันออก)
       ├─ แยกแขนงไปทาง Park Zone (ทิศเหนือ)
       ├─ แยกแขนงไปทาง Residential Zone A (ทิศตะวันตกเฉียงใต้)
       └─ แยกแขนงไปทาง Residential Zone B (ทิศตะวันตกเฉียงเหนือ)
  └─ Nature-buffer Zone: วงแหวนรอบนอกสุด ก่อนถึงขอบ Terrain
```

## Data Interfaces (บังคับใช้ Shape นี้)

```typescript
export interface RoadNode {
  id: string;
  position: [x: number, z: number];
}

export interface RoadEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  // ควบคุมความโค้ง — ใส่ไว้เพื่อให้ถนนไม่ตรงเป๊ะทุกเส้น
  controlPoints?: [x: number, z: number][];
  width: number; // เมตร ไว้ให้ Phase 3 ใช้ต่อตอน Generate Road Mesh จริง
}

export interface Zone {
  id: string;
  type: 'residential' | 'shop' | 'park' | 'village-center' | 'nature-buffer';
  polygon: [x: number, z: number][]; // simple polygon, ห้าม self-intersect
  debugColor: string; // hex — ใช้แสดงตอนเปิด Debug overlay เท่านั้น
}
```

## Deliverable File Structure (ต่อยอดจาก Phase 1)

```
src/
├── core/
│   └── main.ts                        (แก้ให้ประกอบ World hierarchy แทนการ add ตรงๆ)
├── world/
│   ├── WorldBundle.ts                 (สร้าง Group ทั้ง 9 ตาม Section 6)
│   ├── villageData.ts                 (Hardcode RoadNode/RoadEdge/Zone ชุดเริ่มต้น)
│   ├── road/
│   │   ├── RoadGraph.ts               (โหลด/query ข้อมูลถนนจาก villageData)
│   │   └── RoadGraphDebugRenderer.ts  (วาดเส้นบางตาม Edge/controlPoints)
│   └── ZoneDebugRenderer.ts           (วาดพื้นสีโปร่งแสงตาม Zone.polygon)
├── rendering/
│   └── SceneSetup.ts                  (แก้ Terrain ให้ไม่กลมสมบูรณ์แบบ, ครอบคลุม Village)
├── camera/
│   └── CameraController.ts            (แก้ panBounds ให้รับค่าจาก Terrain extents)
└── debug/
    └── DebugOverlay.ts                (เพิ่ม Toggle Road Graph / Zones)
```

## Acceptance Criteria

1. Scene hierarchy มีครบ 9 Group (ตรวจผ่าน Console: `scene.getObjectByName('Terrain')` ฯลฯ ต้องไม่เป็น `undefined`)
2. Road graph render เป็นเส้น Loop ไม่สมมาตร + แขนงแยก อย่างน้อย 4 เส้น — ต้องดู "ไม่ใช่ Grid" ด้วยตา
3. Zone Debug overlay Toggle เปิด/ปิดได้จริง เห็นสีพื้นแยก 4 ประเภทขึ้นไปเมื่อเปิด
4. Terrain ไม่ใช่วงกลมสมบูรณ์แบบเหมือน Phase 1 อีกต่อไป และครอบคลุม Road graph + Zone ทั้งหมดโดยไม่มีส่วนไหนล้นขอบ
5. Pan ด้วยเมาส์/นิ้ว หยุดที่ขอบ Terrain ใหม่ (ไม่ใช่ ±30 แบบเดิม)
6. **Regression Phase 1:** Build ผ่าน, Deploy ผ่าน, Refresh ไม่พัง, Zoom ยังทำงานปกติ, ไม่มี Asset 404 ใหม่
7. `ASSET_LICENSES.md` ยังว่างเหมือนเดิม
8. ไม่มี Console error จากโค้ดของเราเอง (Error จาก Browser extension ของผู้ใช้เองไม่นับ)

## เมื่อทำเสร็จ

กลับไปรายงาน READY FOR REVIEW ที่ chat วางแผน (Chat A) พร้อมผลตรวจ 8 ข้อด้านบน —
อย่า Approve ตัวเอง และอย่าเริ่ม Phase 3 ต่อจนกว่าจะได้รับการ Approve
