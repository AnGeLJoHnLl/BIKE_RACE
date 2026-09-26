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

    // Screen shake
    let screenShake = 0;

    // Ejected ragdoll rider when crashed
    let ragdollRider = null;

    // --- BIKE CREATION ---
    function createBike(x, y) {
        const group = Body.nextGroup(true); // Non-colliding group for bike parts

        // True Motocross proportions (wide wheelbase, large dirtbike knobby tires)
        const wheelRadius = 21;
        const wheelDistance = 98; // Proper wide stance so it looks like a real dirt bike

        // Wheels
        const rearWheel = Bodies.circle(x - wheelDistance / 2, y + 14, wheelRadius, {
            collisionFilter: { group: group },
            friction: 1.1,
            frictionStatic: 1.8,
            density: 0.05,
            restitution: 0.12,
            label: 'rearWheel'
        });

        const frontWheel = Bodies.circle(x + wheelDistance / 2, y + 14, wheelRadius, {
            collisionFilter: { group: group },
            friction: 1.0,
            frictionStatic: 1.6,
            density: 0.045,
            restitution: 0.12,
            label: 'frontWheel'
        });

        // Motocross Chassis / Main Frame
        const chassis = Bodies.rectangle(x, y - 2, 78, 24, {
            collisionFilter: { group: group },
            density: 0.028,
            friction: 0.4,
            label: 'chassis'
        });

        // Rider Head & Torso Hitbox (Hits ground = CRASH!)
        const head = Bodies.circle(x - 6, y - 48, 16, {
            collisionFilter: { group: group },
            density: 0.012,
            restitution: 0.1,
            label: 'head'
        });

        // Rigid Head Mount to Chassis
        const headConstraint = Constraint.create({
            bodyA: chassis,
            pointA: { x: -6, y: -36 },
            bodyB: head,
            pointB: { x: 0, y: 0 },
            stiffness: 0.95,
            damping: 0.1,
            render: { visible: false }
        });

        // Realistic Motocross Suspension Constraints
        const rearSuspension = Constraint.create({
            bodyA: chassis,
            pointA: { x: -wheelDistance / 2 + 6, y: 12 },
            bodyB: rearWheel,
            pointB: { x: 0, y: 0 },
            stiffness: 0.8,
            damping: 0.22,
            length: 10
        });

        const frontSuspension = Constraint.create({
            bodyA: chassis,
            pointA: { x: wheelDistance / 2 - 6, y: 12 },
            bodyB: frontWheel,
            pointB: { x: 0, y: 0 },
            stiffness: 0.8,
            damping: 0.22,
            length: 10
        });

        // Axle wheelbase distance keeper to prevent distortion
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
            headConstraint,
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

        // Collision Handler (Head crash, inverted chassis crash & Finish line)
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

                // Head Crash detection (touching ground with helmet/rider)
                if ((bodyA.label === 'head' && bodyB.label === 'track') ||
                    (bodyB.label === 'head' && bodyA.label === 'track')) {
                    triggerCrash("¡Te has golpeado la cabeza!");
                    return;
                }

                // Inverted Chassis Crash (landing upside down or on bike back)
                if ((bodyA.label === 'chassis' && bodyB.label === 'track') ||
                    (bodyB.label === 'chassis' && bodyA.label === 'track')) {
                    const upFactor = Math.cos(bike.chassis.angle);
                    if (upFactor < 0.35) { // Tilted more than 65 degrees: upside down!
                        triggerCrash("¡Aterrizaje forzoso invertido!");
                        return;
                    }
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

    // --- 100-LEVEL PROGRESSION & STARS ---
    function getStarsForLevel(lvlNum) {
        return parseInt(localStorage.getItem(`bikerace_stars_lvl_${lvlNum}`)) || 0;
    }

    function setStarsForLevel(lvlNum, stars) {
        const cur = getStarsForLevel(lvlNum);
        if (stars > cur) {
            localStorage.setItem(`bikerace_stars_lvl_${lvlNum}`, stars);
        }
    }

    function getBestTimeForLevel(lvlNum) {
        return localStorage.getItem(`bikerace_best_lvl_${lvlNum}`) || null;
    }

    function setBestTimeForLevel(lvlNum, time) {
        const prev = parseFloat(getBestTimeForLevel(lvlNum)) || 9999;
        if (time < prev) {
            localStorage.setItem(`bikerace_best_lvl_${lvlNum}`, time.toFixed(2));
        }
    }

    function getTotalStars() {
        let total = 0;
        for (let i = 1; i <= 100; i++) {
            total += getStarsForLevel(i);
        }
        return total;
    }

    function isLevelUnlocked(lvlNum) {
        if (lvlNum === 1) return true;
        // Level N is unlocked if level N-1 has at least 1 star
        return getStarsForLevel(lvlNum - 1) >= 1;
    }

    let selectedWorldTab = 0; // 0 to 9

    function openLevelMap() {
        const modal = document.getElementById('levelMapModal');
        if (!modal) return;
        selectedWorldTab = Math.floor(currentLevelIndex / 10);
        renderLevelMap();
        modal.classList.add('active');
        window.sounds.playClick();
    }

    function closeLevelMap() {
        const modal = document.getElementById('levelMapModal');
        if (modal) modal.classList.remove('active');
    }

    function toggleLevelMap() {
        const modal = document.getElementById('levelMapModal');
        if (!modal) return;
        if (modal.classList.contains('active')) {
            closeLevelMap();
        } else {
            openLevelMap();
        }
    }

    function renderLevelMap() {
        const totalStars = getTotalStars();
        const badge = document.getElementById('mapTotalStarsBadge');
        if (badge) badge.textContent = `⭐ ${totalStars} / 300 Estrellas`;

        // Render World Tabs (10 Worlds)
        const tabsContainer = document.getElementById('worldsTabs');
        if (tabsContainer && window.WORLDS) {
            tabsContainer.innerHTML = '';
            WORLDS.forEach((w, wIdx) => {
                const btn = document.createElement('button');
                btn.className = `world-tab ${wIdx === selectedWorldTab ? 'active' : ''}`;
                btn.textContent = `M${w.id}: ${w.name}`;
                btn.onclick = () => {
                    selectedWorldTab = wIdx;
                    renderLevelMap();
                    window.sounds.playClick();
                };
                tabsContainer.appendChild(btn);
            });
        }

        // Render 10 Level Cards for selectedWorldTab
        const grid = document.getElementById('levelsGrid');
        if (grid) {
            grid.innerHTML = '';
            const startLevel = selectedWorldTab * 10 + 1;
            for (let i = 0; i < 10; i++) {
                const lvlNum = startLevel + i;
                const unlocked = isLevelUnlocked(lvlNum);
                const stars = getStarsForLevel(lvlNum);
                const bestTime = getBestTimeForLevel(lvlNum);
                const isCurrent = (currentLevelIndex === lvlNum - 1);

                const card = document.createElement('div');
                card.className = `level-card ${unlocked ? '' : 'locked'} ${isCurrent ? 'current' : ''}`;

                if (unlocked) {
                    let starsHtml = '';
                    for (let s = 1; s <= 3; s++) {
                        starsHtml += `<span class="${s <= stars ? 'star-gold' : ''}">★</span>`;
                    }

                    card.innerHTML = `
                        <div class="level-card-number">${lvlNum}</div>
                        <div class="level-card-stars">${starsHtml}</div>
                        <div class="level-card-time">${bestTime ? bestTime + 's' : '--'}</div>
                    `;

                    card.onclick = () => {
                        window.sounds.playClick();
                        closeLevelMap();
                        loadLevel(lvlNum - 1);
                    };
                } else {
                    card.innerHTML = `
                        <div class="level-card-number">${lvlNum}</div>
                        <div class="level-card-lock">🔒</div>
                    `;
                }

                grid.appendChild(card);
            }
        }
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

        // Reset stats & effects
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
        ragdollRider = null;
        screenShake = 0;

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
    function triggerCrash(reason = "¡Te has caído!") {
        if (gameState !== STATE.PLAYING) return;
        gameState = STATE.CRASHED;
        bike.isAlive = false;
        isTimerRunning = false;
        window.sounds.playCrash();
        screenShake = 22;

        // Eject ragdoll rider into the air!
        const chassis = bike.chassis;
        const head = bike.head;
        ragdollRider = {
            x: head.position.x,
            y: head.position.y,
            vx: chassis.velocity.x * 1.15 + (Math.random() - 0.5) * 6,
            vy: Math.min(chassis.velocity.y, 0) - 8,
            angle: chassis.angle,
            vRot: (Math.random() - 0.5) * 0.45,
            alpha: 1.0
        };

        // Spawn impact sparks & smoke particles
        for (let i = 0; i < 45; i++) {
            particles.push({
                x: head.position.x,
                y: head.position.y,
                vx: (Math.random() - 0.5) * 18,
                vy: (Math.random() - 0.7) * 18,
                size: Math.random() * 6 + 3,
                color: ['#ff4500', '#ffa500', '#ffd700', '#ffffff', '#111111'][Math.floor(Math.random() * 5)],
                alpha: 1.0,
                decay: 0.02 + Math.random() * 0.025
            });
        }

        // Show Crash Overlay with the specific reason
        setTimeout(() => {
            const crashModal = document.getElementById('crashModal');
            if (crashModal) {
                const sub = crashModal.querySelector('.modal-subtitle');
                if (sub) sub.textContent = reason;
                crashModal.classList.add('active');
            }
        }, 550);
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

        // Calculate Stars (1, 2, or 3)
        const starTimes = levelData.starTimes;
        let starsEarned = 1;
        if (finalTime <= starTimes[2]) {
            starsEarned = 3;
        } else if (finalTime <= starTimes[1]) {
            starsEarned = 2;
        }

        const levelNum = currentLevelIndex + 1;
        setStarsForLevel(levelNum, starsEarned);
        setBestTimeForLevel(levelNum, finalTime);

        updateUIHUD();

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
        const mapModal = document.getElementById('levelMapModal');
        if (crashModal) crashModal.classList.remove('active');
        if (victoryModal) victoryModal.classList.remove('active');
        if (mapModal) mapModal.classList.remove('active');
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
            if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                toggleLevelMap();
            }
            if (e.key === 'Escape') {
                closeLevelMap();
            }
        });

        window.addEventListener('keyup', e => {
            if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') input.gas = false;
            if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') input.brake = false;
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.leanLeft = false;
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.leanRight = false;
        });

        // Left / Right Screen Touch Driving (tapping left half = brake, right half = gas)
        canvas.addEventListener('touchstart', handleCanvasTouch, { passive: false });
        canvas.addEventListener('touchmove', handleCanvasTouch, { passive: false });
        canvas.addEventListener('touchend', clearCanvasTouch, { passive: false });
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

        // Check if bike fell into the abyss / void below the track
        let lowestTrackY = 600;
        if (trackBodies.length > 0) {
            for (let i = 0; i < trackBodies.length; i++) {
                const s = trackBodies[i].segmentData;
                if (s) {
                    if (s.y1 > lowestTrackY) lowestTrackY = s.y1;
                    if (s.y2 > lowestTrackY) lowestTrackY = s.y2;
                }
            }
        }
        if (chassis.position.y > lowestTrackY + 200 || chassis.position.x < -250) {
            triggerCrash("¡Caíste al abismo!");
            return;
        }

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

        // Screen Shake calculation
        let shakeX = 0;
        let shakeY = 0;
        if (screenShake > 0) {
            shakeX = (Math.random() - 0.5) * screenShake;
            shakeY = (Math.random() - 0.5) * screenShake;
            screenShake *= 0.88;
            if (screenShake < 0.4) screenShake = 0;
        }

        // World Coordinates Transformation
        ctx.save();
        ctx.translate(canvas.width / 2 + shakeX, canvas.height / 2 + shakeY);
        ctx.scale(camera.scale, camera.scale);
        ctx.translate(-camera.x, -camera.y);

        // Draw Track
        drawTrack();

        // Draw Finish Flag
        drawFinishFlag();

        // Draw Particles
        drawParticles();

        // Draw Motocross Bike (Draw even when crashed so it tumbles realistically!)
        if (bike) {
            drawBike();
        }

        // Draw Ejected Ragdoll Rider if crashed
        if (ragdollRider) {
            drawRagdollRider();
        }

        // Draw Drawing Preview for Editor
        if (isDrawing && drawStartPos) {
            ctx.save();
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 14;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(drawStartPos.x, drawStartPos.y);
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

        // Distant Mountain Silhouettes (Parallax layers colored by world)
        const mCol1 = (levelData && levelData.mountainColor1) || 'rgba(40, 10, 5, 0.35)';
        const mCol2 = (levelData && levelData.mountainColor2) || 'rgba(20, 5, 2, 0.65)';
        drawParallaxMountains(0.08, canvas.height * 0.75, 140, mCol1);
        drawParallaxMountains(0.18, canvas.height * 0.88, 80, mCol2);
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

        // 1. Draw Wheels at physical body locations with rolling rotation
        drawWheel(rear);
        drawWheel(front);

        // 2. Draw Motocross Frame, Plastics, Engine, Suspension & Rider
        ctx.save();
        ctx.translate(chassis.position.x, chassis.position.y);
        ctx.rotate(chassis.angle);

        // Rear Heavy-Duty Swingarm
        ctx.strokeStyle = '#181818';
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-10, 6);
        ctx.lineTo(-49, 14);
        ctx.stroke();

        // Rear Monoshock with bright red coil spring
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#cccccc'; // Damper rod
        ctx.beginPath();
        ctx.moveTo(-10, -6);
        ctx.lineTo(-30, 10);
        ctx.stroke();

        // Coiled Spring around shock
        ctx.strokeStyle = '#ff2200';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        const shockSteps = 5;
        for (let i = 0; i <= shockSteps; i++) {
            const t = i / shockSteps;
            const sx = -10 + (-30 - (-10)) * t;
            const sy = -6 + (10 - (-6)) * t;
            const offset = (i % 2 === 0 ? -4 : 4);
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx + offset, sy);
        }
        ctx.stroke();

        // Rear Chain & Sprocket
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(-49, 14, 11, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-49, 3);
        ctx.lineTo(-10, -1);
        ctx.moveTo(-49, 25);
        ctx.lineTo(-10, 13);
        ctx.stroke();

        // Front Upside-Down Suspension Forks (Stanchions & Chrome sliders)
        // Golden upper forks
        ctx.strokeStyle = '#d4a017';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(28, -22);
        ctx.lineTo(39, -4);
        ctx.stroke();

        // Chrome lower sliders
        ctx.strokeStyle = '#e6e6e6';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(39, -4);
        ctx.lineTo(49, 14);
        ctx.stroke();

        // Fork guards / brake mount
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(44, 4, 6, 8);

        // Engine Crankcase & Cylinder with cooling fins
        ctx.fillStyle = '#1f1f1f';
        ctx.beginPath();
        ctx.arc(-2, 8, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#2c2c2c';
        // Cooling fins
        for (let f = 0; f < 4; f++) {
            ctx.fillRect(4, -3 + f * 3, 10, 1.8);
        }

        // Exhaust Header Pipe & Upswept Motocross Muffler
        ctx.strokeStyle = '#b87333'; // Heat-colored bronze/copper
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.quadraticCurveTo(8, 14, -2, 14);
        ctx.lineTo(-18, 6);
        ctx.stroke();

        // Muffler canister
        ctx.fillStyle = '#444444';
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-20, 7);
        ctx.lineTo(-58, -8);
        ctx.lineTo(-56, -16);
        ctx.lineTo(-18, -1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Muffler tip
        ctx.fillStyle = '#ff5500';
        ctx.fillRect(-59, -13, 3, 4);

        // Motocross Body Plastics & Tank (Sharp, aggressive silhouette)
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.moveTo(28, -22); // Triple clamp
        ctx.lineTo(8, -16);  // Tank dip
        ctx.lineTo(-36, -16); // Seat bed
        ctx.lineTo(-78, -32); // High pointed rear fender tip!
        ctx.lineTo(-70, -20); // Rear fender bottom edge
        ctx.lineTo(-30, -8);  // Side number plate
        ctx.lineTo(-12, 4);   // Frame pivot
        ctx.lineTo(12, 4);    // Front cradle
        ctx.lineTo(24, -14);  // Shroud front
        ctx.closePath();
        ctx.fill();

        // Signature High Motocross Front Fender (Beak / Guardabarros delantero)
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.moveTo(26, -20);
        ctx.lineTo(70, -28); // Sharp beak extending way over front wheel!
        ctx.lineTo(66, -21);
        ctx.lineTo(28, -14);
        ctx.closePath();
        ctx.fill();

        // Bold Orange Racing Accents (Signature Bike Race Style)
        ctx.strokeStyle = '#ff5500';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        // Front fender edge
        ctx.moveTo(26, -20);
        ctx.lineTo(70, -28);
        // Tank shroud decal
        ctx.moveTo(22, -18);
        ctx.lineTo(6, -14);
        ctx.lineTo(14, -4);
        // Rear fender top edge
        ctx.moveTo(-34, -16);
        ctx.lineTo(-78, -32);
        ctx.stroke();

        // Motocross Flat Gripper Seat
        ctx.fillStyle = '#1c1c1c';
        ctx.beginPath();
        ctx.moveTo(6, -16);
        ctx.lineTo(-36, -16);
        ctx.lineTo(-34, -20);
        ctx.lineTo(4, -20);
        ctx.closePath();
        ctx.fill();

        // Handlebars & Crossbar
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(28, -22);
        ctx.lineTo(22, -42);
        ctx.stroke();

        // Crossbar
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#888';
        ctx.beginPath();
        ctx.moveTo(24, -36);
        ctx.lineTo(21, -36);
        ctx.stroke();

        // Rubber grips
        ctx.fillStyle = '#ff5500';
        ctx.fillRect(19, -44, 6, 4);

        // Draw Rider on top of the bike (if alive)
        if (bike.isAlive) {
            drawRiderOnBike();
        }

        ctx.restore();
    }

    function drawRiderOnBike() {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Foot & Motocross Boot on footpeg
        ctx.fillStyle = '#050505';
        ctx.beginPath();
        ctx.moveTo(-6, 12);
        ctx.lineTo(4, 12);
        ctx.lineTo(2, 6);
        ctx.lineTo(-6, 6);
        ctx.closePath();
        ctx.fill();

        // Leg (Shin & bent knee hugging tank)
        ctx.strokeStyle = '#080808';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(-4, 8);
        ctx.lineTo(8, -8);   // Knee
        ctx.lineTo(-18, -18); // Hip on seat
        ctx.stroke();

        // Torso in athletic attack position
        ctx.lineWidth = 15;
        ctx.beginPath();
        ctx.moveTo(-18, -18); // Hip
        ctx.lineTo(6, -44);   // Shoulder
        ctx.stroke();

        // Arm reaching forward to handlebars
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(6, -44);   // Shoulder
        ctx.lineTo(16, -32);  // Elbow
        ctx.lineTo(22, -42);  // Hand on grip
        ctx.stroke();

        // Helmet & Head
        // Helmet shell
        ctx.fillStyle = '#080808';
        ctx.beginPath();
        ctx.arc(8, -58, 14, 0, Math.PI * 2);
        ctx.fill();

        // Sharp Motocross Helmet Visor / Peak
        ctx.beginPath();
        ctx.moveTo(14, -66);
        ctx.lineTo(36, -63); // Sun peak jutting forward!
        ctx.lineTo(22, -59);
        ctx.closePath();
        ctx.fill();

        // Chin guard
        ctx.beginPath();
        ctx.moveTo(22, -50);
        ctx.lineTo(12, -46);
        ctx.lineTo(8, -50);
        ctx.closePath();
        ctx.fill();

        // Signature Bright Yellow Goggles (From Bike Race Icon)
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.ellipse(15, -57, 6.5, 4, 0.12, 0, Math.PI * 2);
        ctx.fill();

        // Goggle glass reflection highlight
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(14, -58, 2.5, 1.2, 0.12, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function drawWheel(wheel) {
        ctx.save();
        ctx.translate(wheel.position.x, wheel.position.y);
        ctx.rotate(wheel.angle);

        const r = wheel.circleRadius || 21;

        // Knobby Tire Treads (Dirtbike Knobs)
        ctx.fillStyle = '#111111';
        const numKnobs = 14;
        for (let i = 0; i < numKnobs; i++) {
            const angle = (i * Math.PI * 2) / numKnobs;
            ctx.save();
            ctx.rotate(angle);
            ctx.fillRect(-2.5, -r - 3, 5, 3.5);
            ctx.restore();
        }

        // Tire Outer Rubber Ring
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // Rim
        ctx.fillStyle = '#262626';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2);
        ctx.fill();

        // Steel Brake Rotor Disc
        ctx.fillStyle = '#555555';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.44, 0, Math.PI * 2);
        ctx.fill();

        // Center Axle Hub
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
        ctx.fill();

        // Spokes
        ctx.strokeStyle = 'rgba(230, 230, 230, 0.65)';
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            ctx.beginPath();
            ctx.moveTo(-Math.cos(angle) * r * 0.72, -Math.sin(angle) * r * 0.72);
            ctx.lineTo(Math.cos(angle) * r * 0.72, Math.sin(angle) * r * 0.72);
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawRagdollRider() {
        if (!ragdollRider) return;
        ctx.save();
        ctx.translate(ragdollRider.x, ragdollRider.y);
        ctx.rotate(ragdollRider.angle);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Tumbling Torso
        ctx.strokeStyle = '#080808';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(-10, 14);
        ctx.lineTo(10, -14);
        ctx.stroke();

        // Flailing Arms
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(10, -14);
        ctx.lineTo(24, -28);
        ctx.moveTo(10, -14);
        ctx.lineTo(28, 2);
        ctx.stroke();

        // Flailing Legs
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(-10, 14);
        ctx.lineTo(-26, 24);
        ctx.moveTo(-10, 14);
        ctx.lineTo(-14, 36);
        ctx.stroke();

        // Tumbling Helmet
        ctx.fillStyle = '#080808';
        ctx.beginPath();
        ctx.arc(14, -26, 14, 0, Math.PI * 2);
        ctx.fill();

        // Visor
        ctx.beginPath();
        ctx.moveTo(18, -34);
        ctx.lineTo(38, -30);
        ctx.lineTo(26, -25);
        ctx.closePath();
        ctx.fill();

        // Goggles
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.ellipse(20, -25, 6, 3.5, 0.1, 0, Math.PI * 2);
        ctx.fill();

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
        const totalStars = getTotalStars();
        const totalStarsEl = document.getElementById('hudTotalStars');
        if (totalStarsEl) {
            totalStarsEl.textContent = `⭐ ${totalStars}/300`;
        }

        const currentLvlNameEl = document.getElementById('currentLevelName');
        if (currentLvlNameEl && levelData) {
            currentLvlNameEl.textContent = `Mundo ${levelData.worldId} - Nvl ${levelData.stage}`;
        }
    }

    // --- RAGDOLL UPDATE ---
    function updateRagdoll() {
        if (!ragdollRider) return;
        ragdollRider.vy += 0.52; // gravity
        ragdollRider.vx *= 0.99;
        ragdollRider.x += ragdollRider.vx;
        ragdollRider.y += ragdollRider.vy;
        ragdollRider.angle += ragdollRider.vRot;
    }

    // --- MAIN GAME LOOP ---
    function gameLoop(timestamp) {
        // Step Matter.js physics (16.6ms fixed step)
        Engine.update(engine, 1000 / 60);

        // Apply bike driving & tilt forces
        updatePhysics();
        updateRagdoll();

        // Render everything
        render();

        requestAnimationFrame(gameLoop);
    }

    // --- UI SETUP & EVENT HANDLERS ---
    function setupUI() {
        // Map Modal Trigger Buttons
        const btnOpenMap = document.getElementById('btnOpenMap');
        if (btnOpenMap) {
            btnOpenMap.addEventListener('click', () => {
                window.sounds.init();
                openLevelMap();
            });
        }

        const btnCloseMap = document.getElementById('btnCloseMap');
        if (btnCloseMap) {
            btnCloseMap.addEventListener('click', () => {
                closeLevelMap();
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
                const nextIdx = Math.min(currentLevelIndex + 1, LEVELS.length - 1);
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
    }

    // Start on DOM ready
    window.addEventListener('DOMContentLoaded', init);

})();
