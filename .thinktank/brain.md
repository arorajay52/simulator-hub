# Brain — Persistent Knowledge Base

## Major Decisions
- **2026-06-22**: Transitioned from Pygame/Python to Web HTML5 canvas, making the simulator run client-side in the browser and fully responsive across both mobile and desktop screens.
- **2026-06-22**: Built a Web Audio API synth pluck module to eliminate external asset dependencies and ensure lag-free audio playbacks.
- **2026-06-22**: Implemented a headless fast-forward simulation solver running up to 120 seeds per frame to find exact escape seeds in milliseconds.
- **2026-06-22**: Configured MediaRecorder inside the canvas stream to compose both visual frames and AudioNode outputs into download-ready WebM exports.
- **2026-06-22**: Split the code into `index.html`, `style.css`, and `script.js` to ensure clean separation of concerns and allow seamless deploy to GitHub Pages.

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

### Ball Tunneling — 2026-06-22
- **Symptom**: Ball sinks into or passes through the rotating ring walls during high speed bounces.
- **Root Cause**: High frame duration (`dt`) updates the ball position in a single leap, skipping collision boundaries.
- **Fix**: Implemented sub-stepping (12 micro-updates of physics per tick).
- **File**: `script.js`
