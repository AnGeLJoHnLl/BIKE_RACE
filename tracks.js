// Track Generator & 100-Level System for Bike Race Web
// 10 Worlds x 10 Levels = 100 Deterministic, Physics-Tuned Tracks!

const TrackUtils = {
    makeLine(x1, y1, x2, y2, thickness = 14) {
        return { type: 'line', x1, y1, x2, y2, thickness };
    },

    makePolyline(points, thickness = 14) {
        const segments = [];
        for (let i = 0; i < points.length - 1; i++) {
            segments.push({
                type: 'line',
                x1: points[i][0],
                y1: points[i][1],
                x2: points[i + 1][0],
                y2: points[i + 1][1],
                thickness
            });
        }
        return segments;
    },

    makeArc(cx, cy, radius, startAngle, endAngle, steps = 24, thickness = 14) {
        const segments = [];
        const angleStep = (endAngle - startAngle) / steps;
        for (let i = 0; i < steps; i++) {
            const a1 = startAngle + i * angleStep;
            const a2 = startAngle + (i + 1) * angleStep;
            segments.push({
                type: 'line',
                x1: cx + Math.cos(a1) * radius,
                y1: cy + Math.sin(a1) * radius,
                x2: cx + Math.cos(a2) * radius,
                y2: cy + Math.sin(a2) * radius,
                thickness
            });
        }
        return segments;
    }
};

// 10 Unique Worlds with distinct visual aesthetics and themes
const WORLDS = [
    {
        id: 1,
        name: "Desierto Cálido",
        skyGradient: ["#ff9900", "#ff4500", "#3a0600"],
        sunColor: "rgba(255, 235, 130, 0.95)",
        mountainColor1: "rgba(50, 15, 5, 0.4)",
        mountainColor2: "rgba(25, 5, 2, 0.7)"
    },
    {
        id: 2,
        name: "Cañón Rocoso",
        skyGradient: ["#e76f51", "#f4a261", "#264653"],
        sunColor: "rgba(255, 210, 120, 0.9)",
        mountainColor1: "rgba(45, 20, 15, 0.45)",
        mountainColor2: "rgba(20, 10, 8, 0.75)"
    },
    {
        id: 3,
        name: "Valle de los Loops",
        skyGradient: ["#ff7700", "#d62828", "#1f0014"],
        sunColor: "rgba(255, 180, 50, 0.95)",
        mountainColor1: "rgba(60, 10, 20, 0.4)",
        mountainColor2: "rgba(30, 5, 10, 0.7)"
    },
    {
        id: 4,
        name: "Glaciar Ártico",
        skyGradient: ["#00b4d8", "#0077b6", "#03045e"],
        sunColor: "rgba(230, 245, 255, 0.95)",
        mountainColor1: "rgba(10, 40, 70, 0.45)",
        mountainColor2: "rgba(5, 20, 40, 0.75)"
    },
    {
        id: 5,
        name: "Dunas Carmesí",
        skyGradient: ["#f72585", "#7209b7", "#3a0ca3"],
        sunColor: "rgba(255, 170, 220, 0.9)",
        mountainColor1: "rgba(50, 10, 60, 0.4)",
        mountainColor2: "rgba(25, 5, 30, 0.7)"
    },
    {
        id: 6,
        name: "Selva & Ruinas",
        skyGradient: ["#588157", "#3a5a40", "#344e41"],
        sunColor: "rgba(255, 240, 160, 0.9)",
        mountainColor1: "rgba(20, 40, 25, 0.45)",
        mountainColor2: "rgba(10, 20, 12, 0.75)"
    },
    {
        id: 7,
        name: "Metrópolis Neón",
        skyGradient: ["#4cc9f0", "#4361ee", "#10002b"],
        sunColor: "rgba(180, 240, 255, 0.95)",
        mountainColor1: "rgba(20, 15, 50, 0.45)",
        mountainColor2: "rgba(10, 5, 30, 0.8)"
    },
    {
        id: 8,
        name: "Picos de Lava",
        skyGradient: ["#ff0055", "#9e0031", "#150009"],
        sunColor: "rgba(255, 100, 30, 0.95)",
        mountainColor1: "rgba(60, 5, 20, 0.5)",
        mountainColor2: "rgba(30, 0, 10, 0.8)"
    },
    {
        id: 9,
        name: "Tormenta Eléctrica",
        skyGradient: ["#ffd166", "#06d6a0", "#118ab2"],
        sunColor: "rgba(255, 255, 200, 0.9)",
        mountainColor1: "rgba(15, 30, 40, 0.45)",
        mountainColor2: "rgba(8, 15, 25, 0.75)"
    },
    {
        id: 10,
        name: "Dimensión Titán",
        skyGradient: ["#b5179e", "#480ca8", "#03071e"],
        sunColor: "rgba(255, 215, 0, 0.95)",
        mountainColor1: "rgba(35, 10, 45, 0.5)",
        mountainColor2: "rgba(15, 5, 25, 0.85)"
    }
];

function seededRandom(seed) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

// Generates a fully playable, unique track for any level (1 to 100)
function generateLevelData(levelNum) {
    const worldIndex = Math.floor((levelNum - 1) / 10);
    const stage = ((levelNum - 1) % 10) + 1;
    const world = WORLDS[worldIndex];

    const title = `Mundo ${worldIndex + 1}: Nivel ${stage}`;
    const subtitle = `${world.name} • Nivel ${levelNum}/100`;

    // LEVEL 1: HAND-TUNED BEGINNER LEVEL (NO LOOPS, SUPER SMOOTH!)
    if (levelNum === 1) {
        const segs = TrackUtils.makePolyline([
            [-100, 420],
            [0, 420],
            [400, 420],   // Starting flat run
            [600, 390],   // Gentle incline
            [800, 350],   // Smooth hill crest
            [1000, 390],  // Gentle descent
            [1200, 420],  // Valley
            [1400, 370],  // Small jump ramp
            [1600, 420],  // Smooth landing slope
            [1850, 420],  // Straightaway
            [2300, 420]   // Finish straight
        ]);

        return {
            id: 1,
            worldId: 1,
            stage: 1,
            title: "Mundo 1: Nivel 1 (Tutorial)",
            subtitle: "Acelera, mantén el equilibrio y llega a la meta",
            skyGradient: world.skyGradient,
            sunColor: world.sunColor,
            mountainColor1: world.mountainColor1,
            mountainColor2: world.mountainColor2,
            starTimes: [14.0, 9.5, 6.2],
            start: { x: 120, y: 350 },
            finish: { x: 2050, y: 420, width: 80, height: 110 },
            build: () => segs
        };
    }

    // LEVEL 2: INTRO TO TABLE-TOP JUMP (NO LOOPS)
    if (levelNum === 2) {
        const segs = TrackUtils.makePolyline([
            [-100, 420],
            [0, 420],
            [400, 420],
            [650, 340],  // Ramp up
            [850, 340],  // Plateau
            [1050, 420], // Descent
            [1250, 420],
            [1450, 350], // Jump
            [1700, 420], // Landing
            [2250, 420]
        ]);

        return {
            id: 2,
            worldId: 1,
            stage: 2,
            title: "Mundo 1: Nivel 2",
            subtitle: "Salta sobre la meseta y aterriza suave",
            skyGradient: world.skyGradient,
            sunColor: world.sunColor,
            mountainColor1: world.mountainColor1,
            mountainColor2: world.mountainColor2,
            starTimes: [14.0, 9.8, 6.8],
            start: { x: 120, y: 350 },
            finish: { x: 2050, y: 420, width: 80, height: 110 },
            build: () => segs
        };
    }

    // GENERAL PROCEDURAL GENERATOR FOR LEVELS 3 TO 100
    let seed = levelNum * 37 + 19;
    const rand = () => { seed++; return seededRandom(seed); };

    let curX = 0;
    let curY = 420;
    const segs = [];

    // Starting Platform (safe straight line to get moving)
    const startFlatWidth = 360;
    segs.push(...TrackUtils.makePolyline([
        [-80, curY],
        [curX, curY],
        [curX + startFlatWidth, curY]
    ]));
    curX += startFlatWidth;

    const numSections = 3 + Math.floor(stage * 0.6) + Math.floor(worldIndex * 0.4);

    // Loops are strictly reserved for World 3 and above!
    const allowLoops = (worldIndex >= 2);

    for (let s = 0; s < numSections; s++) {
        // Module selection
        let choice = (s * 3 + stage + worldIndex) % 5;
        if (!allowLoops && choice === 1) {
            choice = 0; // Replace loops with smooth hills in Worlds 1 and 2
        }

        if (choice === 0) {
            // Smooth Hill & Kicker Jump
            const rampW = 200 + rand() * 60;
            const rampH = 60 + rand() * 40;
            segs.push(...TrackUtils.makePolyline([
                [curX, curY],
                [curX + rampW * 0.5, curY - rampH * 0.5],
                [curX + rampW, curY - rampH]
            ]));
            curX += rampW;
            curY -= rampH;

            // Small air gap
            const gap = 110 + rand() * 60;
            curX += gap;
            curY += rampH * 0.8;

            const landW = 220 + rand() * 60;
            segs.push(...TrackUtils.makePolyline([
                [curX, curY],
                [curX + landW * 0.5, curY + 40],
                [curX + landW, curY + 40]
            ]));
            curX += landW;
            curY += 40;

        } else if (choice === 1 && allowLoops) {
            // High-Speed Open Spiral Loop (Only in World 3+)
            // 1. Steep downhill run-up for maximum momentum!
            segs.push(...TrackUtils.makePolyline([
                [curX, curY],
                [curX + 160, curY + 90],
                [curX + 300, curY + 100]
            ]));
            curX += 300;
            curY += 100;

            const loopRadius = 135;
            const loopCx = curX + loopRadius;
            const loopCy = curY - loopRadius;

            // Open arc (from bottom through top to open exit)
            segs.push(...TrackUtils.makeArc(loopCx, loopCy, loopRadius, Math.PI * 0.5, Math.PI * 2.3, 30));

            // Shift exit forward so it never collides with entrance
            curX = loopCx + loopRadius * 0.75;
            curY = loopCy + loopRadius + 10;

            // Exit ramp with speed run
            segs.push(...TrackUtils.makePolyline([
                [curX, curY],
                [curX + 180, curY],
                [curX + 320, curY - 30]
            ]));
            curX += 320;
            curY -= 30;

        } else if (choice === 2) {
            // Rollercoaster undulations / Whoops
            const waves = 2;
            const waveLength = 150;
            const amp = 30 + rand() * 20;
            const pts = [[curX, curY]];

            for (let w = 0; w < waves; w++) {
                pts.push([curX + (w + 0.3) * waveLength, curY - amp]);
                pts.push([curX + (w + 0.7) * waveLength, curY + amp * 0.4]);
                pts.push([curX + (w + 1.0) * waveLength, curY]);
            }
            segs.push(...TrackUtils.makePolyline(pts));
            curX += waves * waveLength;

        } else if (choice === 3) {
            // Speed Jump Gap
            const kickerW = 160;
            segs.push(...TrackUtils.makePolyline([
                [curX, curY],
                [curX + kickerW * 0.5, curY],
                [curX + kickerW, curY - 60]
            ]));
            curX += kickerW;
            curY -= 60;

            const gapDist = 120 + stage * 8;
            curX += gapDist;
            curY += 60;

            const islandW = 240;
            segs.push(...TrackUtils.makePolyline([
                [curX, curY],
                [curX + islandW * 0.5, curY + 20],
                [curX + islandW, curY + 20]
            ]));
            curX += islandW;
            curY += 20;

        } else {
            // Step-down terrace
            const stepW = 180;
            segs.push(...TrackUtils.makePolyline([
                [curX, curY],
                [curX + stepW, curY - 20]
            ]));
            curX += stepW;
            curY -= 20;

            const dropW = 200;
            segs.push(...TrackUtils.makePolyline([
                [curX + 60, curY + 50],
                [curX + dropW, curY + 60]
            ]));
            curX += dropW;
            curY += 60;
        }

        // Clamp Y to comfortable riding boundaries
        if (curY > 500) curY = 450;
        if (curY < 260) curY = 320;
    }

    // Finish Run Platform
    const finishRun = 340;
    segs.push(...TrackUtils.makePolyline([
        [curX, curY],
        [curX + finishRun, curY]
    ]));

    const finishX = curX + 220;
    const finishY = curY;

    // Estimate Star Times based on track length
    const totalTrackLength = finishX;
    const baseProTime = Math.round((totalTrackLength / 360 + 3.0) * 10) / 10;
    const starTimes = [
        Math.round((baseProTime * 1.7) * 10) / 10, // 1 Star (Finish)
        Math.round((baseProTime * 1.3) * 10) / 10, // 2 Stars (Great)
        baseProTime                              // 3 Stars (Pro)
    ];

    return {
        id: levelNum,
        worldId: worldIndex + 1,
        stage: stage,
        title: title,
        subtitle: subtitle,
        skyGradient: world.skyGradient,
        sunColor: world.sunColor,
        mountainColor1: world.mountainColor1,
        mountainColor2: world.mountainColor2,
        starTimes: starTimes,
        start: { x: 100, y: 340 },
        finish: { x: finishX, y: finishY, width: 80, height: 110 },
        build: () => segs
    };
}

// Generate the 100 levels array!
const LEVELS = [];
for (let i = 1; i <= 100; i++) {
    LEVELS.push(generateLevelData(i));
}

window.WORLDS = WORLDS;
window.LEVELS = LEVELS;
window.TrackUtils = TrackUtils;
window.generateLevelData = generateLevelData;
