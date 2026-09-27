// Bike Race Web - Skins & Garage System
// 7 Unique Bikes with distinct shapes, colors, wheel designs, and particle effects!

const BIKE_SKINS = [
    {
        id: 'classic',
        name: 'Motocross Clásica',
        tagline: 'La leyenda original de dos ruedas',
        requiredStars: 0,
        shape: 'motocross',
        colors: {
            body: '#0a0a0a',
            accent: '#ff5500',
            seat: '#1c1c1c',
            forks: '#d4a017',
            sliders: '#e6e6e6',
            spring: '#ff2200',
            goggles: '#ffcc00',
            goggleHighlight: '#ffffff',
            exhaust: '#b87333',
            muffler: '#444444',
            rim: '#262626',
            spokes: 'rgba(230, 230, 230, 0.65)'
        },
        wheelType: 'spokes',
        particleType: 'smoke'
    },
    {
        id: 'fire_demon',
        name: 'Furia Carmesí',
        tagline: 'Forjada en el fuego con colines de doble aleta',
        requiredStars: 10,
        shape: 'demon',
        colors: {
            body: '#140003',
            accent: '#ff0033',
            seat: '#2b0007',
            forks: '#ff3300',
            sliders: '#222222',
            spring: '#ff0033',
            goggles: '#ff0033',
            goggleHighlight: '#ff9999',
            exhaust: '#ff3300',
            muffler: '#220004',
            rim: '#1f0005',
            spokes: 'rgba(255, 60, 60, 0.8)'
        },
        wheelType: 'spokes',
        particleType: 'fire'
    },
    {
        id: 'police',
        name: 'Patrulla Interceptor',
        tagline: 'Con sirena luminosa azul y roja en acción',
        requiredStars: 25,
        shape: 'police',
        colors: {
            body: '#ffffff',
            accent: '#0055ff',
            secondaryAccent: '#111111',
            seat: '#002266',
            forks: '#0066ff',
            sliders: '#ffffff',
            spring: '#0055ff',
            goggles: '#00f0ff',
            goggleHighlight: '#ffffff',
            exhaust: '#444444',
            muffler: '#003399',
            rim: '#ffffff',
            spokes: 'rgba(0, 100, 255, 0.8)'
        },
        wheelType: 'spokes',
        particleType: 'police_siren'
    },
    {
        id: 'ninja',
        name: 'Superbike Ninja ZX',
        tagline: 'Carenado aerodinámico supersport de velocidad pura',
        requiredStars: 50,
        shape: 'supersport',
        colors: {
            body: '#081408',
            accent: '#00ff44',
            secondaryAccent: '#ffffff',
            seat: '#0d240d',
            forks: '#00ff44',
            sliders: '#000000',
            spring: '#00ff44',
            goggles: '#00ff44',
            goggleHighlight: '#ffffff',
            exhaust: '#1a331a',
            muffler: '#004411',
            rim: '#0a1a0a',
            spokes: 'rgba(0, 255, 100, 0.85)'
        },
        wheelType: 'spokes',
        particleType: 'plasma_green'
    },
    {
        id: 'cyber',
        name: 'Cyberpunk 2099',
        tagline: 'Ruedas de disco de plasma y estela de luz continua',
        requiredStars: 80,
        shape: 'cyber',
        colors: {
            body: '#080014',
            accent: '#00f0ff',
            secondaryAccent: '#ff0077',
            seat: '#1f0033',
            forks: '#00f0ff',
            sliders: '#ff0077',
            spring: '#00f0ff',
            goggles: '#00f0ff',
            goggleHighlight: '#ffffff',
            exhaust: '#ff0077',
            muffler: '#1a0033',
            rim: '#00f0ff',
            spokes: '#ff0077'
        },
        wheelType: 'disc_neon',
        particleType: 'cyber_trail'
    },
    {
        id: 'ghost',
        name: 'Fantasma del Abismo',
        tagline: 'Estructura esquelética y aura espectral mística',
        requiredStars: 120,
        shape: 'ghost',
        colors: {
            body: '#f0ede6',
            accent: '#9d4edd',
            secondaryAccent: '#c77dff',
            seat: '#240046',
            forks: '#7b2cbf',
            sliders: '#e0aaff',
            spring: '#9d4edd',
            goggles: '#c77dff',
            goggleHighlight: '#ffffff',
            exhaust: '#3c096c',
            muffler: '#10002b',
            rim: '#e0aaff',
            spokes: 'rgba(199, 125, 255, 0.75)'
        },
        wheelType: 'spokes',
        particleType: 'ghost_aura'
    },
    {
        id: 'golden',
        name: 'Titán de Oro VIP',
        tagline: 'Bañada en oro macizo con llantas de diamantes',
        requiredStars: 160,
        shape: 'golden',
        colors: {
            body: '#ffd700',
            accent: '#ffffff',
            secondaryAccent: '#ffae00',
            seat: '#664d00',
            forks: '#ffffff',
            sliders: '#ffd700',
            spring: '#ffffff',
            goggles: '#ffffff',
            goggleHighlight: '#ffd700',
            exhaust: '#e6b800',
            muffler: '#ffcc00',
            rim: '#ffffff',
            spokes: 'rgba(255, 255, 255, 0.95)'
        },
        wheelType: 'gold_star',
        particleType: 'gold_sparkles'
    }
];

class SkinManager {
    constructor() {
        this.skins = BIKE_SKINS;
        this.activeSkinId = localStorage.getItem('bikerace_active_skin') || 'classic';
    }

    getActiveSkin() {
        const found = this.skins.find(s => s.id === this.activeSkinId);
        return found || this.skins[0];
    }

    setActiveSkin(skinId) {
        if (this.isUnlocked(skinId)) {
            this.activeSkinId = skinId;
            localStorage.setItem('bikerace_active_skin', skinId);
            return true;
        }
        return false;
    }

    isUnlocked(skinId) {
        const skin = this.skins.find(s => s.id === skinId);
        if (!skin) return false;
        if (skin.requiredStars === 0) return true;
        const totalStars = window.getTotalStars ? window.getTotalStars() : 0;
        return totalStars >= skin.requiredStars;
    }
}

window.BIKE_SKINS = BIKE_SKINS;
window.skinManager = new SkinManager();
