// Web Audio API Sound Synthesizer for Bike Race Web
// Completely self-contained, no external audio files required!

class SoundManager {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.initialized = false;
        this.engineOsc = null;
        this.engineGain = null;
        this.engineFilter = null;
        this.isThrottling = false;
        this.currentSpeed = 0;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.initialized = true;
            this.setupEngineSound();
        } catch (e) {
            console.warn("Web Audio API not supported:", e);
        }
    }

    setupEngineSound() {
        if (!this.ctx) return;
        
        // Engine hum oscillator
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        this.engineFilter = this.ctx.createBiquadFilter();

        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.setValueAtTime(35, this.ctx.currentTime); // Idle rumble

        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.setValueAtTime(220, this.ctx.currentTime);

        this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime); // Start muted until player moves

        this.engineOsc.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);

        this.engineOsc.start();
    }

    updateEngine(isAccelerating, speedRatio, isAlive) {
        if (!this.initialized || !this.ctx || this.muted || !isAlive) {
            if (this.engineGain) {
                this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
            }
            return;
        }

        // Resume AudioContext if suspended by browser autoplay policy
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const now = this.ctx.currentTime;
        const targetFreq = 40 + (isAccelerating ? 70 : 15) + (speedRatio * 160);
        const targetGain = isAccelerating ? 0.08 : (speedRatio > 0.05 ? 0.03 : 0.015);
        const filterCutoff = 200 + (speedRatio * 600) + (isAccelerating ? 300 : 0);

        this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.08);
        this.engineFilter.frequency.setTargetAtTime(filterCutoff, now, 0.08);
        this.engineGain.gain.setTargetAtTime(targetGain, now, 0.05);
    }

    playJump() {
        if (!this.initialized || this.muted) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    playFlip() {
        if (!this.initialized || this.muted) return;
        const now = this.ctx.currentTime;
        const notes = [330, 440, 554, 659];
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.06);

            gain.gain.setValueAtTime(0.09, now + idx * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.12);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + idx * 0.06);
            osc.stop(now + idx * 0.06 + 0.15);
        });
    }

    playCrash() {
        if (!this.initialized || this.muted) return;
        const now = this.ctx.currentTime;

        // White noise burst for impact
        const bufferSize = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(80, now + 0.4);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        whiteNoise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        whiteNoise.start(now);
        whiteNoise.stop(now + 0.5);

        // Low thud
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(25, now + 0.35);

        oscGain.gain.setValueAtTime(0.3, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(oscGain);
        oscGain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
    }

    playWin() {
        if (!this.initialized || this.muted) return;
        const now = this.ctx.currentTime;
        const chord = [
            { f: 523.25, t: 0.00 }, // C5
            { f: 659.25, t: 0.12 }, // E5
            { f: 783.99, t: 0.24 }, // G5
            { f: 1046.50, t: 0.38 } // C6
        ];

        chord.forEach(note => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(note.f, now + note.t);

            gain.gain.setValueAtTime(0.12, now + note.t);
            gain.gain.exponentialRampToValueAtTime(0.001, now + note.t + 0.45);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + note.t);
            osc.stop(now + note.t + 0.5);
        });
    }

    playClick() {
        if (!this.initialized || this.muted) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.07);
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.muted && this.engineGain) {
            this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
        }
        return this.muted;
    }
}

window.sounds = new SoundManager();
