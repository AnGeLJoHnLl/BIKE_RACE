// Track generator & level definitions for Bike Race Web

const TrackUtils = {
    // Generates a straight line segment
    makeLine(x1, y1, x2, y2, thickness = 14) {
        return { type: 'line', x1, y1, x2, y2, thickness };
    },

    // Generates connected line segments from a list of points
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

    // Generates a smooth circular arc or loop
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
    },

    // Generates a sine-wave hill or valley
    makeWave(startX, startY, length, amplitude, cycles = 1, steps = 30, thickness = 14) {
        const points = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = startX + t * length;
            const y = startY - Math.sin(t * Math.PI * 2 * cycles) * amplitude;
            points.push([x, y]);
        }
        return this.makePolyline(points, thickness);
    },

    // Generates a smooth full 360-degree loop
    makeFullLoop(cx, cy, radius, thickness = 14) {
        // Full loop starting from bottom-left entrance to bottom-right exit
        return this.makeArc(cx, cy, radius, Math.PI * 0.5, Math.PI * 2.5, 36, thickness);
    }
};

const LEVELS = [
    {
        id: 1,
        title: "Desierto: Inicio",
        subtitle: "Acelera, haz caballitos y salta hacia la meta",
        skyGradient: ["#ff9900", "#ff4500", "#3a0600"],
        sunColor: "rgba(255, 230, 120, 0.9)",
        theme: "desert",
        starTimes: [14.0, 10.0, 6.8],
        start: { x: 100, y: 350 },
        finish: { x: 2350, y: 360, width: 90, height: 110 },
        build: () => {
            let segs = [];
            // Starting straight platform
            segs.push(...TrackUtils.makePolyline([
                [0, 420],
                [350, 420],
                [550, 390],
                [750, 310], // Ramp up
            ]));
            // Gentle landing slope
            segs.push(...TrackUtils.makePolyline([
                [900, 390],
                [1150, 450],
                [1350, 450],
                [1500, 380], // Second jump
            ]));
            // Final hill and finish run
            segs.push(...TrackUtils.makePolyline([
                [1680, 430],
                [1900, 460],
                [2100, 430],
                [2500, 430]
            ]));
            return segs;
        }
    },
    {
        id: 2,
        title: "El Gran Loop 360°",
        subtitle: "Coge máxima velocidad para no caerte en el rizo",
        skyGradient: ["#ff7700", "#d62828", "#1f0014"],
        sunColor: "rgba(255, 200, 80, 0.95)",
        theme: "fire",
        starTimes: [15.0, 10.5, 7.5],
        start: { x: 120, y: 260 },
        finish: { x: 2750, y: 340, width: 90, height: 110 },
        build: () => {
            let segs = [];
            // Steep descent for speed
            segs.push(...TrackUtils.makePolyline([
                [0, 320],
                [250, 340],
                [550, 480],
                [850, 520],
                [1050, 520]
            ]));

            // Smooth Loop entrance and circular track (radius: 170px)
            const loopCx = 1350;
            const loopCy = 350;
            const loopRadius = 175;
            segs.push(...TrackUtils.makeArc(loopCx, loopCy, loopRadius, Math.PI * 0.5, Math.PI * 2.5, 36));

            // Exit from loop into a launch ramp
            segs.push(...TrackUtils.makePolyline([
                [1350, 525],
                [1650, 525],
                [1850, 450], // launch ramp
            ]));

            // High air gap over void, landing down
            segs.push(...TrackUtils.makePolyline([
                [2100, 490],
                [2350, 430],
                [2550, 410],
                [2900, 410]
            ]));
            return segs;
        }
    },
    {
        id: 3,
        title: "Doble Rizo & Acrobacias",
        subtitle: "Dos loops consecutivos y saltos acrobáticos",
        skyGradient: ["#f77f00", "#d62828", "#003049"],
        sunColor: "rgba(255, 240, 150, 0.9)",
        theme: "sunset",
        starTimes: [19.0, 14.0, 9.8],
        start: { x: 100, y: 280 },
        finish: { x: 3400, y: 390, width: 90, height: 110 },
        build: () => {
            let segs = [];
            // Run-up
            segs.push(...TrackUtils.makePolyline([
                [0, 350],
                [300, 370],
                [600, 490],
                [800, 500]
            ]));

            // First loop
            segs.push(...TrackUtils.makeArc(1020, 360, 145, Math.PI * 0.5, Math.PI * 2.5, 30));

            // Connector ramp
            segs.push(...TrackUtils.makePolyline([
                [1020, 505],
                [1350, 505],
                [1600, 530]
            ]));

            // Second bigger loop
            segs.push(...TrackUtils.makeArc(1820, 360, 175, Math.PI * 0.5, Math.PI * 2.5, 34));

            // Exit ramp with a massive jump
            segs.push(...TrackUtils.makePolyline([
                [1820, 535],
                [2100, 535],
                [2350, 410] // steep kicker ramp
            ]));

            // Floating island landing
            segs.push(...TrackUtils.makePolyline([
                [2650, 450],
                [2850, 460],
                [3100, 460],
                [3550, 460]
            ]));
            return segs;
        }
    },
    {
        id: 4,
        title: "Picos de Fuego Extremos",
        subtitle: "Abismos gigantes, caídas verticales y precisión",
        skyGradient: ["#ff0055", "#790038", "#12000a"],
        sunColor: "rgba(255, 120, 50, 0.9)",
        theme: "volcano",
        starTimes: [22.0, 16.0, 11.2],
        start: { x: 100, y: 200 },
        finish: { x: 3700, y: 440, width: 90, height: 110 },
        build: () => {
            let segs = [];
            // High drop
            segs.push(...TrackUtils.makePolyline([
                [0, 260],
                [200, 260],
                [450, 460],
                [650, 520],
                [850, 420] // Jump 1
            ]));

            // Floating pillar 1
            segs.push(...TrackUtils.makePolyline([
                [1050, 470],
                [1250, 430] // Jump 2
            ]));

            // Floating pillar 2 with inverted curve
            segs.push(...TrackUtils.makePolyline([
                [1450, 480],
                [1700, 540],
                [1950, 440] // Jump 3 into loop
            ]));

            // Loop hanging over the abyss
            segs.push(...TrackUtils.makeArc(2250, 340, 160, Math.PI * 0.5, Math.PI * 2.5, 32));

            // Rollercoaster undulations
            segs.push(...TrackUtils.makePolyline([
                [2250, 500],
                [2500, 500],
                [2700, 400],
                [2900, 520],
                [3100, 410],
                [3300, 500],
                [3850, 500]
            ]));
            return segs;
        }
    },
    {
        id: 5,
        title: "Modo Editor Libre (Sandbox)",
        subtitle: "¡Dibuja tus propias pistas con el ratón o pantalla táctil y juégalas!",
        skyGradient: ["#00b4d8", "#0077b6", "#03045e"],
        sunColor: "rgba(255, 255, 255, 0.9)",
        theme: "custom",
        starTimes: [99.0, 99.0, 99.0],
        start: { x: 100, y: 350 },
        finish: { x: 1800, y: 400, width: 90, height: 110 },
        isEditor: true,
        build: () => {
            // Default starter ground if no custom lines yet
            return [
                TrackUtils.makeLine(0, 450, 400, 450),
                TrackUtils.makeLine(400, 450, 650, 380),
                TrackUtils.makeLine(850, 450, 2000, 450)
            ];
        }
    }
];

window.LEVELS = LEVELS;
window.TrackUtils = TrackUtils;
