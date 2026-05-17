/**
 * Main Application - Event handlers and initialization
 */

const DrumApp = {
    isPlaying: false,
    currentTime: 0,
    audioContext: null,
    schedulerId: null,
    displayTimerId: null,
    playbackStartTime: 0,
    nextStepTime: 0,
    currentStepIndex: 0,
    lookaheadMs: 25,
    scheduleAheadTime: 0.12,
    masterBus: null,
    noiseBuffer: null,
    sampleBuffers: {},
    activeHihatNodes: [],
    sampleLoadPromise: null,
    sampleLoadError: null,
    sampleLoadAlertShown: false,
    sampleManifest: {
        crash: 'samples/rock-kit/Rock-Kit-Crash-1-1.wav',
        hihat: 'samples/rock-kit/Rock-Kit-HiHat-Tip-1.wav',
        ride: 'samples/rock-kit/Rock-Ride-Tip.wav',
        hihat_pedal: 'samples/rock-kit/Rock-Kit-HiHat-Pedal.wav',
        open_hihat: 'samples/rock-kit/Rock-Kit-HiHat-Open.wav',
        rim_click: 'samples/Piccolo Cross Stick.wav',
        hitom: 'samples/rock-kit/Rock-Rack-1.wav',
        midtom: 'samples/rock-kit/Rock-Rack-2.wav',
        snare: 'samples/rock-kit/Rock-Snare-ff-2.wav',
        lowtom: 'samples/rock-kit/Rock-Kit-Floor-1.wav',
        kick: 'samples/rock-kit/Rock-Kit-Kick-ff-1.wav'
    },

    // Initialize the app
    init: function() {
        this.setupAudioContext();
        this.bindMainEvents();
        this.loadInitialState();
        this.enableEditing();
    },

    // Setup Web Audio API context
    setupAudioContext: function() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            this.setupAudioGraph();
        } catch (e) {
            console.error('Web Audio API not supported:', e);
        }
    },

    // Set up light mix-bus processing so the kit feels less brittle
    setupAudioGraph: function() {
        if (!this.audioContext || this.masterBus) {
            return;
        }

        const compressor = this.audioContext.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.knee.value = 10;
        compressor.ratio.value = 3.5;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.14;

        const masterGain = this.audioContext.createGain();
        masterGain.gain.value = 0.85;

        compressor.connect(masterGain);
        masterGain.connect(this.audioContext.destination);
        this.masterBus = compressor;
    },

    // Bind main UI events
    bindMainEvents: function() {
        // Play button
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.addEventListener('click', () => this.togglePlayback(playBtn));
        }
    },

    // Load initial state from URL
    loadInitialState: function() {
        GrooveEditor.updateUI();
        GrooveEditor.render();
    },

    // Keep the editor permanently interactive
    enableEditing: function() {
        if (typeof GroovePatternEditor !== 'undefined') {
            GroovePatternEditor.setEditMode(true);
        }
    },

    // Toggle playback
    togglePlayback: function(btn) {
        if (this.isPlaying) {
            this.stopPlayback();
            btn.textContent = '▶';
        } else {
            this.startPlayback(btn);
        }
    },

    // Start playback
    startPlayback: async function(btn) {
        if (!this.audioContext) {
            console.error('Audio context is not available');
            return;
        }

        try {
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
        } catch (error) {
            console.error('Unable to resume audio context:', error);
            return;
        }

        await this.ensureSampleKitLoaded();

        const playbackState = this.getPlaybackState();
        if (!playbackState.totalSteps) {
            alert('Please create a groove before playing it.');
            return;
        }

        this.isPlaying = true;
        this.currentTime = 0;
        this.currentStepIndex = 0;
        this.playbackStartTime = this.audioContext.currentTime + 0.05;
        this.nextStepTime = this.playbackStartTime;

        if (btn) {
            btn.textContent = '⏸';
        }

        this.updateTimeDisplay();
        this.schedulerId = window.setInterval(() => this.schedulePlayback(), this.lookaheadMs);
        this.displayTimerId = window.setInterval(() => this.updatePlaybackDisplay(), 50);

        console.log('Playback started at', playbackState.tempo, 'BPM');
    },

    // Stop playback
    stopPlayback: function() {
        this.isPlaying = false;
        this.currentTime = 0;

        if (this.schedulerId) {
            clearInterval(this.schedulerId);
            this.schedulerId = null;
        }

        if (this.displayTimerId) {
            clearInterval(this.displayTimerId);
            this.displayTimerId = null;
        }

        this.currentStepIndex = 0;
        this.nextStepTime = 0;
        this.playbackStartTime = 0;
        this.updateTimeDisplay();

        if (typeof GroovePatternEditor !== 'undefined') {
            GroovePatternEditor.setPlaybackStep(null);
        }

        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.textContent = '▶';
        }

        console.log('Playback stopped');
    },

    // Read the current groove state so playback reflects live edits
    getPlaybackState: function() {
        const groove = GrooveEditor.currentGroove;

        return {
            tempo: groove.tempo,
            swing: groove.swing,
            measures: groove.measures,
            division: groove.division,
            timeSignature: groove.timeSignature,
            totalSteps: DrumUtils.calculateTotalSteps(groove.measures, groove.division, groove.timeSignature),
            stepsPerMeasure: DrumUtils.calculateStepsPerMeasure(groove.timeSignature, groove.division),
            crash: DrumUtils.grooveToArray(groove.crash),
            hihat: DrumUtils.grooveToArray(groove.hihat),
            ride: DrumUtils.grooveToArray(groove.ride),
            hitom: DrumUtils.grooveToArray(groove.hitom),
            midtom: DrumUtils.grooveToArray(groove.midtom),
            snare: DrumUtils.grooveToArray(groove.snare),
            lowtom: DrumUtils.grooveToArray(groove.lowtom),
            kick: DrumUtils.grooveToArray(groove.kick)
        };
    },

    // Schedule notes slightly ahead to avoid audio jitter
    schedulePlayback: function() {
        if (!this.isPlaying || !this.audioContext) {
            return;
        }

        const playbackState = this.getPlaybackState();
        if (!playbackState.totalSteps) {
            return;
        }

        if (this.currentStepIndex >= playbackState.totalSteps) {
            this.currentStepIndex = this.currentStepIndex % playbackState.totalSteps;
        }

        while (this.nextStepTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            this.scheduleStep(this.currentStepIndex, this.nextStepTime, playbackState);
            this.advanceStep(playbackState);
        }
    },

    // Advance to the next rhythmic step
    advanceStep: function(playbackState) {
        if (!playbackState || !playbackState.totalSteps) {
            return;
        }

        const stepDuration = this.getStepDuration(this.currentStepIndex, playbackState);
        this.nextStepTime += stepDuration;
        this.currentStepIndex = (this.currentStepIndex + 1) % playbackState.totalSteps;
    },

    // Calculate the duration of a single step, including swing
    getStepDuration: function(stepIndex, playbackState) {
        const groove = playbackState || this.getPlaybackState();
        const baseStepDuration = (60 / groove.tempo) * (4 / groove.division);
        const swingAmount = Math.max(0, Math.min(1, groove.swing / 100));

        if (swingAmount === 0) {
            return baseStepDuration;
        }

        const pairOffset = stepIndex % 2;
        return pairOffset === 0
            ? baseStepDuration * (1 + (0.5 * swingAmount))
            : baseStepDuration * (1 - (0.5 * swingAmount));
    },

    // Schedule all sounds needed for a single step
    scheduleStep: function(stepIndex, stepTime, playbackState) {
        const groove = playbackState || this.getPlaybackState();

        if (typeof GroovePatternEditor !== 'undefined') {
            const delayMs = Math.max(0, (stepTime - this.audioContext.currentTime) * 1000);
            window.setTimeout(() => {
                if (this.isPlaying) {
                    GroovePatternEditor.setPlaybackStep(stepIndex);
                }
            }, delayMs);
        }

        this.scheduleDrumHit('crash', groove.crash[stepIndex], stepTime);
        this.scheduleDrumHit('hihat', groove.hihat[stepIndex], stepTime);
        this.scheduleDrumHit('ride', groove.ride[stepIndex], stepTime);
        this.scheduleDrumHit('hitom', groove.hitom[stepIndex], stepTime);
        this.scheduleDrumHit('midtom', groove.midtom[stepIndex], stepTime);
        this.scheduleDrumHit('snare', groove.snare[stepIndex], stepTime);
        this.scheduleDrumHit('lowtom', groove.lowtom[stepIndex], stepTime);
        this.scheduleDrumHit('kick', groove.kick[stepIndex], stepTime);

    },

    // Schedule an individual drum hit
    scheduleDrumHit: function(drumType, hit, time) {
        if (!hit || hit === '-') {
            return;
        }

        // Flam: choke hi-hat if needed, then play grace note + main note
        if (hit === 'f') {
            const normalChar = (drumType === 'crash' || drumType === 'hihat') ? 'x' : 'o';
            if (drumType === 'hihat') this.chokeHihat(time);
            const graceTime = time - 0.03;
            if (this.audioContext && graceTime >= this.audioContext.currentTime) {
                this.playHitAtTime(drumType, normalChar, graceTime, 0.3);
            }
            this.playHitAtTime(drumType, normalChar, time, this.getHitVelocity(drumType, normalChar));
            return;
        }

        // All hi-hat lane hits choke the previous hi-hat then register new nodes
        if (drumType === 'hihat') {
            this.chokeHihat(time);
            const velocity = this.getHitVelocity('hihat', hit);
            const sampleKey = hit === '+' ? 'open_hihat' : 'hihat';
            const register = (src, gain, peak) => this.activeHihatNodes.push({ source: src, gainNode: gain, peakGain: peak });
            if (!this.playSampleDrum(sampleKey, time, velocity, register)) {
                this.playHiHat(time, velocity);
            }
            return;
        }

        // Hi-hat foot and kick+foot also choke the hi-hat (closing the pedal mutes the cymbal)
        if (drumType === 'kick' && (hit === 'p' || hit === 'b')) {
            this.chokeHihat(time);
            if (hit === 'b') {
                this.playHitAtTime('kick', 'o', time, this.getHitVelocity('kick', 'o'));
            }
            const register = (src, gain, peak) => this.activeHihatNodes.push({ source: src, gainNode: gain, peakGain: peak });
            if (!this.playSampleDrum('hihat_pedal', time, 0.7, register)) {
                this.playHiHatFoot(time, 0.7);
            }
            return;
        }

        this.playHitAtTime(drumType, hit, time, this.getHitVelocity(drumType, hit));
    },

    // Play a single drum hit at the given scheduled time with the given velocity
    playHitAtTime: function(drumType, hit, time, velocity) {
        // Rim click always uses the synthesized voice (no dedicated sample)
        if (hit === 'r') {
            if (!this.playSampleDrum('rim_click', time, velocity)) {
                this.playRimClick(time, velocity);
            }
            return;
        }

        if (this.playSampleDrum(drumType, time, velocity)) {
            return;
        }

        switch (drumType) {
            case 'crash':
                this.playCrash(time, velocity);
                break;
            case 'hihat':
                this.playHiHat(time, velocity);
                break;
            case 'hitom':
                this.playTom(time, 240, 150, velocity);
                break;
            case 'midtom':
                this.playTom(time, 180, 120, velocity);
                break;
            case 'snare':
                this.playSnare(time, velocity);
                break;
            case 'lowtom':
                this.playTom(time, 130, 85, velocity);
                break;
            case 'kick':
                this.playKick(time, velocity);
                break;
        }
    },

    // Synthesized cross-stick / rim click
    playRimClick: function(time, velocity) {
        const osc = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(850, time);
        osc.frequency.exponentialRampToValueAtTime(220, time + 0.06);
        this.applyPercussionEnvelope(gainNode, time, 0.22 * velocity, 0.09);
        osc.connect(gainNode);
        this.connectToOutput(gainNode);
        osc.start(time);
        osc.stop(time + 0.12);

        const click = this.createNoiseSource('bandpass', 1600, 2.5);
        const clickGain = this.audioContext.createGain();
        click.output.connect(clickGain);
        this.connectToOutput(clickGain);
        this.applyTransientEnvelope(clickGain, time, 0.05 * velocity, 0.001, 0.04);
        click.source.start(time);
        click.source.stop(time + 0.06);
    },

    // Map groove symbols to a playback velocity
    getHitVelocity: function(drumType, hit) {
        if (hit === 'g') return 0.28;   // ghost: very soft
        if (hit === 'r') return 0.65;   // rim click: moderate

        switch (drumType) {
            case 'crash':  return hit === 'X' ? 1.3  : 1.0;
            case 'hihat':  return hit === 'X' ? 1.15 : 0.85;
            case 'ride':   return hit === 'X' ? 1.15 : 0.9;
            case 'snare':  return hit === 'O' ? 1.2  : 0.9;
            case 'kick':   return hit === 'O' ? 1.15 : 1.0;
            case 'hitom':  return hit === 'O' ? 1.2  : 0.95;
            case 'midtom': return hit === 'O' ? 1.2  : 1.0;
            case 'lowtom': return hit === 'O' ? 1.2  : 1.05;
            default:       return 1.0;
        }
    },

    // Update the time display during playback
    updatePlaybackDisplay: function() {
        if (!this.isPlaying || !this.audioContext) {
            return;
        }

        const playbackState = this.getPlaybackState();
        const elapsed = Math.max(0, this.audioContext.currentTime - this.playbackStartTime);
        const loopDuration = this.getLoopDuration(playbackState);
        this.currentTime = loopDuration > 0 ? (elapsed % loopDuration) : elapsed;
        this.updateTimeDisplay();
    },

    // Update the playback time UI
    updateTimeDisplay: function() {
        const timeDisplay = document.getElementById('timeDisplay');
        if (timeDisplay) {
            timeDisplay.textContent = DrumUtils.formatTime(this.currentTime);
        }
    },

    // Calculate the full loop duration
    getLoopDuration: function(playbackState) {
        const groove = playbackState || this.getPlaybackState();
        if (!groove.totalSteps) {
            return 0;
        }

        let duration = 0;
        for (let step = 0; step < groove.totalSteps; step++) {
            duration += this.getStepDuration(step, groove);
        }
        return duration;
    },

    // Shared helper for fast gain envelopes
    applyPercussionEnvelope: function(gainNode, time, peakGain, decayTime) {
        gainNode.gain.setValueAtTime(0.0001, time);
        gainNode.gain.exponentialRampToValueAtTime(peakGain, time + 0.002);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, time + decayTime);
    },

    // Short attack envelope for clicky transients
    applyTransientEnvelope: function(gainNode, time, peakGain, holdTime, decayTime) {
        gainNode.gain.setValueAtTime(0.0001, time);
        gainNode.gain.exponentialRampToValueAtTime(peakGain, time + 0.0015);
        gainNode.gain.setValueAtTime(peakGain * 0.9, time + holdTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, time + decayTime);
    },

    // Create a filtered noise burst
    createNoiseSource: function(filterType, frequency, q) {
        if (!this.noiseBuffer) {
            const bufferSize = Math.max(1, Math.floor(this.audioContext.sampleRate * 0.5));
            this.noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
            const data = this.noiseBuffer.getChannelData(0);

            for (let index = 0; index < bufferSize; index++) {
                data[index] = (Math.random() * 2) - 1;
            }
        }

        const source = this.audioContext.createBufferSource();
        source.buffer = this.noiseBuffer;

        const filter = this.audioContext.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.value = frequency;
        filter.Q.value = q;

        source.connect(filter);
        return { source, output: filter };
    },

    // Route audio nodes through the mix bus
    connectToOutput: function(node) {
        node.connect(this.masterBus || this.audioContext.destination);
    },

    // Lazily load the selected sample kit; synth voices remain the fallback
    ensureSampleKitLoaded: async function() {
        if (!this.audioContext || Object.keys(this.sampleBuffers).length > 0 || this.sampleLoadError) {
            return;
        }

        if (!this.sampleLoadPromise) {
            this.sampleLoadPromise = this.loadSampleKit().catch((error) => {
                this.sampleLoadError = error;
                console.warn('Sample kit unavailable, falling back to synthesized drums.', error);
                this.notifySampleLoadFailure(error);
            });
        }

        await this.sampleLoadPromise;
    },

    // Fetch and decode all sample files
    loadSampleKit: async function() {
        const entries = Object.entries(this.sampleManifest);
        const loadedEntries = await Promise.all(entries.map(async ([drumType, url]) => {
            const resolvedUrl = new URL(url, window.location.href).href;
            const response = await fetch(resolvedUrl);
            if (!response.ok) {
                throw new Error(`Failed to load ${url}: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            return [drumType, audioBuffer];
        }));

        this.sampleBuffers = Object.fromEntries(loadedEntries);
        console.info('Rock kit samples loaded successfully.');
    },

    // Surface sample-loading failures so fallback-to-synth is obvious
    notifySampleLoadFailure: function(error) {
        if (this.sampleLoadAlertShown) {
            return;
        }

        this.sampleLoadAlertShown = true;

        const protocolHint = window.location.protocol === 'file:'
            ? '\n\nYou are opening the app from a local file path. Browser security usually blocks loading WAV samples that way. Run the app from a local server such as Live Server and try again.'
            : '';

        const message = 'Sample kit could not be loaded, so playback is using the synthesized fallback.\n\n'
            + String(error && error.message ? error.message : error)
            + protocolHint;

        window.setTimeout(() => {
            alert(message);
        }, 0);
    },

    // Ramp all currently tracked hi-hat nodes to silence at the given scheduled time.
    // The 5 ms linear fade prevents click artifacts when choking a ringing open hi-hat.
    chokeHihat: function(time) {
        this.activeHihatNodes.forEach(({ source, gainNode, peakGain }) => {
            try {
                gainNode.gain.cancelScheduledValues(time);
                gainNode.gain.setValueAtTime(peakGain, time);
                gainNode.gain.linearRampToValueAtTime(0.0001, time + 0.005);
                source.stop(time + 0.005);
            } catch (e) { /* node already stopped — ignore */ }
        });
        this.activeHihatNodes = [];
    },

    // Play back a loaded sample if available.
    // Optional onCreated(source, gainNode, peakGain) callback lets callers track the nodes.
    playSampleDrum: function(drumType, time, velocity, onCreated) {
        const buffer = this.sampleBuffers[drumType];
        if (!buffer || !this.audioContext) {
            return false;
        }

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        const toneFilter = this.audioContext.createBiquadFilter();
        source.buffer = buffer;

        toneFilter.type = 'peaking';
        toneFilter.frequency.value = this.getSampleFilterFrequency(drumType);
        toneFilter.Q.value = 0.8;
        toneFilter.gain.value = this.getSampleFilterGain(drumType);

        const peakGain = this.getSampleGain(drumType, velocity);
        source.playbackRate.setValueAtTime(this.getSamplePlaybackRate(drumType), time);
        gainNode.gain.setValueAtTime(peakGain, time);

        source.connect(toneFilter);
        toneFilter.connect(gainNode);
        this.connectToOutput(gainNode);

        source.start(time);
        if (onCreated) onCreated(source, gainNode, peakGain);
        return true;
    },

    // Small per-instrument tuning to keep one-shots balanced
    getSampleGain: function(drumType, velocity) {
        const baseGain = {
            crash: 0.7,
            hihat: 0.42,
            hihat_pedal: 0.40,
            open_hihat: 0.48,
            rim_click: 0.75,
            hitom: 0.78,
            midtom: 0.82,
            snare: 0.82,
            lowtom: 0.88,
            kick: 0.95
        };

        return (baseGain[drumType] || 0.8) * velocity;
    },

    // Gentle playback-rate offsets to map the selected tom samples to lanes
    getSamplePlaybackRate: function(drumType) {
        const playbackRate = {
            crash: 1.0,
            hihat: 1.0,
            ride: 1.0,
            hihat_pedal: 1.0,
            open_hihat: 1.0,
            rim_click: 1.0,
            hitom: 1.1,
            midtom: 1.0,
            snare: 1.0,
            lowtom: 0.94,
            kick: 1.0
        };

        return playbackRate[drumType] || 1.0;
    },

    // Light EQ nudges to seat the samples together without extra assets
    getSampleFilterFrequency: function(drumType) {
        const frequencies = {
            crash: 6500,
            hihat: 7800,
            ride: 7000,
            hihat_pedal: 7000,
            open_hihat: 6500,
            rim_click: 1800,
            hitom: 220,
            midtom: 190,
            snare: 2200,
            lowtom: 145,
            kick: 78
        };

        return frequencies[drumType] || 1000;
    },

    getSampleFilterGain: function(drumType) {
        const gains = {
            crash: 2,
            hihat: 3,
            ride: 2.5,
            hihat_pedal: 2.5,
            open_hihat: 3.0,
            rim_click: 1.5,
            hitom: 2.5,
            midtom: 1.5,
            snare: 1.5,
            lowtom: 2,
            kick: 2.5
        };

        return gains[drumType] || 0;
    },

    // Layered cymbal partials for more realistic metallic tone
    createMetalOscillators: function(frequencies, time, duration, gainAmount, type = 'square') {
        frequencies.forEach((frequency) => {
            const osc = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(frequency, time);
            this.applyTransientEnvelope(gainNode, time, gainAmount, 0.01, duration);

            osc.connect(gainNode);
            this.connectToOutput(gainNode);

            osc.start(time);
            osc.stop(time + duration + 0.02);
        });
    },

    // Synthesized hi-hat
    playHiHat: function(time, velocity) {
        const noise = this.createNoiseSource('highpass', 8200, 0.9);
        const noiseGain = this.audioContext.createGain();
        const bandpass = this.audioContext.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 9600;
        bandpass.Q.value = 1.3;

        noise.output.connect(bandpass);
        bandpass.connect(noiseGain);
        this.connectToOutput(noiseGain);
        this.applyTransientEnvelope(noiseGain, time, 0.12 * velocity, 0.004, 0.07);

        this.createMetalOscillators([4200, 6120, 8360], time, 0.06, 0.012 * velocity);
        noise.source.start(time);
        noise.source.stop(time + 0.08);
    },

    // Synthesized hi-hat foot (pedal hi-hat) — short, muffled closed sound
    playHiHatFoot: function(time, velocity) {
        const noise = this.createNoiseSource('bandpass', 5500, 2.0);
        const noiseGain = this.audioContext.createGain();
        noise.output.connect(noiseGain);
        this.connectToOutput(noiseGain);
        this.applyTransientEnvelope(noiseGain, time, 0.06 * velocity, 0.002, 0.04);
        noise.source.start(time);
        noise.source.stop(time + 0.055);
    },

    // Synthesized crash cymbal
    playCrash: function(time, velocity) {
        const noise = this.createNoiseSource('highpass', 4800, 0.7);
        const noiseGain = this.audioContext.createGain();
        const shimmer = this.audioContext.createBiquadFilter();
        shimmer.type = 'highshelf';
        shimmer.frequency.value = 6000;
        shimmer.gain.value = 6;

        noise.output.connect(shimmer);
        shimmer.connect(noiseGain);
        this.connectToOutput(noiseGain);
        this.applyTransientEnvelope(noiseGain, time, 0.18 * velocity, 0.012, 0.8);

        this.createMetalOscillators([1180, 1730, 2630, 4120, 5870], time, 0.62, 0.015 * velocity, 'triangle');
        noise.source.start(time);
        noise.source.stop(time + 0.9);
    },

    // Synthesized snare
    playSnare: function(time, velocity) {
        const noise = this.createNoiseSource('highpass', 1400, 0.75);
        const noiseGain = this.audioContext.createGain();
        const bodyFilter = this.audioContext.createBiquadFilter();
        bodyFilter.type = 'bandpass';
        bodyFilter.frequency.value = 2200;
        bodyFilter.Q.value = 0.8;
        noise.output.connect(bodyFilter);
        bodyFilter.connect(noiseGain);
        this.connectToOutput(noiseGain);
        this.applyTransientEnvelope(noiseGain, time, 0.18 * velocity, 0.006, 0.18);

        const toneFrequencies = [196, 312];
        toneFrequencies.forEach((frequency, index) => {
            const toneOsc = this.audioContext.createOscillator();
            const toneGain = this.audioContext.createGain();
            toneOsc.type = index === 0 ? 'triangle' : 'sine';
            toneOsc.frequency.setValueAtTime(frequency, time);
            toneOsc.frequency.exponentialRampToValueAtTime(frequency * 0.58, time + 0.15);
            this.applyTransientEnvelope(toneGain, time, (0.11 - (index * 0.025)) * velocity, 0.01, 0.14);

            toneOsc.connect(toneGain);
            this.connectToOutput(toneGain);

            toneOsc.start(time);
            toneOsc.stop(time + 0.18);
        });

        noise.source.start(time);
        noise.source.stop(time + 0.22);
    },

    // Synthesized kick
    playKick: function(time, velocity) {
        const bodyOsc = this.audioContext.createOscillator();
        const bodyGain = this.audioContext.createGain();
        bodyOsc.type = 'sine';
        bodyOsc.frequency.setValueAtTime(122, time);
        bodyOsc.frequency.exponentialRampToValueAtTime(42, time + 0.18);
        this.applyTransientEnvelope(bodyGain, time, 0.48 * velocity, 0.02, 0.26);
        bodyOsc.connect(bodyGain);
        this.connectToOutput(bodyGain);
        bodyOsc.start(time);
        bodyOsc.stop(time + 0.28);

        const punchOsc = this.audioContext.createOscillator();
        const punchGain = this.audioContext.createGain();
        punchOsc.type = 'triangle';
        punchOsc.frequency.setValueAtTime(210, time);
        punchOsc.frequency.exponentialRampToValueAtTime(70, time + 0.045);
        this.applyTransientEnvelope(punchGain, time, 0.16 * velocity, 0.004, 0.06);
        punchOsc.connect(punchGain);
        this.connectToOutput(punchGain);
        punchOsc.start(time);
        punchOsc.stop(time + 0.08);

        const clickNoise = this.createNoiseSource('highpass', 2400, 0.7);
        const clickGain = this.audioContext.createGain();
        clickNoise.output.connect(clickGain);
        this.connectToOutput(clickGain);
        this.applyTransientEnvelope(clickGain, time, 0.03 * velocity, 0.001, 0.018);
        clickNoise.source.start(time);
        clickNoise.source.stop(time + 0.03);
    },

    // Synthesized tom
    playTom: function(time, startFrequency, endFrequency, velocity) {
        const fundamental = this.audioContext.createOscillator();
        const fundamentalGain = this.audioContext.createGain();
        fundamental.type = 'sine';
        fundamental.frequency.setValueAtTime(startFrequency, time);
        fundamental.frequency.exponentialRampToValueAtTime(endFrequency, time + 0.22);
        this.applyTransientEnvelope(fundamentalGain, time, 0.28 * velocity, 0.018, 0.28);
        fundamental.connect(fundamentalGain);
        this.connectToOutput(fundamentalGain);
        fundamental.start(time);
        fundamental.stop(time + 0.32);

        const overtone = this.audioContext.createOscillator();
        const overtoneGain = this.audioContext.createGain();
        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(startFrequency * 1.52, time);
        overtone.frequency.exponentialRampToValueAtTime(endFrequency * 1.34, time + 0.16);
        this.applyTransientEnvelope(overtoneGain, time, 0.11 * velocity, 0.008, 0.16);
        overtone.connect(overtoneGain);
        this.connectToOutput(overtoneGain);
        overtone.start(time);
        overtone.stop(time + 0.18);

        const stickNoise = this.createNoiseSource('bandpass', startFrequency * 18, 0.6);
        const stickGain = this.audioContext.createGain();
        stickNoise.output.connect(stickGain);
        this.connectToOutput(stickGain);
        this.applyTransientEnvelope(stickGain, time, 0.022 * velocity, 0.001, 0.03);
        stickNoise.source.start(time);
        stickNoise.source.stop(time + 0.04);
    },

    // Save current groove
    saveGroove: function() {
        DrumUtils.storage.save('currentGroove', GrooveEditor.currentGroove);
        console.log('Groove saved');
    },

    // Handle keyboard shortcuts
    setupKeyboardShortcuts: function() {
        document.addEventListener('keydown', (e) => {
            const target = e.target;
            const isTypingField = target instanceof HTMLElement && (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.tagName === 'SELECT' ||
                target.isContentEditable
            );

            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        this.saveGroove();
                        break;
                    case 'z':
                        e.preventDefault();
                        // TODO: Implement undo
                        break;
                    case 'y':
                        e.preventDefault();
                        // TODO: Implement redo
                        break;
                }
            } else if (e.key === ' ' && !isTypingField) {
                e.preventDefault();
                this.togglePlayback(document.getElementById('playBtn'));
            }
        });
    }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        DrumApp.init();
        DrumApp.setupKeyboardShortcuts();
    });
} else {
    DrumApp.init();
    DrumApp.setupKeyboardShortcuts();
}

// Re-render pattern grid when screen size or orientation changes
let _resizeRenderTimer;
window.addEventListener('resize', () => {
    clearTimeout(_resizeRenderTimer);
    _resizeRenderTimer = setTimeout(() => GroovePatternEditor.render(), 150);
});

// Save groove periodically
setInterval(() => {
    DrumApp.saveGroove();
}, 30000); // Every 30 seconds
