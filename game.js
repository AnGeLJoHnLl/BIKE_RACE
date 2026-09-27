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
    window.getTotalStars = getTotalStars;

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

    // --- GARAGE & SKINS CONTROLLER ---
    let selectedGarageSkinId = window.skinManager ? window.skinManager.getActiveSkin().id : 'classic';
    let garageAnimFrameId = null;
    let garagePreviewParticles = [];

    function openGarage() {
        const modal = document.getElementById('garageModal');
        if (!modal) return;
        selectedGarageSkinId = window.skinManager ? window.skinManager.getActiveSkin().id : 'classic';
        updateGarageUI();
        modal.classList.add('active');
        startGaragePreview();
        window.sounds.playClick();
    }

    function closeGarage() {
        const modal = document.getElementById('garageModal');
        if (modal) modal.classList.remove('active');
        if (garageAnimFrameId) {
            cancelAnimationFrame(garageAnimFrameId);
            garageAnimFrameId = null;
        }
    }

    function toggleGarage() {
        const modal = document.getElementById('garageModal');
        if (!modal) return;
        if (modal.classList.contains('active')) {
            closeGarage();
        } else {
            openGarage();
        }
    }

    function selectGarageSkin(skinId) {
        selectedGarageSkinId = skinId;
        updateGarageUI();
        window.sounds.playClick();
    }

    function updateGarageUI() {
        const totalStars = getTotalStars();
        const badge = document.getElementById('garageStarsBadge');
        if (badge) badge.textContent = `⭐ ${totalStars} / 300 Estrellas`;

        const skin = window.BIKE_SKINS ? window.BIKE_SKINS.find(s => s.id === selectedGarageSkinId) : null;
        if (!skin) return;

        const isUnlocked = window.skinManager ? window.skinManager.isUnlocked(skin.id) : (skin.requiredStars === 0);
        const isEquipped = window.skinManager ? (window.skinManager.getActiveSkin().id === skin.id) : false;

        const nameEl = document.getElementById('previewBikeName');
        const taglineEl = document.getElementById('previewBikeTagline');
        const statusEl = document.getElementById('previewBikeLockStatus');
        const btnEquip = document.getElementById('btnEquipBike');

        if (nameEl) nameEl.textContent = skin.name;
        if (taglineEl) taglineEl.textContent = skin.tagline;

        if (statusEl) {
            if (isEquipped) {
                statusEl.textContent = '✅ EN USO';
                statusEl.className = 'bike-status-badge unlocked';
            } else if (isUnlocked) {
                statusEl.textContent = '✅ DESBLOQUEADA';
                statusEl.className = 'bike-status-badge unlocked';
            } else {
                const diff = skin.requiredStars - totalStars;
                statusEl.textContent = `🔒 ${skin.requiredStars} ⭐ (Faltan ${diff > 0 ? diff : 0})`;
                statusEl.className = 'bike-status-badge locked';
            }
        }

        if (btnEquip) {
            if (isEquipped) {
                btnEquip.textContent = 'EQUIPADA';
                btnEquip.disabled = true;
                btnEquip.className = 'btn-secondary';
            } else if (isUnlocked) {
                btnEquip.textContent = 'EQUIPAR MOTO';
                btnEquip.disabled = false;
                btnEquip.className = 'btn-primary';
                btnEquip.onclick = () => {
                    if (window.skinManager) {
                        window.skinManager.setActiveSkin(skin.id);
                        updateGarageUI();
                        window.sounds.playClick();
                    }
                };
            } else {
                btnEquip.textContent = 'BLOQUEADA';
                btnEquip.disabled = true;
                btnEquip.className = 'btn-secondary';
                btnEquip.onclick = null;
            }
        }

        // Render bikes grid cards
        const grid = document.getElementById('garageBikesGrid');
        if (grid && window.BIKE_SKINS) {
            grid.innerHTML = '';
            const skinIcons = {
                'classic': '🏍️',
                'fire_demon': '👹',
                'police': '🚓',
                'ninja': '🥷',
                'cyber': '⚡',
                'ghost': '💀',
                'golden': '👑'
            };

            BIKE_SKINS.forEach(s => {
                const unlocked = window.skinManager ? window.skinManager.isUnlocked(s.id) : (s.requiredStars === 0);
                const equipped = window.skinManager ? (window.skinManager.getActiveSkin().id === s.id) : false;
                const isSelected = (s.id === selectedGarageSkinId);

                const card = document.createElement('div');
                card.className = `garage-bike-card ${isSelected ? 'active' : ''} ${equipped ? 'equipped' : ''} ${unlocked ? '' : 'locked'}`;

                const icon = skinIcons[s.id] || '🏍️';
                const starsText = s.requiredStars === 0 ? 'Gratis' : `⭐ ${s.requiredStars}`;

                card.innerHTML = `
                    <div class="card-bike-icon">${icon}</div>
                    <div class="card-bike-name">${s.name}</div>
                    <div class="card-bike-stars">${unlocked ? (equipped ? '★ En uso' : '✓ Libre') : starsText}</div>
                `;

                card.onclick = () => {
                    selectGarageSkin(s.id);
                };

                grid.appendChild(card);
            });
        }
    }
    window.updateGarageUI = updateGarageUI;

    function startGaragePreview() {
        if (garageAnimFrameId) {
            cancelAnimationFrame(garageAnimFrameId);
        }
        garagePreviewParticles = [];
        const canvasPreview = document.getElementById('garagePreviewCanvas');
        if (!canvasPreview) return;
        const pCtx = canvasPreview.getContext('2d');

        function loop(timestamp) {
            const modal = document.getElementById('garageModal');
            if (!modal || !modal.classList.contains('active')) {
                garageAnimFrameId = null;
                return;
            }

            pCtx.clearRect(0, 0, canvasPreview.width, canvasPreview.height);

            const skin = window.BIKE_SKINS ? window.BIKE_SKINS.find(s => s.id === selectedGarageSkinId) : null;
            if (skin) {
                // Background subtle podium glow
                const grad = pCtx.createRadialGradient(240, 130, 20, 240, 130, 220);
                grad.addColorStop(0, (skin.colors.accent || '#8a2be2') + '33');
                grad.addColorStop(1, 'rgba(10, 5, 15, 0.85)');
                pCtx.fillStyle = grad;
                pCtx.fillRect(0, 0, canvasPreview.width, canvasPreview.height);

                // Grid floor lines for high tech feel
                pCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                pCtx.lineWidth = 1;
                for (let x = 40; x < canvasPreview.width; x += 40) {
                    pCtx.beginPath();
                    pCtx.moveTo(x, 150);
                    pCtx.lineTo(x + (x - 240) * 0.45, 230);
                    pCtx.stroke();
                }
                for (let y = 150; y < 230; y += 20) {
                    pCtx.beginPath();
                    pCtx.moveTo(0, y);
                    pCtx.lineTo(canvasPreview.width, y);
                    pCtx.stroke();
                }

                // Smooth idle hover suspension bounce
                const bounce = Math.sin(timestamp * 0.0035) * 3;
                const bikeY = 126 + bounce;
                const bikeX = 240;
                const wheelAngle = timestamp * 0.003;

                // Ground shadow beneath bike
                pCtx.save();
                pCtx.fillStyle = 'rgba(0, 0, 0, 0.55)';
                pCtx.beginPath();
                pCtx.ellipse(bikeX, 168, 66 - bounce * 1.5, 9, 0, 0, Math.PI * 2);
                pCtx.fill();
                pCtx.restore();

                // Emit preview exhaust particles
                if (Math.random() < 0.45) {
                    const exX = bikeX - 34;
                    const exY = bikeY + 2;
                    let pColor = '#ff6600';
                    let pSize = 3 + Math.random() * 3;
                    const pType = skin.particleType || 'smoke';
                    if (pType === 'fire') {
                        pColor = ['#ff0000', '#ff3300', '#ff8800', '#ffee00'][Math.floor(Math.random() * 4)];
                    } else if (pType === 'police_siren') {
                        pColor = Math.random() < 0.5 ? '#ff0033' : '#0066ff';
                    } else if (pType === 'plasma_green') {
                        pColor = Math.random() < 0.6 ? '#00ff44' : '#aaff00';
                    } else if (pType === 'cyber_trail') {
                        pColor = Math.random() < 0.5 ? '#00f0ff' : '#ff0077';
                    } else if (pType === 'ghost_aura') {
                        pColor = Math.random() < 0.5 ? '#9d4edd' : '#e0aaff';
                    } else if (pType === 'gold_sparkles') {
                        pColor = Math.random() < 0.4 ? '#ffffff' : '#ffd700';
                    }

                    garagePreviewParticles.push({
                        x: exX,
                        y: exY,
                        vx: -1.5 - Math.random() * 2,
                        vy: (Math.random() - 0.5) * 1.2,
                        size: pSize,
                        color: pColor,
                        alpha: 0.85,
                        decay: 0.03
                    });
                }

                // Render and update preview particles
                for (let i = garagePreviewParticles.length - 1; i >= 0; i--) {
                    const p = garagePreviewParticles[i];
                    p.x += p.vx;
                    p.y += p.vy;
                    p.alpha -= p.decay;
                    if (p.alpha <= 0) {
                        garagePreviewParticles.splice(i, 1);
                        continue;
                    }
                    pCtx.save();
                    pCtx.globalAlpha = p.alpha;
                    pCtx.fillStyle = p.color;
                    pCtx.beginPath();
                    pCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    pCtx.fill();
                    pCtx.restore();
                }

                // Fake bike state for preview
                const previewBikeState = {
                    chassis: {
                        position: { x: bikeX, y: bikeY },
                        angle: 0
                    },
                    rearWheel: {
                        position: { x: bikeX - 49, y: bikeY + 14 },
                        angle: wheelAngle,
                        circleRadius: 21
                    },
                    frontWheel: {
                        position: { x: bikeX + 49, y: bikeY + 14 },
                        angle: wheelAngle,
                        circleRadius: 21
                    },
                    isAlive: true
                };

                drawBike(skin, pCtx, previewBikeState);
            }

            garageAnimFrameId = requestAnimationFrame(loop);
        }

        garageAnimFrameId = requestAnimationFrame(loop);
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
        closeGarage();
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
            if (e.key === 'g' || e.key === 'G') {
                e.preventDefault();
                toggleGarage();
            }
            if (e.key === 'Escape') {
                closeLevelMap();
                closeGarage();
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

            // Exhaust particles with skin-specific effects
            if (Math.random() < 0.65) {
                const angle = chassis.angle;
                const exhaustX = chassis.position.x - Math.cos(angle) * 32;
                const exhaustY = chassis.position.y - Math.sin(angle) * 32 + 4;
                const activeSkin = window.skinManager ? window.skinManager.getActiveSkin() : (window.BIKE_SKINS ? window.BIKE_SKINS[0] : null);
                const pType = activeSkin ? (activeSkin.particleType || 'smoke') : 'smoke';

                let pColor = Math.random() < 0.3 ? '#ff6600' : 'rgba(200, 200, 200, 0.7)';
                let pVx = -Math.cos(angle) * (3 + Math.random() * 4) + (Math.random() - 0.5) * 2;
                let pVy = -Math.sin(angle) * (3 + Math.random() * 4) + (Math.random() - 0.5) * 2;
                let pSize = Math.random() * 4 + 2;
                let pDecay = 0.035;

                if (pType === 'fire') {
                    pColor = ['#ff0000', '#ff3300', '#ff8800', '#ffee00'][Math.floor(Math.random() * 4)];
                    pSize = Math.random() * 5 + 3;
                    pDecay = 0.04;
                } else if (pType === 'police_siren') {
                    pColor = Math.random() < 0.5 ? '#ff0033' : '#0066ff';
                    pSize = Math.random() * 4 + 2.5;
                } else if (pType === 'plasma_green') {
                    pColor = Math.random() < 0.6 ? '#00ff44' : '#aaff00';
                    pSize = Math.random() * 4 + 2.5;
                } else if (pType === 'cyber_trail') {
                    pColor = Math.random() < 0.5 ? '#00f0ff' : '#ff0077';
                    pSize = Math.random() * 3.5 + 2;
                    pDecay = 0.025;
                } else if (pType === 'ghost_aura') {
                    pColor = Math.random() < 0.5 ? '#9d4edd' : '#e0aaff';
                    pVy -= 1.8; // Ghostly soul mist rises up
                    pSize = Math.random() * 5 + 2;
                    pDecay = 0.03;
                } else if (pType === 'gold_sparkles') {
                    pColor = Math.random() < 0.4 ? '#ffffff' : (Math.random() < 0.7 ? '#ffd700' : '#ffe066');
                    pSize = Math.random() * 4 + 1.5;
                    pDecay = 0.03;
                }

                particles.push({
                    x: exhaustX,
                    y: exhaustY,
                    vx: pVx,
                    vy: pVy,
                    size: pSize,
                    color: pColor,
                    alpha: 0.85,
                    decay: pDecay
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

    function drawBike(targetSkin, targetCtx, targetBikeState) {
        const c = targetCtx || ctx;
        const b = targetBikeState || bike;
        if (!b || !b.chassis) return;

        const skin = targetSkin || (window.skinManager ? window.skinManager.getActiveSkin() : (window.BIKE_SKINS ? window.BIKE_SKINS[0] : null));
        if (!skin) return;

        const colors = skin.colors || {};
        const shape = skin.shape || 'motocross';

        const chassis = b.chassis;
        const rear = b.rearWheel;
        const front = b.frontWheel;

        // 1. Draw Wheels at physical or simulated locations with custom skin & wheelType
        if (rear) drawWheel(rear, skin, c);
        if (front) drawWheel(front, skin, c);

        // 2. Draw Frame, Plastics, Suspension, Engine & Rider
        c.save();
        c.translate(chassis.position.x, chassis.position.y);
        c.rotate(chassis.angle);

        // Rear Swingarm
        c.strokeStyle = '#181818';
        c.lineWidth = 7;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(-10, 6);
        c.lineTo(-49, 14);
        c.stroke();

        // Rear Monoshock damper rod
        c.lineWidth = 3;
        c.strokeStyle = colors.sliders || '#cccccc';
        c.beginPath();
        c.moveTo(-10, -6);
        c.lineTo(-30, 10);
        c.stroke();

        // Coiled Spring around shock
        c.strokeStyle = colors.spring || '#ff2200';
        c.lineWidth = 3.5;
        c.beginPath();
        const shockSteps = 5;
        for (let i = 0; i <= shockSteps; i++) {
            const t = i / shockSteps;
            const sx = -10 + (-30 - (-10)) * t;
            const sy = -6 + (10 - (-6)) * t;
            const offset = (i % 2 === 0 ? -4 : 4);
            if (i === 0) c.moveTo(sx, sy);
            else c.lineTo(sx + offset, sy);
        }
        c.stroke();

        // Rear Chain & Sprocket
        c.fillStyle = '#111';
        c.beginPath();
        c.arc(-49, 14, 11, 0, Math.PI * 2);
        c.fill();

        c.strokeStyle = '#888888';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(-49, 3);
        c.lineTo(-10, -1);
        c.moveTo(-49, 25);
        c.lineTo(-10, 13);
        c.stroke();

        // Front Upside-Down Suspension Forks
        // Upper forks
        c.strokeStyle = colors.forks || '#d4a017';
        c.lineWidth = 6;
        c.beginPath();
        c.moveTo(28, -22);
        c.lineTo(39, -4);
        c.stroke();

        // Lower sliders
        c.strokeStyle = colors.sliders || '#e6e6e6';
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(39, -4);
        c.lineTo(49, 14);
        c.stroke();

        // Fork guards / brake mount
        c.fillStyle = colors.body || '#0a0a0a';
        c.fillRect(44, 4, 6, 8);

        // Engine Bay: Crankcase, Cooling fins, or custom Core
        if (shape === 'ghost') {
            // Skeletal vertebrae & ribcage engine
            c.fillStyle = '#e8e4db';
            c.beginPath();
            c.arc(-2, 6, 11, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = '#f0ede6';
            c.lineWidth = 2.8;
            for (let r = 0; r < 4; r++) {
                c.beginPath();
                c.arc(-10 + r * 6, 4, 8, 0.4, 2.5);
                c.stroke();
            }
        } else if (shape === 'cyber') {
            // Cyber pulse reactor core
            c.fillStyle = '#080014';
            c.beginPath();
            c.arc(-2, 8, 13, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = colors.accent || '#00f0ff';
            c.lineWidth = 2;
            c.stroke();
            c.fillStyle = colors.secondaryAccent || '#ff0077';
            c.beginPath();
            c.arc(-2, 8, 6, 0, Math.PI * 2);
            c.fill();
        } else {
            // Performance engine crankcase & cooling fins
            c.fillStyle = '#1f1f1f';
            c.beginPath();
            c.arc(-2, 8, 12, 0, Math.PI * 2);
            c.fill();

            c.fillStyle = '#2c2c2c';
            for (let f = 0; f < 4; f++) {
                c.fillRect(4, -3 + f * 3, 10, 1.8);
            }
        }

        // Exhaust Header Pipe
        c.strokeStyle = colors.exhaust || '#b87333';
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(10, 0);
        c.quadraticCurveTo(8, 14, -2, 14);
        c.lineTo(-18, 6);
        c.stroke();

        // Custom Muffler by Shape
        if (shape === 'demon') {
            // Demon dual undertail magma exhausts
            c.fillStyle = '#ff1100';
            c.beginPath();
            c.moveTo(-20, 7);
            c.lineTo(-64, -12);
            c.lineTo(-60, -20);
            c.lineTo(-18, -1);
            c.closePath();
            c.fill();
            c.fillStyle = '#ff9900';
            c.fillRect(-66, -16, 4, 6);
        } else if (shape === 'golden') {
            // Dual polished 24K gold megaphone exhausts
            c.fillStyle = '#ffd700';
            c.strokeStyle = '#ffffff';
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(-20, 7);
            c.lineTo(-62, -10);
            c.lineTo(-60, -22);
            c.lineTo(-18, -1);
            c.closePath();
            c.fill();
            c.stroke();
            c.fillStyle = '#ffffff';
            c.fillRect(-64, -18, 3, 7);
        } else {
            // Standard upswept canister muffler
            c.fillStyle = colors.muffler || '#444444';
            c.strokeStyle = '#111111';
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(-20, 7);
            c.lineTo(-58, -8);
            c.lineTo(-56, -16);
            c.lineTo(-18, -1);
            c.closePath();
            c.fill();
            c.stroke();
            c.fillStyle = colors.accent || '#ff5500';
            c.fillRect(-59, -13, 3, 4);
        }

        // --- DISTINCT BODYWORK SILHOUETTE PER SKIN SHAPE ---
        if (shape === 'motocross') {
            // 1. CLASSIC MOTOCROSS DIRTBIKE
            c.fillStyle = colors.body || '#0a0a0a';
            c.beginPath();
            c.moveTo(28, -22);
            c.lineTo(8, -16);
            c.lineTo(-36, -16);
            c.lineTo(-78, -32); // High pointed dirt rear fender
            c.lineTo(-70, -20);
            c.lineTo(-30, -8);
            c.lineTo(-12, 4);
            c.lineTo(12, 4);
            c.lineTo(24, -14);
            c.closePath();
            c.fill();

            // High Motocross Front Beak
            c.beginPath();
            c.moveTo(26, -20);
            c.lineTo(70, -28); // Dirt beak over front wheel
            c.lineTo(66, -21);
            c.lineTo(28, -14);
            c.closePath();
            c.fill();

            // Racing Accent Decals
            c.strokeStyle = colors.accent || '#ff5500';
            c.lineWidth = 2.5;
            c.beginPath();
            c.moveTo(26, -20);
            c.lineTo(70, -28);
            c.moveTo(22, -18);
            c.lineTo(6, -14);
            c.lineTo(14, -4);
            c.moveTo(-34, -16);
            c.lineTo(-78, -32);
            c.stroke();

            // Flat Gripper Seat
            c.fillStyle = colors.seat || '#1c1c1c';
            c.beginPath();
            c.moveTo(6, -16);
            c.lineTo(-36, -16);
            c.lineTo(-34, -20);
            c.lineTo(4, -20);
            c.closePath();
            c.fill();

            // Handlebars & Crossbar
            c.strokeStyle = '#111111';
            c.lineWidth = 4;
            c.beginPath();
            c.moveTo(28, -22);
            c.lineTo(22, -42);
            c.stroke();

            c.lineWidth = 2.5;
            c.strokeStyle = '#888';
            c.beginPath();
            c.moveTo(24, -36);
            c.lineTo(21, -36);
            c.stroke();

            c.fillStyle = colors.accent || '#ff5500';
            c.fillRect(19, -44, 6, 4);

        } else if (shape === 'demon') {
            // 2. FURIA CARMESÍ - DEMON DOUBLE-HORN FIN BIKE
            c.fillStyle = colors.body || '#140003';
            c.beginPath();
            c.moveTo(28, -22);
            c.lineTo(8, -16);
            c.lineTo(-30, -18);
            c.lineTo(-84, -46); // Upper devil horn fin
            c.lineTo(-72, -32); // Inner notch
            c.lineTo(-86, -22); // Lower sharp stinger fin
            c.lineTo(-32, -8);
            c.lineTo(-12, 4);
            c.lineTo(14, 4);
            c.lineTo(24, -14);
            c.closePath();
            c.fill();

            // Razor-Serrated Front Demon Beak
            c.beginPath();
            c.moveTo(26, -20);
            c.lineTo(76, -34); // Upper horn
            c.lineTo(64, -26); // Notch
            c.lineTo(72, -22); // Lower claw
            c.lineTo(28, -14);
            c.closePath();
            c.fill();

            // Crimson Edge Accents
            c.strokeStyle = colors.accent || '#ff0033';
            c.lineWidth = 3;
            c.beginPath();
            c.moveTo(26, -20);
            c.lineTo(76, -34);
            c.moveTo(-30, -18);
            c.lineTo(-84, -46);
            c.moveTo(-72, -32);
            c.lineTo(-86, -22);
            c.stroke();

            // Demon Seat
            c.fillStyle = colors.seat || '#2b0007';
            c.beginPath();
            c.moveTo(6, -16);
            c.lineTo(-30, -18);
            c.lineTo(-28, -22);
            c.lineTo(4, -21);
            c.closePath();
            c.fill();

            // Aggressive Horn Bars
            c.strokeStyle = '#ff0033';
            c.lineWidth = 4;
            c.beginPath();
            c.moveTo(28, -22);
            c.lineTo(22, -42);
            c.lineTo(16, -46);
            c.stroke();

        } else if (shape === 'police') {
            // 3. PATRULLA INTERCEPTOR - HIGHWAY PATROL PURSUIT
            // Translucent blue pursuit windshield
            c.fillStyle = 'rgba(0, 180, 255, 0.45)';
            c.beginPath();
            c.moveTo(26, -22);
            c.lineTo(36, -50); // Tall windshield
            c.lineTo(28, -52);
            c.lineTo(18, -24);
            c.closePath();
            c.fill();
            c.strokeStyle = '#00f0ff';
            c.lineWidth = 1.5;
            c.stroke();

            // White Highway Patrol Fairing
            c.fillStyle = colors.body || '#ffffff';
            c.beginPath();
            c.moveTo(28, -22);
            c.lineTo(54, -16); // Rounded patrol nose
            c.lineTo(46, 2);   // Lower crash cowl
            c.lineTo(16, 4);
            c.lineTo(-32, -14);
            c.lineTo(-36, -18);
            c.closePath();
            c.fill();

            // Police Deep Blue Lower & Side Stripe
            c.fillStyle = colors.accent || '#0055ff';
            c.beginPath();
            c.moveTo(24, -14);
            c.lineTo(50, -12);
            c.lineTo(44, -2);
            c.lineTo(20, -2);
            c.closePath();
            c.fill();

            // Police Radio Trunk Box at the back
            c.fillStyle = '#0a1d37';
            c.fillRect(-64, -28, 28, 18);
            c.strokeStyle = '#ffffff';
            c.lineWidth = 1.5;
            c.strokeRect(-64, -28, 28, 18);

            // Siren Beacon Pole
            c.strokeStyle = '#cccccc';
            c.lineWidth = 3;
            c.beginPath();
            c.moveTo(-60, -28);
            c.lineTo(-60, -42);
            c.stroke();

            // ACTIVE FLASHING EMERGENCY LED BEACON (alternates red & blue every 180ms)
            const isRed = (performance.now() % 360) < 180;
            const sirenColor = isRed ? '#ff0033' : '#0066ff';
            const sirenAura = isRed ? 'rgba(255, 0, 50, 0.65)' : 'rgba(0, 100, 255, 0.65)';

            // Glowing light aura
            c.fillStyle = sirenAura;
            c.beginPath();
            c.arc(-60, -44, 9, 0, Math.PI * 2);
            c.fill();

            // Emergency Strobe bulb
            c.fillStyle = sirenColor;
            c.beginPath();
            c.arc(-60, -44, 4.5, 0, Math.PI * 2);
            c.fill();

            // Front Siren / Speaker
            c.fillStyle = '#888888';
            c.beginPath();
            c.arc(42, -6, 5, 0, Math.PI * 2);
            c.fill();

            // Police Seat
            c.fillStyle = colors.seat || '#002266';
            c.fillRect(-34, -21, 38, 5);

            // Police Cruiser Bars
            c.strokeStyle = '#dddddd';
            c.lineWidth = 4;
            c.beginPath();
            c.moveTo(28, -22);
            c.lineTo(20, -40);
            c.stroke();

        } else if (shape === 'supersport') {
            // 4. SUPERBIKE NINJA ZX - AERODYNAMIC RACE FAIRING
            c.fillStyle = colors.body || '#081408';
            c.beginPath();
            c.moveTo(28, -22);
            c.lineTo(62, -14); // Sleek bullet nose
            c.lineTo(54, 8);   // Lower aerodynamic chin
            c.lineTo(8, 12);   // Full bellypan under engine
            c.lineTo(-26, 8);
            c.lineTo(-72, -24); // High aerodynamic ducktail race cowl
            c.lineTo(-66, -14);
            c.lineTo(-24, -14);
            c.closePath();
            c.fill();

            // Smoked Aerodynamic Bubble Windscreen
            c.fillStyle = 'rgba(0, 40, 20, 0.7)';
            c.beginPath();
            c.moveTo(28, -22);
            c.lineTo(46, -34); // Race bubble screen
            c.lineTo(34, -36);
            c.lineTo(22, -26);
            c.closePath();
            c.fill();

            // High-Vis Neon Green Racing Livery Stripes
            c.strokeStyle = colors.accent || '#00ff44';
            c.lineWidth = 3;
            c.beginPath();
            c.moveTo(28, -22);
            c.lineTo(62, -14);
            c.moveTo(42, -6);
            c.lineTo(16, 6);
            c.lineTo(-20, 6);
            c.moveTo(-30, -16);
            c.lineTo(-72, -24);
            c.stroke();

            // Aerodynamic Race Winglet
            c.fillStyle = colors.accent || '#00ff44';
            c.fillRect(36, -8, 12, 3);

            // Race Pad Seat
            c.fillStyle = colors.seat || '#0d240d';
            c.beginPath();
            c.moveTo(10, -18);
            c.lineTo(-30, -16);
            c.lineTo(-28, -21);
            c.lineTo(8, -21);
            c.closePath();
            c.fill();

            // Low Clip-On Race Handlebars (Aggressive tuck)
            c.strokeStyle = '#111';
            c.lineWidth = 3.5;
            c.beginPath();
            c.moveTo(28, -22);
            c.lineTo(25, -34);
            c.stroke();
            c.fillStyle = colors.accent || '#00ff44';
            c.fillRect(23, -36, 5, 4);

        } else if (shape === 'cyber') {
            // 5. CYBERPUNK 2099 - LOW-SLUNG MONOCOQUE POD
            c.fillStyle = colors.body || '#080014';
            c.beginPath();
            c.moveTo(28, -22);
            c.lineTo(68, -12); // Long angular front pod
            c.lineTo(60, 6);
            c.lineTo(12, 10);
            c.lineTo(-34, 8);
            c.lineTo(-76, -18); // Low-slung square cyber tail
            c.lineTo(-74, -8);
            c.lineTo(-24, -12);
            c.closePath();
            c.fill();

            // Holographic HUD Visor projection
            c.strokeStyle = colors.accent || '#00f0ff';
            c.lineWidth = 2;
            c.beginPath();
            c.moveTo(28, -20);
            c.lineTo(44, -40);
            c.lineTo(30, -36);
            c.stroke();

            // Telemetry lines on HUD visor
            c.strokeStyle = 'rgba(0, 240, 255, 0.6)';
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(33, -27); c.lineTo(38, -27);
            c.moveTo(36, -33); c.lineTo(41, -33);
            c.stroke();

            // Glowing Neon Circuit Traces
            c.strokeStyle = colors.secondaryAccent || '#ff0077';
            c.lineWidth = 2.5;
            c.beginPath();
            c.moveTo(60, -10);
            c.lineTo(30, -10);
            c.lineTo(14, 0);
            c.lineTo(-30, 0);
            c.lineTo(-70, -14);
            c.stroke();

            // Cyber Thruster Nozzle
            c.fillStyle = colors.secondaryAccent || '#ff0077';
            c.fillRect(-76, -16, 10, 8);
            c.fillStyle = colors.accent || '#00f0ff';
            c.fillRect(-78, -14, 3, 4);

            // Cyber Seat
            c.fillStyle = colors.seat || '#1f0033';
            c.fillRect(-28, -18, 34, 5);

            // Angular Cyber Steering
            c.strokeStyle = colors.accent || '#00f0ff';
            c.lineWidth = 3.5;
            c.beginPath();
            c.moveTo(28, -22);
            c.lineTo(24, -38);
            c.stroke();

        } else if (shape === 'ghost') {
            // 6. FANTASMA DEL ABISMO - SKELETAL VERTEBRAE & SKULL
            c.fillStyle = colors.body || '#f0ede6';
            for (let v = 0; v < 6; v++) {
                c.beginPath();
                c.arc(20 - v * 14, -16, 6, 0, Math.PI * 2);
                c.fill();
            }

            // Horned Beast Skull Cowl
            c.beginPath();
            c.moveTo(24, -20);
            c.lineTo(66, -26); // Skull snout
            c.lineTo(60, -12); // Underjaw
            c.lineTo(42, -10);
            c.lineTo(26, -10);
            c.closePath();
            c.fill();

            // Glowing Amethyst Skull Eye
            c.fillStyle = colors.secondaryAccent || '#c77dff';
            c.beginPath();
            c.arc(46, -19, 3.5, 0, Math.PI * 2);
            c.fill();

            // Ragged Phantom Tail Shroud
            c.fillStyle = 'rgba(157, 78, 221, 0.45)';
            c.beginPath();
            c.moveTo(-36, -16);
            c.lineTo(-84, -36);
            c.lineTo(-74, -22);
            c.lineTo(-88, -14);
            c.lineTo(-44, -10);
            c.closePath();
            c.fill();

            // Ghost Seat
            c.fillStyle = colors.seat || '#240046';
            c.fillRect(-30, -20, 32, 5);

            // Bone Handlebars
            c.strokeStyle = colors.body || '#f0ede6';
            c.lineWidth = 4;
            c.beginPath();
            c.moveTo(26, -20);
            c.lineTo(20, -42);
            c.stroke();

        } else if (shape === 'golden') {
            // 7. TITÁN DE ORO VIP - 24K FACETED HYPERBIKE
            const goldGrad = c.createLinearGradient(0, -35, 0, 10);
            goldGrad.addColorStop(0, '#ffffff');
            goldGrad.addColorStop(0.2, '#ffd700');
            goldGrad.addColorStop(0.7, '#ffae00');
            goldGrad.addColorStop(1, '#b37700');

            c.fillStyle = goldGrad;
            c.beginPath();
            c.moveTo(28, -22);
            c.lineTo(68, -18); // Sharp hyperbike diamond nose
            c.lineTo(60, 4);
            c.lineTo(16, 8);
            c.lineTo(-24, 6);
            c.lineTo(-80, -28); // Diamond-cut sculpted rear cowl
            c.lineTo(-68, -14);
            c.lineTo(-22, -12);
            c.closePath();
            c.fill();

            // Beveled diamond facet reflection lines
            c.strokeStyle = '#ffffff';
            c.lineWidth = 1.8;
            c.beginPath();
            c.moveTo(28, -22);
            c.lineTo(68, -18);
            c.moveTo(20, -18);
            c.lineTo(6, -10);
            c.lineTo(-20, -10);
            c.moveTo(-28, -14);
            c.lineTo(-80, -28);
            c.stroke();

            // Shimmering diamond glint on body that sparkles
            const shimmerT = (performance.now() * 0.003) % (Math.PI * 2);
            const glintAlpha = 0.5 + Math.sin(shimmerT) * 0.5;
            c.fillStyle = `rgba(255, 255, 255, ${glintAlpha})`;
            c.beginPath();
            c.arc(52, -16, 2.5, 0, Math.PI * 2);
            c.fill();

            // Gold quilted seat
            c.fillStyle = colors.seat || '#664d00';
            c.beginPath();
            c.moveTo(8, -18);
            c.lineTo(-32, -16);
            c.lineTo(-30, -22);
            c.lineTo(6, -22);
            c.closePath();
            c.fill();

            // Polished Gold Handlebars
            c.strokeStyle = '#ffd700';
            c.lineWidth = 4;
            c.beginPath();
            c.moveTo(28, -22);
            c.lineTo(22, -42);
            c.stroke();
            c.fillStyle = '#ffffff';
            c.fillRect(19, -44, 6, 4);
        }

        // Draw Rider on top of the bike (if alive)
        if (b.isAlive) {
            drawRiderOnBike(skin, c);
        }

        c.restore();
    }

    function drawRiderOnBike(skin, customCtx) {
        const c = customCtx || ctx;
        c.save();
        c.lineCap = 'round';
        c.lineJoin = 'round';

        const colors = skin ? (skin.colors || {}) : {};
        const shape = skin ? (skin.shape || 'motocross') : 'motocross';

        // Foot & Motocross Boot on footpeg
        c.fillStyle = shape === 'golden' ? '#ffd700' : '#050505';
        c.beginPath();
        c.moveTo(-6, 12);
        c.lineTo(4, 12);
        c.lineTo(2, 6);
        c.lineTo(-6, 6);
        c.closePath();
        c.fill();

        // Leg (Shin & bent knee hugging tank)
        c.strokeStyle = shape === 'police' ? '#002266' : (shape === 'golden' ? '#241a00' : '#080808');
        c.lineWidth = 8;
        c.beginPath();
        c.moveTo(-4, 8);
        c.lineTo(8, -8);   // Knee
        c.lineTo(-18, -18); // Hip on seat
        c.stroke();

        // Torso in athletic attack position
        c.strokeStyle = shape === 'police' ? '#003399' : (shape === 'golden' ? '#ffd700' : (colors.body || '#080808'));
        c.lineWidth = 15;
        c.beginPath();
        c.moveTo(-18, -18); // Hip
        c.lineTo(6, -44);   // Shoulder
        c.stroke();

        // Arm reaching forward to handlebars
        c.lineWidth = 6;
        c.strokeStyle = shape === 'police' ? '#002266' : (shape === 'golden' ? '#241a00' : '#080808');
        c.beginPath();
        c.moveTo(6, -44);   // Shoulder
        c.lineTo(16, -32);  // Elbow
        c.lineTo(22, -42);  // Hand on grip
        c.stroke();

        // Helmet shell
        c.fillStyle = shape === 'police' ? '#ffffff' : (shape === 'ghost' ? '#f0ede6' : (shape === 'golden' ? '#ffd700' : (colors.body || '#080808')));
        c.beginPath();
        c.arc(8, -58, 14, 0, Math.PI * 2);
        c.fill();

        // Special Police Helmet Badge
        if (shape === 'police') {
            c.fillStyle = '#ffd700';
            c.beginPath();
            c.arc(14, -62, 3.5, 0, Math.PI * 2);
            c.fill();
        }

        // Helmet Visor / Peak
        c.fillStyle = shape === 'police' ? '#003399' : (shape === 'ghost' ? '#9d4edd' : (colors.accent || '#080808'));
        c.beginPath();
        c.moveTo(14, -66);
        c.lineTo(36, -63); // Sun peak jutting forward
        c.lineTo(22, -59);
        c.closePath();
        c.fill();

        // Chin guard
        c.beginPath();
        c.moveTo(22, -50);
        c.lineTo(12, -46);
        c.lineTo(8, -50);
        c.closePath();
        c.fill();

        // Goggles / Visor Lens
        c.fillStyle = colors.goggles || '#ffcc00';
        c.beginPath();
        c.ellipse(15, -57, 6.5, 4, 0.12, 0, Math.PI * 2);
        c.fill();

        // Goggle highlight
        c.fillStyle = colors.goggleHighlight || '#ffffff';
        c.beginPath();
        c.ellipse(14, -58, 2.5, 1.2, 0.12, 0, Math.PI * 2);
        c.fill();

        c.restore();
    }

    function drawWheel(wheel, skin, customCtx) {
        const c = customCtx || ctx;
        if (!wheel) return;
        c.save();
        c.translate(wheel.position.x, wheel.position.y);
        c.rotate(wheel.angle);

        const r = wheel.circleRadius || 21;
        const wType = skin ? (skin.wheelType || 'spokes') : 'spokes';
        const colors = skin ? (skin.colors || {}) : {};

        if (wType === 'disc_neon') {
            // FUTURISTIC NEON PLASMA DISC WHEEL
            c.fillStyle = '#06060c';
            c.beginPath();
            c.arc(0, 0, r + 1, 0, Math.PI * 2);
            c.fill();

            // Solid carbon disc body
            c.fillStyle = '#0e0b16';
            c.beginPath();
            c.arc(0, 0, r * 0.88, 0, Math.PI * 2);
            c.fill();

            // Glowing outer neon plasma ring
            c.strokeStyle = colors.rim || '#00f0ff';
            c.lineWidth = 2.5;
            c.beginPath();
            c.arc(0, 0, r * 0.76, 0, Math.PI * 2);
            c.stroke();

            // Secondary neon circuit ring
            c.strokeStyle = colors.spokes || '#ff0077';
            c.lineWidth = 1.5;
            c.beginPath();
            c.arc(0, 0, r * 0.48, 0, Math.PI * 2);
            c.stroke();

            // 4 rotating neon circuit radial lines
            c.lineWidth = 2;
            c.strokeStyle = colors.rim || '#00f0ff';
            for (let i = 0; i < 4; i++) {
                const angle = (i * Math.PI) / 2;
                c.beginPath();
                c.moveTo(Math.cos(angle) * r * 0.2, Math.sin(angle) * r * 0.2);
                c.lineTo(Math.cos(angle) * r * 0.74, Math.sin(angle) * r * 0.74);
                c.stroke();
            }

            // Center glowing plasma hub
            c.fillStyle = colors.spokes || '#ff0077';
            c.beginPath();
            c.arc(0, 0, r * 0.22, 0, Math.PI * 2);
            c.fill();

        } else if (wType === 'gold_star') {
            // LUXURY 24K 5-SPOKE GOLD STAR WHEEL
            c.fillStyle = '#0d0d0d';
            c.beginPath();
            c.arc(0, 0, r + 1, 0, Math.PI * 2);
            c.fill();

            // Polished Gold Outer Rim Flange
            c.strokeStyle = '#ffd700';
            c.lineWidth = 3;
            c.beginPath();
            c.arc(0, 0, r * 0.82, 0, Math.PI * 2);
            c.stroke();

            // Dark inner wheel bed
            c.fillStyle = '#1c1500';
            c.beginPath();
            c.arc(0, 0, r * 0.78, 0, Math.PI * 2);
            c.fill();

            // 5-Spoke Sculpted Star Spokes
            c.fillStyle = '#ffd700';
            c.strokeStyle = '#ffffff';
            c.lineWidth = 1;
            for (let i = 0; i < 5; i++) {
                const angle = (i * Math.PI * 2) / 5;
                c.save();
                c.rotate(angle);
                c.beginPath();
                c.moveTo(-3, 0);
                c.lineTo(0, r * 0.8);
                c.lineTo(3, 0);
                c.closePath();
                c.fill();
                c.stroke();
                c.restore();
            }

            // Center diamond hub
            c.fillStyle = '#ffffff';
            c.beginPath();
            c.arc(0, 0, r * 0.26, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = '#ffd700';
            c.lineWidth = 1.5;
            c.stroke();

        } else {
            // CLASSIC SPOKES & KNOBBY TIRE
            // Knobby Tire Treads (Dirtbike Knobs)
            c.fillStyle = '#111111';
            const numKnobs = 14;
            for (let i = 0; i < numKnobs; i++) {
                const angle = (i * Math.PI * 2) / numKnobs;
                c.save();
                c.rotate(angle);
                c.fillRect(-2.5, -r - 3, 5, 3.5);
                c.restore();
            }

            // Tire Outer Rubber Ring
            c.beginPath();
            c.arc(0, 0, r, 0, Math.PI * 2);
            c.fill();

            // Rim
            c.fillStyle = colors.rim || '#262626';
            c.beginPath();
            c.arc(0, 0, r * 0.74, 0, Math.PI * 2);
            c.fill();

            // Steel Brake Rotor Disc
            c.fillStyle = '#555555';
            c.beginPath();
            c.arc(0, 0, r * 0.44, 0, Math.PI * 2);
            c.fill();

            // Center Axle Hub
            c.fillStyle = '#0a0a0a';
            c.beginPath();
            c.arc(0, 0, r * 0.28, 0, Math.PI * 2);
            c.fill();

            // Spokes
            c.strokeStyle = colors.spokes || 'rgba(230, 230, 230, 0.65)';
            c.lineWidth = 1.4;
            for (let i = 0; i < 8; i++) {
                const angle = (i * Math.PI) / 4;
                c.beginPath();
                c.moveTo(-Math.cos(angle) * r * 0.72, -Math.sin(angle) * r * 0.72);
                c.lineTo(Math.cos(angle) * r * 0.72, Math.sin(angle) * r * 0.72);
                c.stroke();
            }
        }

        c.restore();
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

        const garageBadge = document.getElementById('garageStarsBadge');
        if (garageBadge) {
            garageBadge.textContent = `⭐ ${totalStars} / 300 Estrellas`;
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

        // Garage Modal Trigger Buttons
        const btnOpenGarage = document.getElementById('btnOpenGarage');
        if (btnOpenGarage) {
            btnOpenGarage.addEventListener('click', () => {
                window.sounds.init();
                openGarage();
            });
        }

        const btnCloseGarage = document.getElementById('btnCloseGarage');
        if (btnCloseGarage) {
            btnCloseGarage.addEventListener('click', () => {
                closeGarage();
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
