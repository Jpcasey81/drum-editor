/**
 * Drum Notation Renderer - Converts groove state into ABC percussion notation
 */

const DrumNotationRenderer = {
    lanePitches: {
        crash: "a",
        hihat: "g",
        hitom: "e",
        midtom: "B",
        snare: "c",
        lowtom: "A",
        kick: "F"
    },

    // Shadow pitches for ghost notes — each maps via %%map MIDIdrum to print at the normal
    // staff position but with the ghost_head notehead (filled circle + parentheses).
    // Unused letters: d G E b C
    ghostPitches: {
        hihat: "G",
        hitom: "E",
        midtom: "b",
        snare: "d",
        lowtom: "C"
    },

    // Shadow pitch for rim click — maps to snare staff position with x_head notehead.
    // Unused letter: f
    rimPitches: {
        snare: "f"
    },

    // Shadow pitch for hi-hat foot — prints one step below kick (F) with x_head notehead.
    // Unused letter: D
    hihatFootPitch: "D",

    // Group compound eighth-note meters into dotted-quarter beats for notation only
    getNotationBeatCount: function(timeSignature) {
        const timeSig = DrumUtils.parseTimeSignature(timeSignature);

        if (timeSig.denominator === 8 && timeSig.numerator > 3 && timeSig.numerator % 3 === 0) {
            return timeSig.numerator / 3;
        }

        return timeSig.numerator;
    },

    // Render ABC staff notation into the notation container
    render: function(groove) {
        const container = document.getElementById('notationView');
        if (!container || typeof abc2svg === 'undefined' || !abc2svg.Abc) {
            return;
        }

        const abcSource = this.buildABC(groove, {
            staffWidth: this.getStaffWidth(container),
            pageWidth: this.getPageWidth(container)
        });
        let output = '';
        let errorText = '';

        const user = {
            errmsg: function(msg) {
                errorText += msg + '\n';
            },
            img_out: function(str) {
                output += str;
            }
        };

        try {
            const abc = new abc2svg.Abc(user);
            abc.tosvg('drum-notation', abcSource);

            if (typeof abc2svg.abc_end === 'function') {
                abc2svg.abc_end();
            }

            container.innerHTML = errorText
                ? `<pre class="notation-error">${errorText}</pre>${output}`
                : output;
        } catch (error) {
            container.innerHTML = `<pre class="notation-error">${error.message}</pre>`;
        }
    },

    // Match the notation staff width to the available container width
    getStaffWidth: function(container) {
        const width = container ? container.clientWidth : 0;
        return Math.max(520, Math.floor(width > 0 ? width - 32 : 1100));
    },

    // Keep page width slightly larger than staff width so abc2svg does not force early wraps
    getPageWidth: function(container) {
        const width = container ? container.clientWidth : 0;
        return Math.max(560, Math.floor(width > 0 ? width - 8 : 1140));
    },

    // Build the ABC source from the current groove
    buildABC: function(groove, options = {}) {
        const timeSignature = groove.timeSignature || '4/4';
        const division = groove.division || 16;
        const measures = groove.measures || 1;
        const staffWidth = options.staffWidth || 1100;
        const pageWidth = options.pageWidth || (staffWidth + 40);
        const singleMeasureStaffWidth = Math.max(320, Math.floor(staffWidth * 0.58));
        const stepsPerMeasure = DrumUtils.calculateStepsPerMeasure(timeSignature, division);
        const beatsPerMeasure = this.getNotationBeatCount(timeSignature);
        const stepsPerBeat = Math.max(1, Math.round(stepsPerMeasure / beatsPerMeasure));
        const measureStrings = this.buildStepTokens(groove, measures, stepsPerMeasure, stepsPerBeat)
            .map((measureTokens, measureIndex) => {
                const measureString = this.groupMeasureTokens(measureTokens);
                const measureText = groove.measureText && groove.measureText[measureIndex]
                    ? groove.measureText[measureIndex]
                    : '';

                return this.applyMeasureText(measureString, measureText);
            });
        const body = this.buildSystems(measureStrings, 2, {
            fullWidth: staffWidth,
            singleWidth: singleMeasureStaffWidth
        });

        return [
            'X:1',
            `M:${timeSignature}`,
            `L:1/${division}`,
            `Q:"${groove.tempo || 80} BPM"`,
            '%%printmargin 0',
            '%%leftmargin 12',
            '%%rightmargin 12',
            `%%pagewidth ${pageWidth}`,
            '%%stretchlast 1',
            '%%musicspace 12',
            '%%staffsep 70',
            '%%annotationfont Helvetica 14',
            '%%beamslope 0',
            '%%flatbeams 1',
            '%%beginsvg',
            '<defs>',
            '<path id="x_head" d="m-3 -3l6 6m0 -6l-6 6" class="stroke" style="stroke-width:1.2"/>',
            '<g id="ghost_head">',
            '<ellipse rx="3.75" ry="2.5" class="fill"/>',
            '<path d="M-5.5,-4.5 C-8,-4.5 -8,4.5 -5.5,4.5" class="stroke" style="fill:none;stroke-width:1.2"/>',
            '<path d="M5.5,-4.5 C8,-4.5 8,4.5 5.5,4.5" class="stroke" style="fill:none;stroke-width:1.2"/>',
            '</g>',
            '</defs>',
            '%%endsvg',
            'I:percmap a crash-cymbal-1 x',
            'I:percmap g closed-hi-hat x',
            'I:percmap e high-tom',
            'I:percmap B low-mid-tom',
            'I:percmap c acoustic-snare',
            'I:percmap A low-floor-tom',
            'I:percmap F acoustic-bass-drum',
            '%%map MIDIdrum g print=g heads=x_head',
            '%%map MIDIdrum a print=a heads=x_head',
            '%%map MIDIdrum d print=c heads=ghost_head',
            '%%map MIDIdrum G print=g heads=ghost_head',
            '%%map MIDIdrum E print=e heads=ghost_head',
            '%%map MIDIdrum b print=B heads=ghost_head',
            '%%map MIDIdrum C print=A heads=ghost_head',
            '%%map MIDIdrum f print=c heads=x_head',
            '%%map MIDIdrum D print=E heads=x_head',
            'I:stemdir up',
            'K:C clef=perc',
            body
        ].filter(Boolean).join('\n');
    },

    // Build deterministic staff systems with a fixed number of measures per line
    buildSystems: function(measureStrings, measuresPerLine, widths) {
        const systems = [];

        for (let index = 0; index < measureStrings.length; index += measuresPerLine) {
            const systemMeasures = measureStrings.slice(index, index + measuresPerLine);
            const systemWidth = systemMeasures.length === 1 ? widths.singleWidth : widths.fullWidth;
            systems.push(`%%staffwidth ${systemWidth}\n| ` + systemMeasures.join(' | ') + ' |');
        }

        return systems.join('\n');
    },

    // Attach a text annotation to the first event in a measure
    applyMeasureText: function(measureString, measureText) {
        const cleanedText = this.sanitizeMeasureText(measureText);
        if (!cleanedText) {
            return measureString;
        }

        const tokens = measureString.split(' ');
        if (!tokens.length) {
            return measureString;
        }

        tokens[0] = `"^${cleanedText}"` + tokens[0];
        return tokens.join(' ');
    },

    // Keep annotations safe for inline ABC text markup
    sanitizeMeasureText: function(text) {
        return String(text || '')
            .replace(/["\\]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    },

    // Convert each rhythmic step into ABC chords/rests
    buildStepTokens: function(groove, measures, stepsPerMeasure, stepsPerBeat) {
        const laneKeys = DrumUtils.drumLaneKeys;

        return Array.from({ length: measures }, (_, measureIndex) => {
            const measureStart = measureIndex * stepsPerMeasure;
            const beatGroups = [];

            for (let beatStart = 0; beatStart < stepsPerMeasure; beatStart += stepsPerBeat) {
                const beatHits = laneKeys.reduce((accumulator, laneKey) => {
                    accumulator[laneKey] = DrumUtils.grooveToArray(groove[laneKey]).slice(
                        measureStart + beatStart,
                        measureStart + beatStart + stepsPerBeat
                    );
                    return accumulator;
                }, {});

                const displayStepFactor = this.getBeatDisplayStepFactor(beatHits, stepsPerBeat);
                const beatTokens = [];

                for (let stepOffset = 0; stepOffset < stepsPerBeat; stepOffset += displayStepFactor) {
                    const activeHits = laneKeys
                        .map((laneKey) => ({ laneKey, hit: beatHits[laneKey][stepOffset] }))
                        .filter(({ hit }) => hit && hit !== '-');

                    beatTokens.push(this.buildStepToken(activeHits, displayStepFactor));
                }

                beatGroups.push(beatTokens);
            }

            return beatGroups;
        });
    },

    // Pick the coarsest displayed subdivision that still matches all note onsets in a beat
    getBeatDisplayStepFactor: function(beatHits, stepsPerBeat) {
        const candidateFactors = [8, 4, 2].filter((factor) => factor <= stepsPerBeat);

        for (const factor of candidateFactors) {
            if (stepsPerBeat % factor !== 0) {
                continue;
            }

            const alignsToFactor = Object.values(beatHits).every((hits) => {
                return hits.every((hit, index) => {
                    if (!hit || hit === '-') {
                        return true;
                    }

                    return index % factor === 0;
                });
            });

            if (alignsToFactor) {
                return factor;
            }
        }

        return 1;
    },

    // Add an ABC duration only when a note/rest lasts longer than the base unit
    withDuration: function(token, duration) {
        return duration > 1 ? token + String(duration) : token;
    },

    // Join beat groups into a measure string while keeping beam resets at beat boundaries
    groupMeasureTokens: function(measureTokens) {
        return measureTokens.map((beatTokens) => beatTokens.join('')).join(' ');
    },

    // Build an ABC token for one rhythmic step, applying per-note decorations for hit types
    buildStepToken: function(activeHits, duration) {
        if (!activeHits.length) {
            return this.withDuration('z', duration);
        }

        // Flam hits produce a grace note prefix; the drum also appears as a main note
        const flamHits = activeHits.filter(({ hit }) => hit === 'f');
        let gracePrefix = '';
        if (flamHits.length > 0) {
            const gracePitches = flamHits.map(({ laneKey }) => this.lanePitches[laneKey]);
            gracePrefix = gracePitches.length === 1
                ? `{${gracePitches[0]}}`
                : `{[${gracePitches.join('')}]}`;
        }

        // Build each pitch with its own decoration. Ghost and rim-click hits use shadow pitches
        // that %%map routes to the correct staff line with the appropriate notehead.
        // Hi-hat foot variants in the kick lane render at a separate pitch below the kick.
        const seen = new Set();
        const decoratedPitches = [];
        for (const { laneKey, hit } of activeHits) {
            if (laneKey === 'kick' && (hit === 'p' || hit === 'b')) {
                if (hit === 'b') {
                    const kickPitch = this.lanePitches.kick;
                    if (!seen.has(kickPitch)) { seen.add(kickPitch); decoratedPitches.push(kickPitch); }
                }
                const footPitch = this.hihatFootPitch;
                if (!seen.has(footPitch)) { seen.add(footPitch); decoratedPitches.push(footPitch); }
                continue;
            }

            const pitch = (hit === 'g' && this.ghostPitches[laneKey])
                ? this.ghostPitches[laneKey]
                : (hit === 'r' && this.rimPitches[laneKey])
                    ? this.rimPitches[laneKey]
                    : this.lanePitches[laneKey];
            if (seen.has(pitch)) continue;
            seen.add(pitch);

            const dec = (hit === 'O' || hit === 'X') ? '!>!' : (hit === '+') ? '!open!' : '';
            decoratedPitches.push(dec + pitch);
        }

        const noteToken = decoratedPitches.length === 1
            ? decoratedPitches[0]
            : '[' + decoratedPitches.join('') + ']';

        return gracePrefix + this.withDuration(noteToken, duration);
    }
};
