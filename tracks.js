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

// Helper: Seeded pseudo-random number generator for deterministic tracks
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
    const subtitle = `${world.name} • Desafío ${levelNum}/100`;

    // Seed based on level
    let seed = levelNum * 31 + 17;
    const rand = () => { seed++; return seededRandom(seed); };

    let curX = 0;
    let curY = 400;
    const segs = [];

    // Starting Platform (safe zone to accelerate)
    const startFlatWidth = 320;
    segs.push(...TrackUtils.makePolyline([
        [-80, curY],
        [curX, curY],
        [curX + startFlatWidth, curY]
    ]));
    curX += startFlatWidth;

    // Number of modules scales with level
    const numSections = 3 + Math.floor(stage * 0.7) + Math.floor(worldIndex * 0.4);

    for (let s = 0; s < numSections; s++) {
        const choice = (s + stage + worldIndex) % 7;

        if (choice === 0) {
            // Speed Hill & Jump
            const rampW = 200 + rand() * 80;
            const rampH = 80 + rand() * 60;
            segs.push(...TrackUtils.makePolyline([
                [curX, curY],
                [curX + rampW * 0.5, curY + 40],
                [curX + rampW, curY - rampH]
            ]));
            curX += rampW;
            curY -= rampH;

            // Air gap into landing slope
            const gap = 140 + rand() * 80;
            curX += gap;
            curY += 70 + rand() * 50;

            const landW = 240 + rand() * 60;
            segs.push(...TrackUtils.makePolyline([
                [curX, curY],
                [curX + landW * 0.6, curY + 60],
                [curX + landW, curY + 70]
            ]));
            curX += landW;
            curY += 70;

        } else if (choice === 1 || choice === 5) {
            // 360-Degree Loop!
            // First: speed descent approach
            segs.push(...TrackUtils.makePolyline([
                [curX, curY],
                [curX + 180, curY + 80],
                [curX + 320, curY + 90]
            ]));
            curX += 320;
            curY += 90;

            const loopRadius = 140 + (worldIndex % 3) * 15;
            const loopCx = curX + loopRadius;
            const loopCy = curY - loopRadius;

            // Full 360 loop
            segs.push(...TrackUtils.makeArc(loopCx, loopCy, loopRadius, Math.PI * 0.5, Math.PI * 2.5, 34));

            curX = loopCx + loopRadius * 0.8;
            curY = loopCy + loopRadius;

            // Exit ramp with boost
            segs.push(...TrackUtils.makePolyline([
                [curX, curY],
                [curX + 160, curY],
                [curX + 300, curY - 50]
            ]));
            curX += 300;
            curY -= 50;

        } else if (choice === 2) {
            // Rollercoaster undulations / Whoops
            const waves = 2 + Math.floor(rand() * 2);
            const waveLength = 160;
            const amp = 35 + rand() * 25;
            const pts = [[curX, curY]];

            for (let w = 0; w < waves; w++) {
                pts.push([curX + (w + 0.3) * waveLength, curY - amp]);
                pts.push([curX + (w + 0.7) * waveLength, curY + amp * 0.6]);
                pts.push([curX + (w + 1.0) * waveLength, curY]);
            }
            segs.push(...TrackUtils.makePolyline(pts));
            curX += waves * waveLength;

        } else if (choice === 3) {
            // High Jump Gap over the Void
            const kickerW = 180;
            segs.push(...TrackUtils.makePolyline([
                [curX, curY],
                [curX + kickerW * 0.4, curY + 20],
                [curX + kickerW, curY - 80] // Steep kicker
            ]));
            curX += kickerW;
            curY -= 80;

            // Big abyss gap
            const gapDist = 180 + stage * 10;
            curX += gapDist;
            curY += 120; // Landing lower

            // Floating Landing Pad
            const islandW = 280;
            segs.push(...TrackUtils.makePolyline([
                [curX, curY],
                [curX + islandW * 0.5, curY + 20],
                [curX + islandW, curY + 20]
            ]));
            curX += islandW;
            curY += 20;

        } else {
            // Technical Step-Down & Cambered Turn
            const stepW = 220;
            segs.push(...TrackUtils.makePolyline([
                [curX, curY],
                [curX + 120, curY - 30],
                [curX + stepW, curY - 10]
            ]));
            curX += stepW;
            curY -= 10;

            const dropW = 240;
            segs.push(...TrackUtils.makePolyline([
                [curX + 80, curY + 60],
                [curX + dropW * 0.6, curY + 90],
                [curX + dropW, curY + 90]
            ]));
            curX += dropW;
            curY += 90;
        }

        // Clamp Y to safe range
        if (curY > 520) curY = 460;
        if (curY < 240) curY = 320;
    }

    // Finish Run Platform
    const finishRun = 360;
    segs.push(...TrackUtils.makePolyline([
        [curX, curY],
        [curX + finishRun, curY]
    ]));

    const finishX = curX + 220;
    const finishY = curY;

    // Estimate Star Times based on track length
    const totalTrackLength = finishX;
    const baseProTime = Math.round((totalTrackLength / 370 + 3.2) * 10) / 10;
    const starTimes = [
        Math.round((baseProTime * 1.8) * 10) / 10, // 1 Star (Finish)
        Math.round((baseProTime * 1.35) * 10) / 10, // 2 Stars (Great)
        baseProTime                               // 3 Stars (Pro)
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
