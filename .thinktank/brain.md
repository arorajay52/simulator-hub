# Brain — Persistent Knowledge Base

## Major Decisions
- **2026-06-22**: Transitioned from Pygame/Python to Web HTML5 canvas, making the simulator run client-side in the browser and fully responsive across both mobile and desktop screens.
- **2026-06-22**: Built a Web Audio API synth pluck module to eliminate external asset dependencies and ensure lag-free audio playbacks.
- **2026-06-22**: Decoupled the rendering physics engine from the simulation solver by introducing a separate headless `solverPhysics` engine, saving significant CPU resources and preventing canvas flickering.
- **2026-06-22**: Implemented a deterministic seeded bounce angle formula using the LCG SeededRNG (`this.rng.next()`) in both the solver and rendering physics loops, ensuring 100% path determinism.
- **2026-06-22**: Configured MediaRecorder inside the canvas stream to compose both visual frames and AudioNode outputs into download-ready WebM exports.
- **2026-06-22**: Split the code into `index.html`, `style.css`, and `script.js` to ensure clean separation of concerns and allow seamless deploy to GitHub Pages.
- **2026-06-23**: Refactored the physics architecture into an extensible base `Workspace` pattern (`BaseWorkspace` & `ConcentricRingsWorkspace`), enabling easy integration of new physical environments (e.g. Pachinko grids, rectangular mazes).
- **2026-06-23**: Integrated global keyboard shortcuts (Space, R, S, Arrow Up/Down) to control playback, reset, finder, and velocity speed limits.
- **2026-06-23**: Expanded canvas limits to prevent viewport confinement, providing a larger, centered simulator presence on both mobile and desktop screens.
- **2026-06-23**: Redesigned video recording to trigger immediately upon seed selection, restarting cleanly from 0s and enabling direct Stop & Download manual control.
- **2026-06-23**: Implemented play/pause canvas helper overlays and a dedicated "🎲 Random" seed generator in the HUD controls.

## User Preferences
- Desktop and Mobile responsive screens.
- Clean canvas viewport with glassmorphic overlay HUD.
- Exact seed simulation finder (e.g. find seeds with 30s escape duration).
- High definition video export matching TikTok/Reels aspect ratios (9:16 vertical, 1:1 square, 16:9 landscape).

## Error Registry

### Mobile Audio Context State — 2026-06-22
- **Symptom**: Synthesizer audio plucks blocked on mobile/safari browsers.
- **Root Cause**: Browsers block AudioContext state instantiation before an explicit user action/gesture.
- **Fix**: Added a clean glassmorphism prompt asking the user to press an "Enable Sound" button which resumes/initializes the AudioContext correctly.
- **File**: `index.html`, `script.js`

### Solver Rendering Glitch & CPU Load — 2026-06-22
- **Symptom**: Rendering glitches (canvas flickering/jumping) and high CPU overhead while the finder is searching for seeds.
- **Root Cause**: The finder was running `testSeed()` on the active rendering engine instance, resetting its rings and ball state 120 times per frame.
- **Fix**: Introduced a dedicated helper `solverPhysics` engine running headlessly to offload finder runs completely from the renderer.
- **File**: `script.js`

### Path Discrepancy & Solver Mismatch — 2026-06-22
- **Symptom**: The finder reports a matching seed but playing that seed back results in a completely different escape duration.
- **Root Cause**: The active rendering engine's update loop was using `Math.random()` to generate collision spread angles, making trajectory paths non-deterministic.
- **Fix**: Replaced `Math.random()` with `this.rng.next()` in all bounce calculations to match the headless solver.
- **File**: `script.js`

### Ball Sticky Collisions — 2026-06-22
- **Symptom**: The ball gets stuck on or passes through ring edges during high-velocity collisions.
- **Root Cause**: Successive sub-steps trigger collisions because the ball is still overlapping the ring region, even if its velocity is already pointing away from the normal.
- **Fix**: Implemented a relative velocity check (`vr`) so the ball only triggers a bounce if it is moving towards the barrier boundary.
- **File**: `script.js`

### Ball Tunneling — 2026-06-22
- **Symptom**: Ball sinks into or passes through the rotating ring walls during high speed bounces.
- **Root Cause**: High frame duration (`dt`) updates the ball position in a single leap, skipping collision boundaries.
- **Fix**: Implemented sub-stepping (12 micro-updates of physics per tick).
- **File**: `script.js`
