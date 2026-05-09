/**
 * Utility functions for the Drum Editor
 */

const DrumUtils = {
    drumLaneKeys: ['crash', 'hihat', 'ride', 'hitom', 'midtom', 'snare', 'lowtom', 'kick'],

    /**
     * Format time in seconds to MM:SS format
     */
    formatTime: function(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    },

    /**
     * Parse time signature string (e.g., "4/4") into components
     */
    parseTimeSignature: function(timeSig) {
        const [numerator, denominator] = timeSig.split('/').map(Number);
        return { numerator, denominator };
    },

    /**
     * Calculate total beats in a groove
     */
    calculateBeats: function(measures, division, timeSignature) {
        const timeSig = this.parseTimeSignature(timeSignature);
        const beatsPerMeasure = timeSig.numerator;
        const subdivisions = division / timeSig.denominator;
        return measures * beatsPerMeasure * subdivisions;
    },

    /**
     * Calculate the number of steps in a single measure
     */
    calculateStepsPerMeasure: function(timeSignature, division) {
        const timeSig = this.parseTimeSignature(timeSignature);
        return Math.max(1, Math.round(timeSig.numerator * (division / timeSig.denominator)));
    },

    /**
     * Calculate the total number of steps in a groove
     */
    calculateTotalSteps: function(measures, division, timeSignature) {
        return this.calculateStepsPerMeasure(timeSignature, division) * measures;
    },

    /**
     * Generate a groove pattern string
     */
    generateGroovePattern: function(measures, division, timeSignature = '4/4', defaultChar = '-') {
        const patternsPerMeasure = this.calculateStepsPerMeasure(timeSignature, division);
        return Array(measures)
            .fill(null)
            .map(() => '|' + Array(patternsPerMeasure).fill(defaultChar).join('') + '|')
            .join('');
    },

    /**
     * Check if device is touch-enabled
     */
    isTouchDevice: function() {
        return (('ontouchstart' in window) ||
                (navigator.maxTouchPoints > 0) ||
                (navigator.msMaxTouchPoints > 0));
    },

    /**
     * Debounce function
     */
    debounce: function(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    },

    /**
     * Generate URL query parameters from groove data
     */
    generateShareURL: function(grooveData) {
        const params = new URLSearchParams({
            shared: '1',
            TimeSig: grooveData.timeSignature || '4/4',
            Div: grooveData.division || 16,
            Tempo: grooveData.tempo || 80,
            Measures: grooveData.measures || 1,
            MTXT: JSON.stringify(this.normalizeMeasureText(grooveData.measureText, grooveData.measures || 1)),
            C: grooveData.crash || '|----------------|',
            H: grooveData.hihat || '|xxxxxxxxxxxxxxxx|',
            HT: grooveData.hitom || '|----------------|',
            MT: grooveData.midtom || '|----------------|',
            S: grooveData.snare || '|----O-------O---|',
            LT: grooveData.lowtom || '|----------------|',
            K: grooveData.kick || '|o-------o-------|'
        });
        return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    },

    /**
     * Parse URL query parameters to groove data
     */
    parseGrooveFromURL: function() {
        const params = new URLSearchParams(window.location.search);
        if (!params.get('shared')) {
            return {};
        }
        let measureText = [];

        if (params.get('MTXT')) {
            try {
                const parsed = JSON.parse(params.get('MTXT'));
                if (Array.isArray(parsed)) {
                    measureText = parsed;
                }
            } catch (e) {
                measureText = [];
            }
        }

        return {
            timeSignature: params.get('TimeSig') || '4/4',
            division: parseInt(params.get('Div')) || 16,
            tempo: parseInt(params.get('Tempo')) || 80,
            measures: parseInt(params.get('Measures')) || 1,
            measureText,
            crash: params.get('C') || '',
            hihat: params.get('H') || '',
            hitom: params.get('HT') || '',
            midtom: params.get('MT') || '',
            snare: params.get('S') || '',
            lowtom: params.get('LT') || '',
            kick: params.get('K') || ''
        };
    },

    /**
     * Convert groove notation to array of hits
     */
    grooveToArray: function(grooveString) {
        if (!grooveString) return [];
        // Remove pipes and split into characters
        return grooveString.replace(/\|/g, '').split('');
    },

    /**
     * Convert array of hits back to groove notation
     */
    arrayToGroove: function(hitArray, measures, division, timeSignature = '4/4') {
        const hitsPerMeasure = this.calculateStepsPerMeasure(timeSignature, division);
        let result = '';
        
        for (let i = 0; i < measures; i++) {
            result += '|' + hitArray.slice(i * hitsPerMeasure, (i + 1) * hitsPerMeasure).join('') + '|';
        }
        
        return result;
    },

    /**
     * Ensure a groove pattern matches the current groove settings
     */
    normalizeGroovePattern: function(grooveString, measures, division, timeSignature, defaultChar = '-') {
        const targetSteps = this.calculateTotalSteps(measures, division, timeSignature);
        const hits = this.grooveToArray(grooveString).slice(0, targetSteps);

        while (hits.length < targetSteps) {
            hits.push(defaultChar);
        }

        return this.arrayToGroove(hits, measures, division, timeSignature);
    },

    /**
     * Ensure measure text matches the number of measures
     */
    normalizeMeasureText: function(measureText, measures) {
        const normalized = Array.isArray(measureText) ? measureText.slice(0, measures) : [];

        while (normalized.length < measures) {
            normalized.push('');
        }

        return normalized.map((value) => String(value || ''));
    },

    /**
     * Resize only the measure count while preserving each existing measure chunk in place
     */
    resizeMeasureCount: function(grooveString, oldMeasures, newMeasures, division, timeSignature, defaultChar = '-') {
        const stepsPerMeasure = this.calculateStepsPerMeasure(timeSignature, division);
        const normalizedPattern = this.normalizeGroovePattern(grooveString, oldMeasures, division, timeSignature, defaultChar);
        const hits = this.grooveToArray(normalizedPattern);
        const measureChunks = [];

        for (let measureIndex = 0; measureIndex < oldMeasures; measureIndex++) {
            const start = measureIndex * stepsPerMeasure;
            const end = start + stepsPerMeasure;
            measureChunks.push(hits.slice(start, end).join(''));
        }

        const resizedChunks = measureChunks.slice(0, newMeasures);

        while (resizedChunks.length < newMeasures) {
            resizedChunks.push(Array(stepsPerMeasure).fill(defaultChar).join(''));
        }

        return resizedChunks.map((chunk) => `|${chunk}|`).join('');
    },

    /**
     * Resize a groove pattern while preserving active hits as closely as possible
     */
    resizeGroovePattern: function(grooveString, oldMeasures, oldDivision, oldTimeSignature, newMeasures, newDivision, newTimeSignature, defaultChar = '-') {
        const oldHits = this.grooveToArray(grooveString);
        const oldSteps = this.calculateTotalSteps(oldMeasures, oldDivision, oldTimeSignature);
        const newSteps = this.calculateTotalSteps(newMeasures, newDivision, newTimeSignature);
        const normalizedOldHits = oldHits.slice(0, oldSteps);

        while (normalizedOldHits.length < oldSteps) {
            normalizedOldHits.push(defaultChar);
        }

        if (!newSteps) {
            return this.arrayToGroove([], newMeasures, newDivision, newTimeSignature);
        }

        // When only the measure count changes, preserve existing measures exactly
        // and only append/remove whole measures from the end.
        if (oldDivision === newDivision && oldTimeSignature === newTimeSignature) {
            return this.resizeMeasureCount(
                grooveString,
                oldMeasures,
                newMeasures,
                newDivision,
                newTimeSignature,
                defaultChar
            );
        }

        const resizedHits = Array(newSteps).fill(defaultChar);

        if (!normalizedOldHits.length || !oldSteps) {
            return this.arrayToGroove(resizedHits, newMeasures, newDivision, newTimeSignature);
        }

        normalizedOldHits.forEach((hit, index) => {
            if (!hit || hit === defaultChar) {
                return;
            }

            const mappedIndex = Math.min(
                newSteps - 1,
                Math.max(0, Math.round((index / oldSteps) * newSteps))
            );

            resizedHits[mappedIndex] = hit;
        });

        return this.arrayToGroove(resizedHits, newMeasures, newDivision, newTimeSignature);
    },

    /**
     * Storage helper functions
     */
    storage: {
        save: function(key, data) {
            try {
                localStorage.setItem(key, JSON.stringify(data));
                return true;
            } catch (e) {
                console.error('Error saving to localStorage:', e);
                return false;
            }
        },

        load: function(key) {
            try {
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : null;
            } catch (e) {
                console.error('Error loading from localStorage:', e);
                return null;
            }
        },

        remove: function(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (e) {
                console.error('Error removing from localStorage:', e);
                return false;
            }
        }
    },

    /**
     * Download helper
     */
    downloadFile: function(filename, content, mimeType = 'text/plain') {
        const element = document.createElement('a');
        element.setAttribute('href', 'data:' + mimeType + ';charset=utf-8,' + encodeURIComponent(content));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DrumUtils;
}
