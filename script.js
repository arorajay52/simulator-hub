// --- Deterministic LCG Random Number Generator ---
class SeededRNG {
    constructor(seed) {
        this.state = seed >>> 0;
    }
    next() {
        let e = this.state += 0x6d2b79f5;
        return e = Math.imul(e ^ e >>> 15, 1 | e), (((e ^= e + Math.imul(e ^ e >>> 7, 61 | e)) ^ e >>> 14) >>> 0) / 0x100000000;
    }
}

// --- C Major Pentatonic Frequencies ---
const PENTATONIC_FREQS = [
    130.81, // C3
    146.83, // D3
    164.81, // E3
    196.00, // G3
    220.00, // A3
    261.63, // C4
    293.66, // D4
    329.63, // E4
    392.00, // G4
    440.00, // A4
    523.25, // C5
    587.33, // D5
    659.25, // E5
    783.99, // G5
    880.00, // A5
    1046.50 // C6
];

// --- Synth plucks audio engine ---
class SynthAudio {
    constructor() {
        this.ctx = null;
        this.destination = null; // Stream destination node for video recording
    }

    init() {
        if (this.ctx) return;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
        
        // Set up recorder output link if possible
        this.destination = this.ctx.createMediaStreamDestination();
        
        // Add node to standard speaker output
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = 0.45;
        this.gainNode.connect(this.ctx.destination);
    }

    playPluck(frequency, duration = 0.5) {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const now = this.ctx.currentTime;
        
        // Mix triangle wave (warm base) and sine wave (clean tone)
        const oscTriangle = this.ctx.createOscillator();
        const oscSine = this.ctx.createOscillator();
        
        const oscGainTriangle = this.ctx.createGain();
        const oscGainSine = this.ctx.createGain();
        
        const filter = this.ctx.createBiquadFilter();
        
        oscTriangle.type = 'triangle';
        oscTriangle.frequency.value = frequency;
        
        oscSine.type = 'sine';
        oscSine.frequency.value = frequency * 2; // harmonic octave

        // Low-pass filter for plucky warmth
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + duration);

        // Envelopes
        oscGainTriangle.gain.setValueAtTime(0.35, now);
        oscGainTriangle.gain.exponentialRampToValueAtTime(0.001, now + duration);

        oscGainSine.gain.setValueAtTime(0.12, now);
        oscGainSine.gain.exponentialRampToValueAtTime(0.001, now + duration);

        // Connect
        oscTriangle.connect(oscGainTriangle);
        oscGainTriangle.connect(filter);

        oscSine.connect(oscGainSine);
        oscGainSine.connect(filter);

        filter.connect(this.gainNode);
        if (this.destination) {
            filter.connect(this.destination);
        }

        // Start and stop
        oscTriangle.start(now);
        oscTriangle.stop(now + duration + 0.1);
        
        oscSine.start(now);
        oscSine.stop(now + duration + 0.1);
    }

    playEscapeSound() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        // Play quick ascending arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            setTimeout(() => {
                this.playPluck(freq, 0.8);
            }, idx * 100);
        });
    }
}

const audio = new SynthAudio();

// --- Ring and Physics configurations ---
class Ring {
    constructor(radius, gapSizeRad, rotSpeed, color, startAngle = 0) {
        this.radius = radius;
        this.thickness = 10;
        this.gapSize = gapSizeRad; // in radians
        this.rotationSpeed = rotSpeed; // radians per frame
        this.currentRotation = startAngle;
        this.color = color;
    }

    update(dt) {
        this.currentRotation = (this.currentRotation + this.rotationSpeed * dt) % (Math.PI * 2);
        if (this.currentRotation < 0) this.currentRotation += Math.PI * 2;
    }

    getGapAngles() {
        // Gap is centered on the current rotation angle
        const start = (this.currentRotation - this.gapSize / 2) % (Math.PI * 2);
        const end = (this.currentRotation + this.gapSize / 2) % (Math.PI * 2);
        return {
            start: start < 0 ? start + Math.PI * 2 : start,
            end: end < 0 ? end + Math.PI * 2 : end
        };
    }
}

class Ball {
    constructor(x, y, radius, targetSpeed) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.vx = 0;
        this.vy = 0;
        this.targetSpeed = targetSpeed;
        this.baseTargetSpeed = targetSpeed;
        
        // Initialize velocity with random angle
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * targetSpeed;
        this.vy = Math.sin(angle) * targetSpeed;
        
        this.trail = [];
    }
}

class PhysicsEngine {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.centerX = width / 2;
        this.centerY = height / 2;
        
        this.seed = 1337;
        this.rings = [];
        this.ball = null;
        
        // User settings
        this.gravity = 10;
        this.targetSpeed = 400;
        this.ringCount = 5;
        this.gapSizeDeg = 35;
        this.rotationSpeedMult = 1.5;
        this.ballRadius = 12;
        this.bouncierEnabled = true;
        this.bounceIncrement = 12; // speed increase per hit
        
        this.isEscaped = false;
        this.timeElapsed = 0;
        
        // Collision callbacks
        this.onCollision = null;
        this.onEscape = null;
    }

    init(seed = Math.floor(Math.random() * 99999999)) {
        this.seed = seed;
        this.isEscaped = false;
        this.timeElapsed = 0;
        
        const rng = new SeededRNG(seed);
        this.rings = [];
        
        // Distribute ring radii evenly
        const maxRadius = Math.min(this.width, this.height) * 0.45;
        const minRadius = 80;
        const spacing = (maxRadius - minRadius) / (this.ringCount - 1 || 1);
        
        const colors = [
            '#ff0055', '#ff9900', '#ccff00', '#00ff66', '#00ffff', 
            '#0066ff', '#7700ff', '#ff00ff', '#ff0055', '#ff9900'
        ];

        for (let i = 0; i < this.ringCount; i++) {
            const radius = minRadius + i * spacing;
            // Seeded starting rotation speed
            const direction = rng.next() > 0.5 ? 1 : -1;
            const speed = direction * (0.01 + rng.next() * 0.015) * this.rotationSpeedMult;
            const startAngle = rng.next() * Math.PI * 2;
            const gapSizeRad = (this.gapSizeDeg * Math.PI) / 180;
            
            const ringColor = colors[i % colors.length];
            this.rings.push(new Ring(radius, gapSizeRad, speed, ringColor, startAngle));
        }

        // Initialize ball
        this.ball = new Ball(this.centerX, this.centerY, this.ballRadius, this.targetSpeed);
        // First launch angle from seed
        const startAngle = rng.next() * Math.PI * 2;
        this.ball.vx = Math.cos(startAngle) * this.targetSpeed;
        this.ball.vy = Math.sin(startAngle) * this.targetSpeed;
    }

    // High precision sub-stepped update
    update(dt) {
        if (this.isEscaped) return;

        const substeps = 12; // high sub-stepping to prevent tunnelling completely
        const subDt = dt / substeps;

        for (let step = 0; step < substeps; step++) {
            this.timeElapsed += subDt;
            
            // Update rings
            this.rings.forEach(ring => ring.update(subDt));

            // Apply gravity to velocity vector
            this.ball.vy += this.gravity * 8.0 * subDt; // scaled gravity

            // Clamp/normalize velocity back to target speed
            let currentSpeed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
            if (currentSpeed > 0) {
                this.ball.vx = (this.ball.vx / currentSpeed) * this.ball.targetSpeed;
                this.ball.vy = (this.ball.vy / currentSpeed) * this.ball.targetSpeed;
            }

            // Move ball
            this.ball.x += this.ball.vx * subDt;
            this.ball.y += this.ball.vy * subDt;

            // Calculate distance to center
            const dx = this.ball.x - this.centerX;
            const dy = this.ball.y - this.centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Check escape condition
            const maxRingRadius = this.rings[this.rings.length - 1].radius;
            if (dist > maxRingRadius + this.ball.radius + 15) {
                this.isEscaped = true;
                if (this.onEscape) this.onEscape();
                break;
            }

            // Check collisions against active rings
            for (let i = 0; i < this.rings.length; i++) {
                const ring = this.rings[i];
                const innerBound = ring.radius - ring.thickness / 2;
                const outerBound = ring.radius + ring.thickness / 2;

                if (dist + this.ball.radius >= innerBound && dist - this.ball.radius <= outerBound) {
                    // Overlapping the ring zone, check if ball is inside the ring gap
                    let ballAngle = Math.atan2(dy, dx);
                    if (ballAngle < 0) ballAngle += Math.PI * 2;

                    // Normal difference logic
                    const gap = ring.getGapAngles();
                    let inGap = false;
                    
                    // Check angular span
                    if (gap.start < gap.end) {
                        if (ballAngle >= gap.start && ballAngle <= gap.end) {
                            inGap = true;
                        }
                    } else {
                        if (ballAngle >= gap.start || ballAngle <= gap.end) {
                            inGap = true;
                        }
                    }

                    if (!inGap) {
                        // COLLISION! Solid ring bounce
                        const normalX = dx / (dist || 1);
                        const normalY = dy / (dist || 1);

                        // Find if ball is colliding from inner or outer boundary
                        const isInsideRing = dist < ring.radius;

                        if (isInsideRing) {
                            // Pushed back inward
                            this.ball.x = this.centerX + normalX * (innerBound - this.ball.radius - 0.5);
                            this.ball.y = this.centerY + normalY * (innerBound - this.ball.radius - 0.5);
                        } else {
                            // Pushed back outward
                            this.ball.x = this.centerX + normalX * (outerBound + this.ball.radius + 0.5);
                            this.ball.y = this.centerY + normalY * (outerBound + this.ball.radius + 0.5);
                        }

                        // Constant-speed rebound physics: rebound normal direction
                        const bounceNormalX = isInsideRing ? -normalX : normalX;
                        const bounceNormalY = isInsideRing ? -normalY : normalY;
                        
                        const bounceNormalAngle = Math.atan2(bounceNormalY, bounceNormalX);
                        
                        // Apply a random bounce sweep of +/- 30 degrees (Math.PI / 6)
                        const spreadAngle = (Math.random() - 0.5) * (Math.PI / 3);
                        const reboundAngle = bounceNormalAngle + spreadAngle;

                        // Bouncier increment
                        if (this.bouncierEnabled) {
                            this.ball.targetSpeed = Math.min(this.ball.targetSpeed + this.bounceIncrement, this.ball.baseTargetSpeed * 2.2);
                        }

                        // Apply velocity rebound
                        this.ball.vx = Math.cos(reboundAngle) * this.ball.targetSpeed;
                        this.ball.vy = Math.sin(reboundAngle) * this.ball.targetSpeed;

                        // Trigger bounce event
                        if (this.onCollision) {
                            this.onCollision(i, this.ball.x, this.ball.y);
                        }
                        break; // Only collide with one ring per sub-step
                    } else {
                        // Pass through gap! Reset speed multiplier build-up
                        if (this.bouncierEnabled) {
                            this.ball.targetSpeed = Math.max(this.ball.targetSpeed - this.bounceIncrement * 2, this.ball.baseTargetSpeed);
                        }
                    }
                }
            }
        }
    }

    // Headless simulator solver to test a seed in milliseconds
    testSeed(seed, maxSeconds = 120) {
        this.init(seed);
        
        const rng = new SeededRNG(seed);
        
        const dt = 1 / 60;
        const maxSteps = maxSeconds * 60;
        let step = 0;

        while (!this.isEscaped && step < maxSteps) {
            // Headless fast update (no random in updates, pure seed calculation)
            const substeps = 12;
            const subDt = dt / substeps;

            for (let s = 0; s < substeps; s++) {
                // Ring angles update
                this.rings.forEach(ring => {
                    ring.currentRotation = (ring.currentRotation + ring.rotationSpeed * subDt) % (Math.PI * 2);
                    if (ring.currentRotation < 0) ring.currentRotation += Math.PI * 2;
                });

                // Gravity
                this.ball.vy += this.gravity * 8.0 * subDt;

                // Normalize speed
                const currentSpeed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
                if (currentSpeed > 0) {
                    this.ball.vx = (this.ball.vx / currentSpeed) * this.ball.targetSpeed;
                    this.ball.vy = (this.ball.vy / currentSpeed) * this.ball.targetSpeed;
                }

                // Position update
                this.ball.x += this.ball.vx * subDt;
                this.ball.y += this.ball.vy * subDt;

                const dx = this.ball.x - this.centerX;
                const dy = this.ball.y - this.centerY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Escape
                const maxRingRadius = this.rings[this.rings.length - 1].radius;
                if (dist > maxRingRadius + this.ball.radius + 15) {
                    this.isEscaped = true;
                    break;
                }

                // Rings collision
                for (let i = 0; i < this.rings.length; i++) {
                    const ring = this.rings[i];
                    const innerBound = ring.radius - ring.thickness / 2;
                    const outerBound = ring.radius + ring.thickness / 2;

                    if (dist + this.ball.radius >= innerBound && dist - this.ball.radius <= outerBound) {
                        let ballAngle = Math.atan2(dy, dx);
                        if (ballAngle < 0) ballAngle += Math.PI * 2;

                        const gap = ring.getGapAngles();
                        let inGap = false;
                        if (gap.start < gap.end) {
                            if (ballAngle >= gap.start && ballAngle <= gap.end) inGap = true;
                        } else {
                            if (ballAngle >= gap.start || ballAngle <= gap.end) inGap = true;
                        }

                        if (!inGap) {
                            const normalX = dx / (dist || 1);
                            const normalY = dy / (dist || 1);
                            const isInsideRing = dist < ring.radius;

                            if (isInsideRing) {
                                this.ball.x = this.centerX + normalX * (innerBound - this.ball.radius - 0.5);
                                this.ball.y = this.centerY + normalY * (innerBound - this.ball.radius - 0.5);
                            } else {
                                this.ball.x = this.centerX + normalX * (outerBound + this.ball.radius + 0.5);
                                this.ball.y = this.centerY + normalY * (outerBound + this.ball.radius + 0.5);
                            }

                            const bounceNormalX = isInsideRing ? -normalX : normalX;
                            const bounceNormalY = isInsideRing ? -normalY : normalY;
                            const bounceNormalAngle = Math.atan2(bounceNormalY, bounceNormalX);

                            // LCG RNG based bounce spread for solver consistency
                            const spreadAngle = (rng.next() - 0.5) * (Math.PI / 3);
                            const reboundAngle = bounceNormalAngle + spreadAngle;

                            if (this.bouncierEnabled) {
                                this.ball.targetSpeed = Math.min(this.ball.targetSpeed + this.bounceIncrement, this.ball.baseTargetSpeed * 2.2);
                            }

                            this.ball.vx = Math.cos(reboundAngle) * this.ball.targetSpeed;
                            this.ball.vy = Math.sin(reboundAngle) * this.ball.targetSpeed;
                            break;
                        } else {
                            if (this.bouncierEnabled) {
                                this.ball.targetSpeed = Math.max(this.ball.targetSpeed - this.bounceIncrement * 2, this.ball.baseTargetSpeed);
                            }
                        }
                    }
                }
            }

            step++;
        }

        return this.isEscaped ? step * dt : maxSeconds;
    }
}

// --- Visual Spark Particles System ---
class Spark {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 150;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        this.life = 1.0;
        this.decay = 1.5 + Math.random() * 1.5;
        this.size = 2 + Math.random() * 3;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= this.decay * dt;
    }
}

// --- Main Simulation App Controller ---
class SimulationApp {
    constructor() {
        this.canvas = document.getElementById('physicsCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.physics = new PhysicsEngine(this.canvas.width, this.canvas.height);
        this.sparks = [];
        
        this.isPlaying = true;
        this.lastTime = 0;
        
        // Visual configs
        this.showNeon = true;
        this.showParticles = true;
        this.trailLength = 30;
        this.screenShake = 0;
        this.shakeAmount = 0;
        
        // Seed find variables
        this.searchActive = false;
        this.searchRequestId = null;
        
        // Aspect ratios
        this.aspectRatio = '1:1';
        
        // Video Recorder variables
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecordingNext = false;
        this.isRecordingNow = false;
        this.recordStartTime = 0;
        this.recordTimerInterval = null;

        this.initEvents();
        this.resetSimulation();
        
        // Start frame loop
        requestAnimationFrame(this.tick.bind(this));
    }

    initEvents() {
        // UI settings inputs
        const syncValue = (inputEl, displayEl, callback) => {
            inputEl.addEventListener('input', (e) => {
                const val = e.target.value;
                displayEl.textContent = val + (inputEl.id === 'input-gap' ? '°' : '');
                callback(val);
            });
        };

        syncValue(document.getElementById('input-speed'), document.getElementById('val-speed'), (val) => {
            this.physics.targetSpeed = parseFloat(val);
            if (this.physics.ball) {
                this.physics.ball.baseTargetSpeed = parseFloat(val);
            }
        });

        syncValue(document.getElementById('input-gravity'), document.getElementById('val-gravity'), (val) => {
            this.physics.gravity = parseFloat(val);
        });

        syncValue(document.getElementById('input-rings'), document.getElementById('val-rings'), (val) => {
            this.physics.ringCount = parseInt(val);
            this.resetSimulation();
        });

        syncValue(document.getElementById('input-gap'), document.getElementById('val-gap'), (val) => {
            this.physics.gapSizeDeg = parseInt(val);
            this.resetSimulation();
        });

        syncValue(document.getElementById('input-rotation'), document.getElementById('val-rotation'), (val) => {
            this.physics.rotationSpeedMult = parseFloat(val);
            this.resetSimulation();
        });

        syncValue(document.getElementById('input-radius'), document.getElementById('val-radius'), (val) => {
            this.physics.ballRadius = parseInt(val);
            if (this.physics.ball) this.physics.ball.radius = parseInt(val);
        });

        syncValue(document.getElementById('input-trail'), document.getElementById('val-trail'), (val) => {
            this.trailLength = parseInt(val);
        });

        syncValue(document.getElementById('input-targetDuration'), document.getElementById('val-targetDuration'), (val) => {
            document.getElementById('btn-findSeed').textContent = `🔍 Find ${val}s Simulation`;
        });

        // Toggle configurations
        const bindToggle = (btnId, callback) => {
            const btn = document.getElementById(btnId);
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                callback(btn.classList.contains('active'));
            });
        };

        bindToggle('toggle-bouncier', (active) => { this.physics.bouncierEnabled = active; });
        bindToggle('toggle-neon', (active) => { this.showNeon = active; });
        bindToggle('toggle-particles', (active) => { this.showParticles = active; });
        bindToggle('toggle-screenShake', (active) => { this.screenShake = active ? 0 : -1; });

        // Tabs Switch
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                tabButtons.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                btn.classList.add('active');
                document.getElementById(btn.dataset.tab).classList.add('active');
            });
        });

        // HUD Play/Pause
        const playPauseBtn = document.getElementById('hudPlayPauseBtn');
        playPauseBtn.addEventListener('click', () => {
            this.isPlaying = !this.isPlaying;
            playPauseBtn.textContent = this.isPlaying ? '⏸ Pause' : '▶ Play';
        });

        // HUD Reset
        document.getElementById('hudRestartBtn').addEventListener('click', () => {
            this.resetSimulation();
        });

        // Audio prompt
        document.getElementById('audioEnableBtn').addEventListener('click', () => {
            audio.init();
            document.getElementById('audioPrompt').style.display = 'none';
        });

        // Simulation Finder solver triggers
        document.getElementById('btn-findSeed').addEventListener('click', () => this.startSeedSearch());
        document.getElementById('btn-cancelSearch').addEventListener('click', () => this.cancelSeedSearch());

        // Aspect ratio triggers
        const ratioButtons = document.querySelectorAll('.ratio-btn');
        const canvasFrame = document.getElementById('canvasFrame');
        ratioButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                ratioButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.aspectRatio = btn.dataset.ratio;

                // Recalculate frame aspect ratios
                if (this.aspectRatio === '1:1') {
                    canvasFrame.style.aspectRatio = '1';
                    canvasFrame.style.width = 'min(70vh, 85vw)';
                } else if (this.aspectRatio === '16:9') {
                    canvasFrame.style.aspectRatio = '1.777777778';
                    canvasFrame.style.width = 'min(50vh * 1.7778, 85vw)';
                } else if (this.aspectRatio === '9:16') {
                    canvasFrame.style.aspectRatio = '0.5625';
                    canvasFrame.style.width = 'min(75vh * 0.5625, 85vw)';
                }
            });
        });

        // Video Record trigger
        const recordBtn = document.getElementById('btn-record');
        recordBtn.addEventListener('click', () => {
            audio.init(); // ensure audio is running
            this.isRecordingNext = true;
            recordBtn.textContent = 'Recording scheduled...';
            recordBtn.classList.add('btn-primary');
            this.resetSimulation();
        });
    }

    resetSimulation(seed = Math.floor(Math.random() * 999999)) {
        this.physics.init(seed);
        this.sparks = [];
        this.physics.onCollision = (ringIdx, x, y) => this.handleCollision(ringIdx, x, y);
        this.physics.onEscape = () => this.handleEscape();
        
        document.getElementById('hudSeedDisplay').textContent = `Seed: ${seed}`;
        this.lastTime = performance.now();
        
        // If recording was scheduled, trigger it immediately on reload
        if (this.isRecordingNext) {
            this.isRecordingNext = false;
            this.startRecording();
        }
    }

    handleCollision(ringIndex, x, y) {
        // Play corresponding frequency based on ring position
        const noteIndex = Math.min(ringIndex, PENTATONIC_FREQS.length - 1);
        const freq = PENTATONIC_FREQS[noteIndex];
        audio.playPluck(freq);

        // Spawn spark particles
        if (this.showParticles) {
            const ringColor = this.physics.rings[ringIndex].color;
            for (let i = 0; i < 18; i++) {
                this.sparks.push(new Spark(x, y, ringColor));
            }
        }

        // Shake screen
        if (this.screenShake !== -1) {
            this.shakeAmount = 14;
        }
    }

    handleEscape() {
        audio.playEscapeSound();
        if (this.isRecordingNow) {
            this.stopRecording();
        }
    }

    // --- Seed Finder Search Worker ---
    startSeedSearch() {
        const targetDuration = parseInt(document.getElementById('input-targetDuration').value);
        const progressContainer = document.getElementById('searchProgressContainer');
        const progressFill = document.getElementById('searchProgressFill');
        const statusDisplay = document.getElementById('searchStatus');
        const startBtn = document.getElementById('btn-findSeed');
        const cancelBtn = document.getElementById('btn-cancelSearch');

        this.searchActive = true;
        progressContainer.style.display = 'block';
        startBtn.style.display = 'none';
        cancelBtn.style.display = 'block';

        let testedSeedsCount = 0;
        let closestSeed = null;
        let closestDifference = Infinity;
        let closestDuration = 0;

        const batchSearch = () => {
            if (!this.searchActive) return;

            const batchSize = 120; // test 120 seeds per frame
            for (let i = 0; i < batchSize; i++) {
                testedSeedsCount++;
                
                // Seed is tested against the fast physics solver
                const testSeed = Math.floor(Math.random() * 9999999);
                
                // Simulate running and get escape duration
                const escapeDuration = this.physics.testSeed(testSeed, targetDuration + 10);
                const diff = Math.abs(escapeDuration - targetDuration);

                if (diff < closestDifference) {
                    closestDifference = diff;
                    closestSeed = testSeed;
                    closestDuration = escapeDuration;
                }

                // Perfect match check (within +/- 0.5s tolerance)
                if (diff <= 0.35) {
                    statusDisplay.innerHTML = `<span style="color:var(--accent)">FOUND PERFECT SEED: ${testSeed}</span><br>Escaped in ${escapeDuration.toFixed(2)}s!`;
                    this.resetSimulation(testSeed);
                    this.cancelSeedSearch();
                    return;
                }
            }

            // Update UI solver progress
            const pct = Math.min((1 / closestDifference) * 100, 100);
            progressFill.style.width = `${pct}%`;
            statusDisplay.innerHTML = `Tested ${testedSeedsCount} seeds...<br>Closest: ${closestDuration.toFixed(2)}s (Seed ${closestSeed})`;

            this.searchRequestId = requestAnimationFrame(batchSearch);
        };

        this.searchRequestId = requestAnimationFrame(batchSearch);
    }

    cancelSeedSearch() {
        this.searchActive = false;
        if (this.searchRequestId) cancelAnimationFrame(this.searchRequestId);
        
        document.getElementById('searchProgressContainer').style.display = 'none';
        document.getElementById('btn-findSeed').style.display = 'block';
        document.getElementById('btn-cancelSearch').style.display = 'none';
        
        const recordBtn = document.getElementById('btn-record');
        recordBtn.textContent = 'Record Next Run';
        recordBtn.classList.remove('btn-primary');
    }

    // --- Canvas MediaRecorder Video Exporter ---
    startRecording() {
        this.recordedChunks = [];
        this.isRecordingNow = true;
        
        // Display HUD overlay
        const overlay = document.getElementById('recordingOverlay');
        overlay.style.display = 'flex';
        this.recordStartTime = performance.now();
        
        // Setup timer UI update
        const timerSpan = document.getElementById('recordTimer');
        this.recordTimerInterval = setInterval(() => {
            const elapsed = (performance.now() - this.recordStartTime) / 1000;
            const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const secs = Math.floor(elapsed % 60).toString().padStart(2, '0');
            timerSpan.textContent = `${mins}:${secs}`;
        }, 1000);

        // Build composite audio + video stream
        const canvasStream = this.canvas.captureStream(60); // 60 FPS capture
        const streamTracks = [...canvasStream.getVideoTracks()];

        // If synth node exists, append Audio track
        if (audio.destination && audio.destination.stream) {
            const audioTracks = audio.destination.stream.getAudioTracks();
            if (audioTracks.length > 0) {
                streamTracks.push(audioTracks[0]);
            }
        }

        const compositeStream = new MediaStream(streamTracks);
        
        // Choose WebM video container format
        const options = { mimeType: 'video/webm;codecs=vp9,opus' };
        try {
            this.mediaRecorder = new MediaRecorder(compositeStream, options);
        } catch (e) {
            // Fallback if VP9 codec not supported on safari/older mobile
            this.mediaRecorder = new MediaRecorder(compositeStream, { mimeType: 'video/webm' });
        }

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            // Trigger download of the recorded clip
            const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `satisfying_simulation_seed_${this.physics.seed}.webm`;
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);

            // Reset button states
            const recordBtn = document.getElementById('btn-record');
            recordBtn.textContent = 'Record Next Run';
            recordBtn.classList.remove('btn-primary');
        };

        this.mediaRecorder.start();
    }

    stopRecording() {
        this.isRecordingNow = false;
        document.getElementById('recordingOverlay').style.display = 'none';
        clearInterval(this.recordTimerInterval);
        
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
    }

    // --- Drawing & Animation Loop ---
    tick(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        
        let dt = (timestamp - this.lastTime) / 1000;
        // Cap dt to prevent massive jumps when switching tabs
        if (dt > 0.1) dt = 0.1;
        this.lastTime = timestamp;

        if (this.isPlaying) {
            this.physics.update(dt);
            
            // Update sparks
            this.sparks.forEach(spark => spark.update(dt));
            this.sparks = this.sparks.filter(spark => spark.life > 0);

            // Add current ball position to trail history
            if (this.physics.ball) {
                const ball = this.physics.ball;
                ball.trail.push({ x: ball.x, y: ball.y });
                if (ball.trail.length > this.trailLength) {
                    ball.trail.shift();
                }
            }
        }

        this.render();
        requestAnimationFrame(this.tick.bind(this));
    }

    render() {
        this.ctx.save();
        
        // Handle Screen Shake
        if (this.shakeAmount > 0.1) {
            const dx = (Math.random() - 0.5) * this.shakeAmount;
            const dy = (Math.random() - 0.5) * this.shakeAmount;
            this.ctx.translate(dx, dy);
            this.shakeAmount *= 0.88; // decay
        }

        // Clear frame with deep slate color
        this.ctx.fillStyle = '#06080e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw central grid guidelines
        this.ctx.strokeStyle = 'rgba(255,255,255,0.02)';
        this.ctx.lineWidth = 1;
        
        // Draw concentric guide circles
        for (let r = 50; r < 500; r += 50) {
            this.ctx.beginPath();
            this.ctx.arc(this.physics.centerX, this.physics.centerY, r, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        // --- Draw Ball Neon Trail ---
        const ball = this.physics.ball;
        if (ball && ball.trail.length > 1) {
            for (let i = 1; i < ball.trail.length; i++) {
                const p1 = ball.trail[i - 1];
                const p2 = ball.trail[i];
                const pct = i / ball.trail.length;
                
                this.ctx.beginPath();
                this.ctx.moveTo(p1.x, p1.y);
                this.ctx.lineTo(p2.x, p2.y);
                
                // Neon green gradient trail
                this.ctx.strokeStyle = `rgba(0, 255, 204, ${pct * 0.4})`;
                this.ctx.lineWidth = ball.radius * 2 * pct;
                this.ctx.lineCap = 'round';
                this.ctx.stroke();
            }
        }

        // --- Draw Rings ---
        this.physics.rings.forEach(ring => {
            const gap = ring.getGapAngles();
            
            this.ctx.save();
            this.ctx.shadowBlur = this.showNeon ? 18 : 0;
            this.ctx.shadowColor = ring.color;
            this.ctx.strokeStyle = ring.color;
            this.ctx.lineWidth = ring.thickness;
            this.ctx.lineCap = 'round';
            
            // Draw ring leaving a gap
            this.ctx.beginPath();
            // Make the arc start and end at the gap limits
            this.ctx.arc(
                this.physics.centerX, 
                this.physics.centerY, 
                ring.radius, 
                gap.end, 
                gap.start
            );
            this.ctx.stroke();
            this.ctx.restore();
        });

        // --- Draw sparks ---
        if (this.showParticles) {
            this.sparks.forEach(spark => {
                this.ctx.beginPath();
                this.ctx.arc(spark.x, spark.y, spark.size * spark.life, 0, Math.PI * 2);
                this.ctx.fillStyle = spark.color;
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = spark.color;
                this.ctx.fill();
            });
        }

        // --- Draw Ball ---
        if (ball) {
            this.ctx.save();
            this.ctx.shadowBlur = this.showNeon ? 25 : 0;
            this.ctx.shadowColor = '#00ffcc';
            
            // Glowing central ball
            this.ctx.beginPath();
            this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fill();

            // Subtle cyan outline
            this.ctx.strokeStyle = '#00ffcc';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            this.ctx.restore();
        }

        this.ctx.restore();
    }
}

// Initialize App on DOM load
window.addEventListener('DOMContentLoaded', () => {
    window.app = new SimulationApp();
});
