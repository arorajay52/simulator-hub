# Product Context

## App Overview
- **Name**: Gravity Plucks — Satisfying Bouncing Ball Physics Simulator
- **Purpose**: A web-based visual and auditory simulator demonstrating elastic ball collisions within concentric rotating rings. Integrates a seed search solver to find custom durations, sound oscillators, visual particles, and a native MediaRecorder video exporter.
- **Platform**: Web (Desktop & Mobile browsers).
- **Hosting**: GitHub Pages (`arorajay52.github.io/simulator-hub/`).

## Tech Stack
- **Engine/Frontend**: HTML5 Canvas, Vanilla ES6 JavaScript, CSS3.
- **Audio Synthesis**: Web Audio API (Triangle + Sine Pluck oscillators, Gain nodes, BiquadFilter low-pass envelopes).
- **Video Capture**: MediaRecorder API with canvas stream capturing both graphic framebuffers and audio outputs.

## Core Features
1. **Dynamic Concentric Rings**: Seeded rings with custom radii, gap segments, and speeds rotating in alternating directions.
2. **Sub-Stepped Physics Solver**: 12 steps per frame physics loop mapping constant-speed bounce trajectories.
3. **Simulation Seed Finder**: A client-side headless solver running ~120 simulations per frame to identify matching escape-time seeds.
4. **Custom HD Recorder**: Direct WebM video download capturing rendering ticks and synth chimes.
5. **Responsive Viewport**: Automatic alignment, drawer controls sheet for mobile devices, and selectable aspect ratios (9:16 vertical for TikTok, 1:1, 16:9).

## Key Files
- `index.html` — Layout structures, settings tabs, and header.
- `style.css` — Variables, animations, responsive sheets.
- `script.js` — Core physics loop, audio synthesis, recording stream manager.
- `.github/workflows/deploy.yml` — Automated deployment pipeline to GitHub Pages.
