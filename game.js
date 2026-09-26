// Bike Race Web - Complete Game Engine
// Built with Matter.js 2D Physics + HTML5 Canvas

(function() {
    'use strict';

    const {
        Engine, World, Bodies, Body, Composite, Constraint, Vector, Events
    } = Matter;

    // --- GAME CONSTANTS & STATE ---
    const STATE = {
        MENU: 0,
        PLAYING: 1,
        CRASHED: 2,
        VICTORY: 3
    };

    let engine = null;
    let world = null;
    let canvas = null;
    let ctx = null;

    let gameState = STATE.PLAYING;
    let currentLevelIndex = 0;
    let levelData = null;
    let trackBodies = [];

    // Bike entities
    let bike = null;
    let particles = [];
    let floatingTexts = [];

    // Camera
    let camera = { x: 0, y: 0, scale: 1, targetScale: 1 };

    // Inputs
    const input = {
        gas: false,
        brake: false,
        leanLeft: false,
        leanRight: false
    };

    // Game stats
    let startTime = 0;
    let finalTime = 0;
    let isTimerRunning = false;
    let flips = 0;
    let airRotationAccum = 0;
    let lastAngle = 0;
    let inAir = false;

    // Custom Track Editor State
    let customSegments = [];
    let isDrawing = false;
    let drawStartPos = null;

    // --- BIKE CREATION ---
    function createBike(x, y) {
        const group = Body.nextGroup(true); // Non-colliding group for bike parts

        // Wheel dimensions
        const wheelRadius = 17;
        const wheelDistance = 64; // Distance between axles

        // Wheels
        const rearWheel = Bodies.circle(x - wheelDistance / 2, y + 10, wheelRadius, {
            collisionFilter: { group: group },
            friction: 1.0,
            frictionStatic: 1.5,
            density: 0.05,
            restitution: 0.15,
            label: 'rearWheel'
        });

        const frontWheel = Bodies.circle(x + wheelDistance / 2, y + 10, wheelRadius, {
            collisionFilter: { group: group },
            friction: 0.95,
            frictionStatic: 1.5,
            density: 0.045,
            restitution: 0.15,
            label: 'frontWheel'
        });

        // Chassis / Frame
        const chassis = Bodies.rectangle(x, y, 54, 18, {
            collisionFilter: { group: group },
            density: 0.025,
            friction: 0.4,
            label: 'chassis'
        });

        // Rider Head (Crucial for Bike Race mechanics: touching ground = crash!)
        const head = Bodies.circle(x - 4, y - 36, 12, {
            collisionFilter: { group: group },
            density: 0.015,
            restitution: 0.1,
            label: 'head'
        });

        // Rigid Head Mount to Chassis
        const headConstraint = Constraint.create({
            bodyA: chassis,
            pointA: { x: -4, y: -26 },
            bodyB: head,
            pointB: { x: 0, y: 0 },
            stiffness: 0.95,
            damping: 0.1,
            render: { visible: false }
        });

        // Suspension Constraints (Springs connecting wheels to chassis)
        const rearSuspension = Constraint.create({
            bodyA: chassis,
            pointA: { x: -wheelDistance / 2 + 4, y: 10 },
            bodyB: rearWheel,
            pointB: { x: 0, y: 0 },
            stiffness: 0.75,
            damping: 0.25,
            length: 12
        });

        const frontSuspension = Constraint.create({
            bodyA: chassis,
            pointA: { x: wheelDistance / 2 - 4, y: 10 },
            bodyB: frontWheel,
            pointB: { x: 0, y: 0 },
            stiffness: 0.75,
            damping: 0.25,
            length: 12
        });

        // Cross-axle structural constraint to prevent chassis from folding over
        const axleConstraint = Constraint.create({
            bodyA: rearWheel,
            bodyB: frontWheel,
            stiffness: 0.95,
            length: wheelDistance
        });

        const composite = Composite.create({ label: 'bike' });
        Composite.add(composite, [
            chassis, rearWheel, frontWheel, head,
            headConstraint, rearSuspension, frontSuspension, axleConstraint
        ]);

        return {
            composite,
            chassis,
            rearWheel,
            frontWheel,
            head,
            isAlive: true,
            flips: 0
        };
    }

    // --- TRACK CREATION ---
    function buildTrack(level) {
        // Clear previous bodies
        trackBodies.forEach(b => World.remove(world, b));
        trackBodies = [];

        let segments = [];
        if (level.isEditor) {
            segments = customSegments.length > 0 ? customSegments : level.build();
        } else {
            segments = level.build();
        }

        segments.forEach(seg => {
            const dx = seg.x2 - seg.x1;
            const dy = seg.y2 - seg.y1;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            const midX = (seg.x1 + seg.x2) / 2;
            const midY = (seg.y1 + seg.y2) / 2;
            const thick = seg.thickness || 14;

            // Static rigid body for each segment
            const body = Bodies.rectangle(midX, midY, length + 2, thick, {
                isStatic: true,
                angle: angle,
                friction: 0.95,
                frictionStatic: 1.5,
                restitution: 0.05,
                label: 'track'
            });

            // Keep reference to line coords for smooth rendering
            body.segmentData = seg;
            World.add(world, body);
            trackBodies.push(body);
        });

        // Add Finish Line Trigger / Sensor
        const finish = level.finish;
        const finishBody = Bodies.rectangle(
            finish.x, finish.y, finish.width, finish.height, {
                isStatic: true,
                isSensor: true,
                label: 'finish'
            }
        );
        World.add(world, finishBody);
        trackBodies.push(finishBody);
    }

    // --- INITIALIZE GAME ---
    function init() {
        canvas = document.getElementById('gameCanvas');
        ctx = canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Matter.js Physics Engine
        engine = Engine.create({
            gravity: { x: 0, y: 1.15, scale: 0.001 }
        });
        world = engine.world;

        // Collision Handler (Head crash & Finish line)
        Events.on(engine, 'collisionStart', function(event) {
            if (gameState !== STATE.PLAYING) return;

            const pairs = event.pairs;
            for (let i = 0; i < pairs.length; i++) {
                const { bodyA, bodyB } = pairs[i];

                // Finish Line detection
                if ((bodyA.label === 'finish' || bodyB.label === 'finish') &&
                    (bodyA.label === 'rearWheel' || bodyB.label === 'rearWheel' ||
                     bodyA.label === 'frontWheel' || bodyB.label === 'frontWheel' ||
                     bodyA.label === 'chassis' || bodyB.label === 'chassis')) {
                    triggerVictory();
                    return;
                }

                // Head Crash detection
                if ((bodyA.label === 'head' && bodyB.label === 'track') ||
                    (bodyB.label === 'head' && bodyA.label === 'track')) {
                    triggerCrash();
                    return;
                }
            }
        });

        setupControls();
        setupUI();
        loadLevel(0);

        // Start main loop
        requestAnimationFrame(gameLoop);
    }

    function resizeCanvas() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    // --- LEVEL MANAGEMENT ---
    function loadLevel(index) {
        currentLevelIndex = index;
        levelData = LEVELS[index];

        // Reset world
        World.clear(world, false);
        trackBodies = [];

        // Build track
        buildTrack(levelData);

        // Spawn bike
        if (bike && bike.composite) {
            World.remove(world, bike.composite);
        }
        bike = createBike(levelData.start.x, levelData.start.y);
        World.add(world, bike.composite);

        // Reset stats
        camera.x = levelData.start.x;
        camera.y = levelData.start.y;
        gameState = STATE.PLAYING;
        startTime = performance.now();
        isTimerRunning = true;
        flips = 0;
        airRotationAccum = 0;
        lastAngle = bike.chassis.angle;
        inAir = false;
        particles = [];
        floatingTexts = [];

        updateUIHUD();
        hideOverlays();

        // Update editor button visibility
        const editorToolbar = document.getElementById('editorToolbar');
        if (editorToolbar) {
            editorToolbar.style.display = levelData.isEditor ? 'flex' : 'none';
        }
    }

    function restartLevel() {
        loadLevel(currentLevelIndex);
    }

    // --- CRASH & VICTORY ---
    function triggerCrash() {
        if (gameState !== STATE.PLAYING) return;
        gameState = STATE.CRASHED;
        bike.isAlive = false;
        isTimerRunning = false;
        window.sounds.playCrash();

        // Spawn explosion particles
        for (let i = 0; i < 40; i++) {
            particles.push({
                x: bike.head.position.x,
                y: bike.head.position.y,
                vx: (Math.random() - 0.5) * 16,
                vy: (Math.random() - 0.7) * 16,
                size: Math.random() * 6 + 3,
                color: ['#ff4500', '#ffa500', '#ffd700', '#ffffff', '#222222'][Math.floor(Math.random() * 5)],
                alpha: 1.0,
                decay: 0.02 + Math.random() * 0.02
            });
        }

        // Show Crash Overlay
        setTimeout(() => {
            const crashModal = document.getElementById('crashModal');
            if (crashModal) crashModal.classList.add('active');
        }, 500);
    }

    function triggerVictory() {
        if (gameState !== STATE.PLAYING) return;
        gameState = STATE.VICTORY;
        isTimerRunning = false;
        finalTime = (performance.now() - startTime) / 1000;
        window.sounds.playWin();

        // Fireworks particles
        for (let i = 0; i < 70; i++) {
            particles.push({
                x: levelData.finish.x,
                y: levelData.finish.y - 40,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.8) * 20,
                size: Math.random() * 7 + 4,
                color: ['#00f0ff', '#ff0077', '#ffd700', '#00ff66', '#ffffff'][Math.floor(Math.random() * 5)],
                alpha: 1.0,
                decay: 0.012 + Math.random() * 0.015
            });
        }

        // Calculate Stars
        const starTimes = levelData.starTimes;
        let starsEarned = 1;
        if (finalTime <= starTimes[2]) {
            starsEarned = 3;
        } else if (finalTime <= starTimes[1]) {
            starsEarned = 2;
        }

        // Save Best Time in LocalStorage
        const bestKey = `bikerace_best_level_${currentLevelIndex}`;
        const previousBest = parseFloat(localStorage.getItem(bestKey)) || 9999;
        if (finalTime < previousBest) {
            localStorage.setItem(bestKey, finalTime.toFixed(2));
        }

        // Show Victory Overlay
        setTimeout(() => {
            showVictoryModal(finalTime, starsEarned, flips);
        }, 700);
    }

    function showVictoryModal(time, stars, flipCount) {
        const modal = document.getElementById('victoryModal');
        const timeEl = document.getElementById('victoryTime');
        const starsContainer = document.getElementById('victoryStars');
        const bonusEl = document.getElementById('victoryFlips');

        if (timeEl) timeEl.textContent = `${time.toFixed(2)}s`;
        if (bonusEl) bonusEl.textContent = `Piruetas (Flips): ${flipCount}`;

        if (starsContainer) {
            starsContainer.innerHTML = '';
            for (let i = 1; i <= 3; i++) {
                const star = document.createElement('span');
                star.className = `star ${i <= stars ? 'active' : ''}`;
                star.textContent = '★';
                starsContainer.appendChild(star);
            }
        }

        if (modal) modal.classList.add('active');
    }

    function hideOverlays() {
        const crashModal = document.getElementById('crashModal');
        const victoryModal = document.getElementById('victoryModal');
        if (crashModal) crashModal.classList.remove('active');
        if (victoryModal) victoryModal.classList.remove('active');
    }

    // --- CONTROLS & PHYSICS UPDATE ---
    function setupControls() {
        // Keyboard Listeners
        window.addEventListener('keydown', e => {
            window.sounds.init();
            if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') input.gas = true;
            if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') input.brake = true;
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.leanLeft = true;
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.leanRight = true;
            if (e.key === 'r' || e.key === 'R' || e.key === ' ') {
                e.preventDefault();
                restartLevel();
            }
        });

        window.addEventListener('keyup', e => {
            if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') input.gas = false;
            if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') input.brake = false;
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.leanLeft = false;
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.leanRight = false;
        });

        // Touch & On-Screen Buttons
        setupTouchButton('btnGas', state => { input.gas = state; });
        setupTouchButton('btnBrake', state => { input.brake = state; });
        setupTouchButton('btnLeanLeft', state => { input.leanLeft = state; });
        setupTouchButton('btnLeanRight', state => { input.leanRight = state; });

        // Left / Right Screen Touch Driving (Like original Bike Race: Left = Brake, Right = Gas)
        canvas.addEventListener('touchstart', handleCanvasTouch, { passive: false });
        canvas.addEventListener('touchmove', handleCanvasTouch, { passive: false });
        canvas.addEventListener('touchend', clearCanvasTouch, { passive: false });

        // Sandbox Editor Mouse & Touch Drawing
        canvas.addEventListener('mousedown', startDrawSegment);
        canvas.addEventListener('mousemove', updateDrawSegment);
        canvas.addEventListener('mouseup', endDrawSegment);
    }

    function setupTouchButton(id, callback) {
        const el = document.getElementById(id);
        if (!el) return;

        const start = (e) => {
            e.preventDefault();
            window.sounds.init();
            callback(true);
            el.classList.add('pressed');
        };
        const end = (e) => {
            e.preventDefault();
            callback(false);
            el.classList.remove('pressed');
        };

        el.addEventListener('mousedown', start);
        el.addEventListener('mouseup', end);
        el.addEventListener('mouseleave', end);
        el.addEventListener('touchstart', start, { passive: false });
        el.addEventListener('touchend', end, { passive: false });
    }

    function handleCanvasTouch(e) {
        if (!levelData || levelData.isEditor) return; // In editor mode, touch is for drawing
        window.sounds.init();
        const rect = canvas.getBoundingClientRect();
        let gasPressed = false;
        let brakePressed = false;

        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            const x = touch.clientX - rect.left;
            if (x > canvas.width * 0.5) {
                gasPressed = true;
            } else {
                brakePressed = true;
            }
        }
        input.gas = gasPressed;
        input.brake = brakePressed;
    }

    function clearCanvasTouch() {
        if (!levelData || levelData.isEditor) return;
        input.gas = false;
        input.brake = false;
    }

    // --- SANDBOX EDITOR DRAWING ---
    function startDrawSegment(e) {
        if (!levelData || !levelData.isEditor) return;
        const rect = canvas.getBoundingClientRect();
        const worldX = (e.clientX - rect.left - canvas.width / 2) / camera.scale + camera.x;
        const worldY = (e.clientY - rect.top - canvas.height / 2) / camera.scale + camera.y;
        isDrawing = true;
        drawStartPos = { x: worldX, y: worldY };
    }

    function updateDrawSegment(e) {
        if (!isDrawing || !levelData || !levelData.isEditor) return;
    }

    function endDrawSegment(e) {
        if (!isDrawing || !levelData || !levelData.isEditor) return;
        const rect = canvas.getBoundingClientRect();
        const worldX = (e.clientX - rect.left - canvas.width / 2) / camera.scale + camera.x;
        const worldY = (e.clientY - rect.top - canvas.height / 2) / camera.scale + camera.y;

        const dist = Math.hypot(worldX - drawStartPos.x, worldY - drawStartPos.y);
        if (dist > 15) {
            const newSeg = TrackUtils.makeLine(drawStartPos.x, drawStartPos.y, worldX, worldY, 14);
            customSegments.push(newSeg);
            buildTrack(levelData);
            window.sounds.playClick();
        }
        isDrawing = false;
        drawStartPos = null;
    }

    // --- PHYSICS & BIKE FORCES ---
    function updatePhysics() {
        if (gameState !== STATE.PLAYING || !bike || !bike.isAlive) {
            window.sounds.updateEngine(false, 0, false);
            return;
        }

        const rear = bike.rearWheel;
        const front = bike.frontWheel;
        const chassis = bike.chassis;

        // Throttle (Drive rear wheel)
        if (input.gas) {
            const maxAngularVel = 0.85;
            if (rear.angularVelocity < maxAngularVel) {
                Body.setAngularVelocity(rear, rear.angularVelocity + 0.08);
            }
            // Slight wheelie torque when giving gas on ground
            Body.applyForce(chassis, chassis.position, { x: 0.008, y: -0.002 });

            // Exhaust particles
            if (Math.random() < 0.6) {
                const angle = chassis.angle;
                const exhaustX = chassis.position.x - Math.cos(angle) * 32;
                const exhaustY = chassis.position.y - Math.sin(angle) * 32 + 4;
                particles.push({
                    x: exhaustX,
                    y: exhaustY,
                    vx: -Math.cos(angle) * (3 + Math.random() * 4) + (Math.random() - 0.5) * 2,
                    vy: -Math.sin(angle) * (3 + Math.random() * 4) + (Math.random() - 0.5) * 2,
                    size: Math.random() * 4 + 2,
                    color: Math.random() < 0.3 ? '#ff6600' : 'rgba(200, 200, 200, 0.7)',
                    alpha: 0.8,
                    decay: 0.035
                });
            }
        }

        // Brakes (Slow down both wheels)
        if (input.brake) {
            Body.setAngularVelocity(rear, rear.angularVelocity * 0.78);
            Body.setAngularVelocity(front, front.angularVelocity * 0.78);
        }

        // Leaning / Rotation (Tilt control)
        const leanTorque = 0.065;
        if (input.leanLeft) {
            // Lean Back (Counter-Clockwise)
            Body.setAngularVelocity(chassis, chassis.angularVelocity - leanTorque);
        }
        if (input.leanRight) {
            // Lean Forward (Clockwise)
            Body.setAngularVelocity(chassis, chassis.angularVelocity + leanTorque);
        }

        // Flip Detection in Air
        detectFlips();

        // Engine Audio
        const currentSpeed = Math.hypot(chassis.velocity.x, chassis.velocity.y);
        const speedRatio = Math.min(currentSpeed / 25, 1.0);
        window.sounds.updateEngine(input.gas, speedRatio, true);
    }

    function detectFlips() {
        const currentAngle = bike.chassis.angle;
        let delta = currentAngle - lastAngle;

        // Wrap delta
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;

        airRotationAccum += delta;
        lastAngle = currentAngle;

        // 360-degree rotation completed
        if (airRotationAccum <= -Math.PI * 1.95) {
            flips++;
            airRotationAccum += Math.PI * 2;
            triggerFlipReward("¡BACKFLIP! +1");
        } else if (airRotationAccum >= Math.PI * 1.95) {
            flips++;
            airRotationAccum -= Math.PI * 2;
            triggerFlipReward("¡FRONTFLIP! +1");
        }
    }

    function triggerFlipReward(text) {
        window.sounds.playFlip();
        floatingTexts.push({
            x: bike.chassis.position.x,
            y: bike.chassis.position.y - 60,
            text: text,
            alpha: 1.0,
            vy: -1.8,
            color: '#ffd700'
        });
    }

    // --- RENDERING ---
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update Camera
        if (bike && bike.chassis) {
            const targetX = bike.chassis.position.x + bike.chassis.velocity.x * 12;
            const targetY = bike.chassis.position.y + bike.chassis.velocity.y * 6;
            camera.x += (targetX - camera.x) * 0.08;
            camera.y += (targetY - camera.y) * 0.08;

            const speed = Math.hypot(bike.chassis.velocity.x, bike.chassis.velocity.y);
            camera.targetScale = Math.max(0.75, 1.05 - speed * 0.012);
            camera.scale += (camera.targetScale - camera.scale) * 0.05;
        }

        // Draw Sky & Parallax
        drawBackground();

        // World Coordinates Transformation
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(camera.scale, camera.scale);
        ctx.translate(-camera.x, -camera.y);

        // Draw Track
        drawTrack();

        // Draw Finish Flag
        drawFinishFlag();

        // Draw Particles
        drawParticles();

        // Draw Bike & Rider
        if (bike && bike.isAlive) {
            drawBike();
        }

        // Draw Drawing Preview for Editor
        if (isDrawing && drawStartPos) {
            ctx.save();
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 14;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(drawStartPos.x, drawStartPos.y);
            // Get current mouse pos in world
            ctx.lineTo(drawStartPos.x + 10, drawStartPos.y);
            ctx.stroke();
            ctx.restore();
        }

        // Draw Floating Reward Texts
        drawFloatingTexts();

        ctx.restore();

        // Update HUD
        renderHUD();
    }

    function drawBackground() {
        // Gradient Sky
        const skyColors = levelData ? levelData.skyGradient : ["#ff8800", "#ff3300", "#220000"];
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, skyColors[0]);
        grad.addColorStop(0.5, skyColors[1]);
        grad.addColorStop(1, skyColors[2]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Glowing Sun / Corona (Iconic Bike Race Sun)
        const sunX = canvas.width * 0.7 - (camera.x * 0.03) % canvas.width;
        const sunY = canvas.height * 0.35;
        const sunRadius = 90;

        const sunGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, sunRadius);
        sunGrad.addColorStop(0, levelData.sunColor || 'rgba(255, 240, 160, 0.95)');
        sunGrad.addColorStop(0.4, 'rgba(255, 180, 50, 0.4)');
        sunGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');

        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
        ctx.fill();

        // Distant Mountain Silhouettes (Parallax layers)
        drawParallaxMountains(0.08, canvas.height * 0.75, 140, 'rgba(40, 10, 5, 0.35)');
        drawParallaxMountains(0.18, canvas.height * 0.88, 80, 'rgba(20, 5, 2, 0.65)');
    }

    function drawParallaxMountains(factor, baseHeight, amplitude, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);

        const step = 80;
        const offsetX = (camera.x * factor) % (step * 4);

        for (let x = -step * 2; x <= canvas.width + step * 2; x += step) {
            const seed = Math.sin((x + offsetX) * 0.005) * 1.5 + Math.cos((x + offsetX) * 0.015);
            const y = baseHeight - Math.abs(seed) * amplitude;
            ctx.lineTo(x, y);
        }

        ctx.lineTo(canvas.width, canvas.height);
        ctx.closePath();
        ctx.fill();
    }

    function drawTrack() {
        // Shadow pass
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 16;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        trackBodies.forEach(body => {
            if (body.segmentData) {
                const s = body.segmentData;
                ctx.beginPath();
                ctx.moveTo(s.x1, s.y1 + 8);
                ctx.lineTo(s.x2, s.y2 + 8);
                ctx.stroke();
            }
        });

        // Main Track Lines (Bold black/charcoal with vibrant highlight edge)
        trackBodies.forEach(body => {
            if (body.segmentData) {
                const s = body.segmentData;
                ctx.lineWidth = s.thickness || 14;
                ctx.strokeStyle = '#181818';
                ctx.beginPath();
                ctx.moveTo(s.x1, s.y1);
                ctx.lineTo(s.x2, s.y2);
                ctx.stroke();

                // Sleek neon top edge
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#ff7700';
                ctx.beginPath();
                ctx.moveTo(s.x1, s.y1 - (s.thickness || 14) / 2 + 1);
                ctx.lineTo(s.x2, s.y2 - (s.thickness || 14) / 2 + 1);
                ctx.stroke();
            }
        });
    }

    function drawFinishFlag() {
        if (!levelData || !levelData.finish) return;
        const f = levelData.finish;

        // Pole
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(f.x - 3, f.y - 90, 6, 90);

        // Checkered waving flag
        const wave = Math.sin(performance.now() * 0.008) * 8;
        const flagWidth = 60;
        const flagHeight = 44;
        const flagX = f.x + 3;
        const flagY = f.y - 90;

        const cols = 5;
        const rows = 4;
        const cellW = flagWidth / cols;
        const cellH = flagHeight / rows;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const isBlack = (r + c) % 2 === 0;
                ctx.fillStyle = isBlack ? '#111111' : '#ffffff';
                const curWave = Math.sin((c / cols) * Math.PI + performance.now() * 0.008) * 5;

                ctx.fillRect(
                    flagX + c * cellW,
                    flagY + r * cellH + curWave,
                    cellW + 0.5,
                    cellH + 0.5
                );
            }
        }
    }

    function drawBike() {
        const chassis = bike.chassis;
        const rear = bike.rearWheel;
        const front = bike.frontWheel;
        const head = bike.head;

        // Draw Wheels
        drawWheel(rear);
        drawWheel(front);

        // Draw Suspension Forks / Swingarms
        ctx.strokeStyle = '#2b2b2b';
        ctx.lineWidth = 4;
        ctx.beginPath();
        // Rear swingarm
        ctx.moveTo(chassis.position.x - 6, chassis.position.y);
        ctx.lineTo(rear.position.x, rear.position.y);
        // Front telescopic fork
        ctx.moveTo(chassis.position.x + 14, chassis.position.y - 12);
        ctx.lineTo(front.position.x, front.position.y);
        ctx.stroke();

        // Draw Chassis (Motorcycle Silhouette Frame)
        ctx.save();
        ctx.translate(chassis.position.x, chassis.position.y);
        ctx.rotate(chassis.angle);

        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        // Sleek dirtbike fuel tank & body fairing
        ctx.moveTo(-28, -6);
        ctx.lineTo(-8, -14);
        ctx.lineTo(16, -15); // Handlebars mount
        ctx.lineTo(26, -5);
        ctx.lineTo(12, 12);  // Engine bottom
        ctx.lineTo(-18, 10);
        ctx.closePath();
        ctx.fill();

        // Handlebars
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.moveTo(12, -15);
        ctx.lineTo(18, -26);
        ctx.stroke();

        // Exhaust pipe
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#777777';
        ctx.beginPath();
        ctx.moveTo(-6, 6);
        ctx.lineTo(-24, 0);
        ctx.lineTo(-32, -4);
        ctx.stroke();

        ctx.restore();

        // Draw Rider (Iconic Bike Race Rider Silhouette)
        drawRider(chassis, head);
    }

    function drawWheel(wheel) {
        ctx.save();
        ctx.translate(wheel.position.x, wheel.position.y);
        ctx.rotate(wheel.angle);

        const r = wheel.circleRadius || 17;

        // Outer Tire (knobby dirtbike tire)
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // Rim
        ctx.fillStyle = '#333333';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
        ctx.fill();

        // Inner Hub
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // Spokes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            ctx.beginPath();
            ctx.moveTo(-Math.cos(angle) * r * 0.7, -Math.sin(angle) * r * 0.7);
            ctx.lineTo(Math.cos(angle) * r * 0.7, Math.sin(angle) * r * 0.7);
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawRider(chassis, head) {
        ctx.save();

        // Torso / Body (Leaning with bike)
        const neckX = head.position.x;
        const neckY = head.position.y + 10;
        const hipX = chassis.position.x - 14 * Math.cos(chassis.angle);
        const hipY = chassis.position.y - 14 * Math.sin(chassis.angle) - 4;

        // Arms to handlebars
        const handleX = chassis.position.x + 18 * Math.cos(chassis.angle) - 24 * Math.sin(chassis.angle);
        const handleY = chassis.position.y + 18 * Math.sin(chassis.angle) + 24 * Math.cos(chassis.angle) - 10;

        ctx.strokeStyle = '#050505';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Torso
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(neckX, neckY);
        ctx.stroke();

        // Arm
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(neckX, neckY + 4);
        ctx.lineTo((neckX + handleX) / 2 + 4, (neckY + handleY) / 2 + 6);
        ctx.lineTo(handleX, handleY);
        ctx.stroke();

        // Leg / Foot on peg
        const pegX = chassis.position.x - 2 * Math.cos(chassis.angle) + 8 * Math.sin(chassis.angle);
        const pegY = chassis.position.y - 2 * Math.sin(chassis.angle) + 8 * Math.cos(chassis.angle);

        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(hipX + 10, hipY + 12);
        ctx.lineTo(pegX, pegY);
        ctx.stroke();

        // Rider Helmet
        ctx.save();
        ctx.translate(head.position.x, head.position.y);
        ctx.rotate(chassis.angle);

        // Helmet shell
        ctx.fillStyle = '#050505';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();

        // Helmet Visor / Sun peak
        ctx.beginPath();
        ctx.moveTo(2, -8);
        ctx.lineTo(16, -5);
        ctx.lineTo(6, -2);
        ctx.closePath();
        ctx.fill();

        // Iconic Yellow Goggles! (Direct from the Bike Race icon)
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.ellipse(6, -1, 5, 3.5, 0.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        ctx.restore();
    }

    function drawParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;

            if (p.alpha <= 0) {
                particles.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawFloatingTexts() {
        for (let i = floatingTexts.length - 1; i >= 0; i--) {
            const t = floatingTexts[i];
            t.y += t.vy;
            t.alpha -= 0.018;

            if (t.alpha <= 0) {
                floatingTexts.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = t.alpha;
            ctx.font = 'bold 22px "Montserrat", sans-serif';
            ctx.fillStyle = t.color;
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 6;
            ctx.textAlign = 'center';
            ctx.fillText(t.text, t.x, t.y);
            ctx.restore();
        }
    }

    function renderHUD() {
        // Timer display
        const timerEl = document.getElementById('hudTimer');
        if (timerEl && isTimerRunning) {
            const elapsed = (performance.now() - startTime) / 1000;
            timerEl.textContent = elapsed.toFixed(2) + 's';
        }

        // Flips counter
        const flipsEl = document.getElementById('hudFlips');
        if (flipsEl) {
            flipsEl.textContent = `★ ${flips}`;
        }
    }

    function updateUIHUD() {
        const titleEl = document.getElementById('levelTitle');
        const descEl = document.getElementById('levelDesc');
        if (titleEl && levelData) titleEl.textContent = levelData.title;
        if (descEl && levelData) descEl.textContent = levelData.subtitle;

        // Highlight active level in dropdown
        const select = document.getElementById('levelSelect');
        if (select) select.value = currentLevelIndex;
    }

    // --- MAIN GAME LOOP ---
    function gameLoop(timestamp) {
        // Step Matter.js physics (16.6ms fixed step)
        Engine.update(engine, 1000 / 60);

        // Apply bike driving & tilt forces
        updatePhysics();

        // Render everything
        render();

        requestAnimationFrame(gameLoop);
    }

    // --- UI SETUP & EVENT HANDLERS ---
    function setupUI() {
        // Level select dropdown
        const select = document.getElementById('levelSelect');
        if (select) {
            select.innerHTML = '';
            LEVELS.forEach((lvl, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = `${idx + 1}. ${lvl.title}`;
                select.appendChild(opt);
            });
            select.addEventListener('change', (e) => {
                loadLevel(parseInt(e.target.value));
            });
        }

        // Restart button
        const btnRestart = document.getElementById('btnRestart');
        if (btnRestart) {
            btnRestart.addEventListener('click', () => {
                window.sounds.init();
                restartLevel();
            });
        }

        // Next Level Button on victory modal
        const btnNext = document.getElementById('btnNextLevel');
        if (btnNext) {
            btnNext.addEventListener('click', () => {
                window.sounds.init();
                const nextIdx = (currentLevelIndex + 1) % LEVELS.length;
                loadLevel(nextIdx);
            });
        }

        // Retry Button on crash modal
        const btnRetry = document.getElementById('btnRetry');
        if (btnRetry) {
            btnRetry.addEventListener('click', () => {
                window.sounds.init();
                restartLevel();
            });
        }

        // Sound Toggle
        const btnAudio = document.getElementById('btnAudio');
        if (btnAudio) {
            btnAudio.addEventListener('click', () => {
                window.sounds.init();
                const isMuted = window.sounds.toggleMute();
                btnAudio.textContent = isMuted ? '🔇' : '🔊';
            });
        }

        // Sandbox Toolbar Buttons
        const btnClearTrack = document.getElementById('btnClearTrack');
        if (btnClearTrack) {
            btnClearTrack.addEventListener('click', () => {
                customSegments = [];
                buildTrack(levelData);
                window.sounds.playClick();
            });
        }

        const btnExportTrack = document.getElementById('btnExportTrack');
        if (btnExportTrack) {
            btnExportTrack.addEventListener('click', () => {
                const json = JSON.stringify(customSegments);
                navigator.clipboard.writeText(json).then(() => {
                    alert('¡Pista copiada al portapapeles! Puedes compartir este código JSON con quien quieras.');
                });
            });
        }
    }

    // Start on DOM ready
    window.addEventListener('DOMContentLoaded', init);

})();
