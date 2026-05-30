/**
 * Groove Pattern Editor - Interactive grid for editing drum patterns
 */

const GroovePatternEditor = {
    currentDrumType: 'hihat',
    editMode: true,
    playbackStepIndex: null,
    activePlaybackCells: [],
    selectedNoteType: 'normal',
    isDragging: false,
    dragMode: null,
    lastDragCellKey: null,
    patterns: [],
    activePatternIndex: 0,
    drumColors: {
        crash:  '#F59E0B',
        hihat:  '#F97316',
        ride:   '#22D3EE',
        hitom:  '#A855F7',
        midtom: '#818CF8',
        snare:  '#F97316',
        lowtom: '#34D399',
        kick:   '#FB923C'
    },
    drumLaneConfig: [
        { name: 'Crash',       shortLabel: 'C',  key: 'crash',  laneKey: 'crash',   hitChar: 'x' },
        { name: 'Hi-Hat',      shortLabel: 'HH', key: 'hihat',  laneKey: 'hihat',   hitChar: 'x', laneType: 'hihat-closed' },
        { name: 'Open Hi-Hat', shortLabel: 'OH', key: 'hihat',  laneKey: 'openhat', hitChar: '+', laneType: 'hihat-open' },
        { name: 'Ride',        shortLabel: 'R',  key: 'ride',   laneKey: 'ride',    hitChar: 'x' },
        { name: 'Hi-Tom',      shortLabel: 'T1', key: 'hitom',  laneKey: 'hitom',   hitChar: 'o' },
        { name: 'Mid-Tom',     shortLabel: 'T2', key: 'midtom', laneKey: 'midtom',  hitChar: 'o' },
        { name: 'Low-Tom',     shortLabel: 'T4', key: 'lowtom', laneKey: 'lowtom',  hitChar: 'o' },
        { name: 'Snare',       shortLabel: 'S',  key: 'snare',  laneKey: 'snare',   hitChar: 'o' },
        { name: 'Kick',        shortLabel: 'K',  key: 'kick',   laneKey: 'kick',    hitChar: 'o', laneType: 'kick' },
        { name: 'HH Pedal',    shortLabel: 'P',  key: 'kick',   laneKey: 'pedal',   hitChar: 'p', laneType: 'pedal' },
    ],

    noteTypeOptions: {
        crash:   [{ label: 'Normal', char: 'x' }, { label: 'Accent', char: 'X' }],
        hihat:   [{ label: 'Normal', char: 'x' }, { label: 'Accent', char: 'X' }],
        openhat: [],
        ride:    [{ label: 'Normal', char: 'x' }, { label: 'Accent', char: 'X' }],
        hitom:   [{ label: 'Normal', char: 'o' }, { label: 'Accent', char: 'O' }, { label: 'Ghost', char: 'g' }, { label: 'Flam', char: 'f' }],
        midtom:  [{ label: 'Normal', char: 'o' }, { label: 'Accent', char: 'O' }, { label: 'Ghost', char: 'g' }, { label: 'Flam', char: 'f' }],
        snare:   [{ label: 'Normal', char: 'o' }, { label: 'Accent', char: 'O' }, { label: 'Ghost', char: 'g' }, { label: 'Rim Click', char: 'r' }, { label: 'Flam', char: 'f' }],
        lowtom:  [{ label: 'Normal', char: 'o' }, { label: 'Accent', char: 'O' }, { label: 'Ghost', char: 'g' }, { label: 'Flam', char: 'f' }],
        kick:    [],
        pedal:   [],
    },

    // Group compound eighth-note meters into dotted-quarter beats for grid spacing
    getGridBeatCount: function(timeSignature) {
        const timeSig = DrumUtils.parseTimeSignature(timeSignature);

        if (timeSig.denominator === 8 && timeSig.numerator > 3 && timeSig.numerator % 3 === 0) {
            return timeSig.numerator / 3;
        }

        return timeSig.numerator;
    },

    init: function() {
        this.initPatterns();
        this.render();
        this.bindEvents();
    },

    selectDrumType: function(drumType) {
        this.currentDrumType = drumType;
        this.render();
    },

    // Switch the active note type and update toolbar highlight
    selectNoteType: function(type) {
        this.selectedNoteType = type;
        document.querySelectorAll('.note-type-btn').forEach((btn) => {
            btn.classList.toggle('is-active', btn.getAttribute('data-type') === type);
        });
    },

    // Return the correct hit character for the selected note type on a given lane,
    // falling back to Normal when the type isn't valid for that lane.
    resolveNoteChar: function(noteType, laneKey) {
        const labelMap = {
            normal:   'Normal',
            accent:   'Accent',
            ghost:    'Ghost',
            rimclick: 'Rim Click',
            flam:     'Flam',
        };
        const options = this.noteTypeOptions[laneKey] || [];
        const target = labelMap[noteType];
        const match = options.find((o) => o.label === target);
        if (match) return match.char;
        // Only fall back to Normal when Normal is explicitly selected.
        // Any other unsupported type (Ghost, Flam, Rim Click on an incompatible
        // lane) returns null so paintCell does nothing — no accidental erase.
        if (noteType === 'normal') {
            const normal = options.find((o) => o.label === 'Normal');
            return normal ? normal.char : null;
        }
        return null;
    },

    // Render the interactive groove grid
    render: function() {
        const container = document.getElementById('sheetMusic');
        if (!container) return;

        container.innerHTML = '';
        const groove = GrooveEditor.currentGroove;

        const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        wrapper.setAttribute('id', 'groove-wrapper');

        this.drawGrooveGrid(wrapper, groove);

        container.appendChild(wrapper);
        this.updatePlaybackHighlight();

        const scrollContainer = container.parentElement;
        const applyLabelOffset = () => {
            const overlay = document.getElementById('labels-overlay');
            if (overlay) overlay.setAttribute('transform', `translate(${scrollContainer.scrollLeft}, 0)`);
        };
        applyLabelOffset();
        scrollContainer.onscroll = applyLabelOffset;
    },

    // Render measure name label(s) and the + / − bar button.
    renderMeasureHeaders: function(wrapper, groove, layout) {
        const { gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat, stepsPerMeasure } = layout;
        const activePat = this.patterns[this.activePatternIndex];
        const patMeasures = (activePat && activePat.measures) || 1;
        const ns = 'http://www.w3.org/2000/svg';

        // Label above each measure
        for (let m = 0; m < patMeasures; m++) {
            const startStep = m * stepsPerMeasure;
            const endStep   = startStep + stepsPerMeasure - 1;
            const x    = this.getCellX(startStep, gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat);
            const endX = this.getCellX(endStep,   gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat) + cellWidth;

            const label = document.createElementNS(ns, 'text');
            label.setAttribute('x', String(x + (endX - x) / 2));
            label.setAttribute('y', '15');
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('dominant-baseline', 'central');
            label.setAttribute('font-size', '11');
            label.setAttribute('fill', '#a09080');
            label.setAttribute('pointer-events', 'none');
            label.textContent = m === 0
                ? (activePat ? activePat.name : (groove.measureText[0] || 'M1'))
                : 'bar 2';
            wrapper.appendChild(label);
        }

        // + or − button at the right edge of the grid
        const lastStep = patMeasures * stepsPerMeasure - 1;
        const lastCellRight = this.getCellX(lastStep, gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat) + cellWidth;
        const btnX    = lastCellRight + beatGap + 4;
        const btnY    = 3;
        const btnSize = 24;

        const makeBtn = (symbol, fillIdle, fillHover, stroke, onClick) => {
            const g = document.createElementNS(ns, 'g');
            g.style.cursor = 'pointer';

            const rect = document.createElementNS(ns, 'rect');
            rect.setAttribute('x', String(btnX));
            rect.setAttribute('y', String(btnY));
            rect.setAttribute('width',  String(btnSize));
            rect.setAttribute('height', String(btnSize));
            rect.setAttribute('rx', '5');
            rect.setAttribute('fill', fillIdle);
            rect.setAttribute('stroke', stroke);
            rect.setAttribute('stroke-width', '1.2');

            const txt = document.createElementNS(ns, 'text');
            txt.setAttribute('x', String(btnX + btnSize / 2));
            txt.setAttribute('y', String(btnY + btnSize / 2 + 1));
            txt.setAttribute('text-anchor', 'middle');
            txt.setAttribute('dominant-baseline', 'central');
            txt.setAttribute('font-size', '18');
            txt.setAttribute('fill', stroke);
            txt.setAttribute('pointer-events', 'none');
            txt.textContent = symbol;

            g.appendChild(rect);
            g.appendChild(txt);
            g.addEventListener('click',      (e) => { e.stopPropagation(); onClick(); });
            g.addEventListener('touchend',   (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });
            g.addEventListener('mouseenter', () => rect.setAttribute('fill', fillHover));
            g.addEventListener('mouseleave', () => rect.setAttribute('fill', fillIdle));
            wrapper.appendChild(g);
        };

        if (patMeasures < 2) {
            makeBtn('+', '#1a2e1a', '#2a4a2a', '#66cc66',
                () => this.addMeasureToPattern());
        } else {
            makeBtn('−', '#2e1a1a', '#4a2a2a', '#cc6666',
                () => {
                    if (confirm('Remove bar 2? Its notes will be lost.')) {
                        this.removeMeasureFromPattern();
                    }
                });
        }
    },

    // Draw the interactive groove grid
    drawGrooveGrid: function(wrapper, groove) {
        const isTabletPortrait = window.matchMedia('(min-width: 641px) and (max-width: 1100px) and (orientation: portrait)').matches;
        const margin = 42;
        const trackGap = 1;
        const cellGap = isTabletPortrait ? 2 : 1;
        const beatGap = isTabletPortrait ? 8 : 4;
        const labelWidth = 68;
        const gridStartX = labelWidth + 8;
        const stepsPerMeasure = DrumUtils.calculateStepsPerMeasure(groove.timeSignature, groove.division);
        const beatsPerMeasure = this.getGridBeatCount(groove.timeSignature);
        const stepsPerBeat = Math.max(1, Math.round(stepsPerMeasure / beatsPerMeasure));

        const numLanes = this.drumLaneConfig.length;
        const svgParent = document.getElementById('sheetMusic').parentElement;
        const containerHeight = svgParent.clientHeight - 24;
        const containerWidth = svgParent.clientWidth - 24;
        const minCellSize = isTabletPortrait ? 12 : 8;
        const trackHeight = containerHeight > 0
            ? Math.max(minCellSize + 2, Math.floor(
                (containerHeight - margin - 22 - trackGap * (numLanes - 1)) / numLanes
              ))
            : (isTabletPortrait ? 40 : 26);
        const cellWidth = containerWidth > 0
            ? Math.max(minCellSize, Math.floor(
                (containerWidth - gridStartX - margin - (2 * stepsPerMeasure - 1) * cellGap - (2 * beatsPerMeasure - 1) * beatGap)
                / (2 * stepsPerMeasure)
              ))
            : (isTabletPortrait ? 18 : 14);
        const cellHeight = Math.min(cellWidth, trackHeight - 2);

        const drums = this.drumLaneConfig.map((lane, index) => ({
            name: lane.name,
            shortLabel: lane.shortLabel,
            key: lane.key,
            laneKey: lane.laneKey || lane.key,
            laneType: lane.laneType || null,
            data: groove[lane.key],
            y: margin + ((trackHeight + trackGap) * index),
            color: this.drumColors[lane.key],
            hitChar: lane.hitChar
        }));

        let totalHeight = 0;
        const totalSteps = DrumUtils.grooveToArray(groove.hihat).length;

        this.renderMeasureHeaders(wrapper, groove, {
            gridStartX,
            cellWidth,
            cellGap,
            beatGap,
            stepsPerBeat,
            stepsPerMeasure
        });

        const labelsOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        labelsOverlay.setAttribute('id', 'labels-overlay');

        drums.forEach((drum) => {
            const hits = DrumUtils.grooveToArray(drum.data);

            const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

            const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            labelBg.setAttribute('x', '0');
            labelBg.setAttribute('y', drum.y);
            labelBg.setAttribute('width', String(labelWidth + 8));
            labelBg.setAttribute('height', String(trackHeight));
            labelBg.setAttribute('fill', '#2a2018');
            labelBg.setAttribute('rx', '0');
            labelGroup.appendChild(labelBg);

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', String(labelWidth));
            label.setAttribute('y', drum.y + trackHeight / 2);
            label.setAttribute('text-anchor', 'end');
            label.setAttribute('dominant-baseline', 'central');
            label.setAttribute('font-size', '12');
            label.setAttribute('fill', '#f0ebe5');
            label.setAttribute('class', 'drum-label');
            label.setAttribute('data-drum', drum.key);
            label.setAttribute('cursor', 'pointer');
            label.textContent = drum.name;
            label.style.cursor = 'pointer';
            labelGroup.appendChild(label);

            labelsOverlay.appendChild(labelGroup);

            hits.forEach((hit, index) => {
                const cellX = this.getCellX(index, gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat);
                const cellY = drum.y + Math.floor((trackHeight - cellHeight) / 2);
                const displayHit = this.getDisplayHit(hit, drum.laneType);

                const cellGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                cellGroup.setAttribute('class', 'groove-cell');
                cellGroup.setAttribute('data-drum', drum.key);
                cellGroup.setAttribute('data-lane', drum.laneKey);
                if (drum.laneType) cellGroup.setAttribute('data-lane-type', drum.laneType);
                cellGroup.setAttribute('data-index', index);
                cellGroup.style.cursor = this.editMode ? 'pointer' : 'default';

                const cellBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                cellBg.setAttribute('class', 'groove-cell-bg');
                cellBg.setAttribute('x', cellX);
                cellBg.setAttribute('y', cellY);
                cellBg.setAttribute('width', cellWidth);
                cellBg.setAttribute('height', cellHeight);
                const isDownbeat = (index % stepsPerBeat) === 0;
                cellBg.setAttribute('fill', isDownbeat ? '#302a22' : '#261f18');
                cellBg.setAttribute('data-downbeat', isDownbeat ? '1' : '0');
                cellBg.setAttribute('stroke', '#3d3228');
                cellBg.setAttribute('stroke-width', '1');
                cellBg.setAttribute('rx', '2');
                cellBg.setAttribute('data-display-hit', displayHit);
                if (index === this.playbackStepIndex) {
                    this.applyPlaybackHighlight(cellBg, drum.color);
                }
                cellGroup.appendChild(cellBg);

                if (displayHit !== '-' && displayHit !== '') {
                    this.drawHitSymbol(cellGroup, cellX + cellWidth / 2, cellY, cellHeight, displayHit, drum.color, cellBg);
                }

                // mousedown starts a drag and paints the first cell
                cellGroup.addEventListener('mousedown', (e) => {
                    if (e.button !== 0 || !this.editMode) return;
                    e.preventDefault();
                    const current = (DrumUtils.grooveToArray(GrooveEditor.currentGroove[drum.key])[index]) || '-';
                    this.isDragging = true;
                    this.dragMode = this._isEraseStart(current, drum.laneKey, drum.laneType) ? 'erase' : 'paint';
                    this.lastDragCellKey = `${drum.laneKey}-${index}`;
                    this.paintCell(drum.key, drum.laneKey, index, drum.laneType);
                });

                // mouseenter paints during drag, or shows hover tint when idle
                cellGroup.addEventListener('mouseenter', () => {
                    if (this.isDragging && this.editMode) {
                        const cellKey = `${drum.laneKey}-${index}`;
                        if (cellKey === this.lastDragCellKey) return;
                        this.lastDragCellKey = cellKey;
                        this.paintCell(drum.key, drum.laneKey, index, drum.laneType);
                        return;
                    }
                    if (index !== this.playbackStepIndex && (displayHit === '-' || displayHit === '')) {
                        cellBg.setAttribute('fill', '#403830');
                    }
                });

                cellGroup.addEventListener('mouseleave', () => {
                    this.restoreCellBackground(cellBg, index, drum.key, drum.color);
                });

                // Touch: touchstart begins drag, global touchmove continues it
                cellGroup.addEventListener('touchstart', (e) => {
                    if (!this.editMode) return;
                    e.preventDefault();
                    const current = (DrumUtils.grooveToArray(GrooveEditor.currentGroove[drum.key])[index]) || '-';
                    this.isDragging = true;
                    this.dragMode = this._isEraseStart(current, drum.laneKey, drum.laneType) ? 'erase' : 'paint';
                    this.lastDragCellKey = `${drum.laneKey}-${index}`;
                    this.paintCell(drum.key, drum.laneKey, index, drum.laneType);
                }, { passive: false });

                wrapper.appendChild(cellGroup);
            });

            for (let index = 0; index < hits.length - 1; index++) {
                if (this.isMeasureBoundary(index, stepsPerMeasure)) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    const lineX = this.getCellX(index + 1, gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat) - (beatGap / 2);
                    line.setAttribute('x1', lineX);
                    line.setAttribute('y1', drum.y - 3);
                    line.setAttribute('x2', lineX);
                    line.setAttribute('y2', drum.y + cellHeight + 7);
                    line.setAttribute('stroke', '#4a4038');
                    line.setAttribute('stroke-width', '2');
                    wrapper.appendChild(line);
                } else if (this.isBeatBoundary(index, stepsPerBeat)) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    const lineX = this.getCellX(index + 1, gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat) - (beatGap / 2);
                    line.setAttribute('x1', lineX);
                    line.setAttribute('y1', drum.y + 1);
                    line.setAttribute('x2', lineX);
                    line.setAttribute('y2', drum.y + cellHeight - 1);
                    line.setAttribute('stroke', '#3a2e24');
                    line.setAttribute('stroke-width', '1');
                    wrapper.appendChild(line);
                }
            }

            totalHeight = drum.y + trackHeight;
        });

        const labelMask = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        labelMask.setAttribute('x', '0');
        labelMask.setAttribute('y', '0');
        labelMask.setAttribute('width', String(gridStartX));
        labelMask.setAttribute('height', String(totalHeight + 20));
        labelMask.setAttribute('fill', '#1e1a12');
        labelsOverlay.insertBefore(labelMask, labelsOverlay.firstChild);
        wrapper.appendChild(labelsOverlay);

        const totalWidth = totalSteps > 0
            ? this.getCellX(totalSteps - 1, gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat) + cellWidth + margin
            : gridStartX + margin;
        document.getElementById('sheetMusic').setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight + 20}`);
        document.getElementById('sheetMusic').setAttribute('width', totalWidth);
        document.getElementById('sheetMusic').setAttribute('height', totalHeight + 22);
    },

    // Determine if a mousedown/touchstart should start an erase drag
    _isEraseStart: function(current, laneKey, laneType) {
        if (laneType === 'hihat-open') return this.selectedNoteType === 'normal' && current === '+';
        if (laneType === 'kick')       return current === 'o' || current === 'b';
        if (laneType === 'pedal')      return current === 'p' || current === 'b';
        const targetChar = this.resolveNoteChar(this.selectedNoteType, laneKey);
        return current === targetChar;
    },

    // Paint or erase a single cell according to the current drag mode
    paintCell: function(drumKey, laneKey, hitIndex, laneType) {
        const groove = GrooveEditor.currentGroove;
        const pattern = DrumUtils.grooveToArray(groove[drumKey]);
        const current = pattern[hitIndex] || '-';
        let targetChar;

        if (this.dragMode === 'erase') {
            if (laneType === 'kick') {
                if      (current === 'o') targetChar = '-';
                else if (current === 'b') targetChar = 'p';
                else return;
            } else if (laneType === 'pedal') {
                if      (current === 'p') targetChar = '-';
                else if (current === 'b') targetChar = 'o';
                else return;
            } else {
                if (current === '-') return;
                targetChar = '-';
            }
        } else {
            // paint mode
            if (laneType === 'hihat-open') {
                if (this.selectedNoteType !== 'normal') return;
                if (current === '+') return;
                targetChar = '+';
            } else if (laneType === 'kick') {
                if (current === 'o' || current === 'b') return;
                targetChar = current === 'p' ? 'b' : 'o';
            } else if (laneType === 'pedal') {
                if (current === 'p' || current === 'b') return;
                targetChar = current === 'o' ? 'b' : 'p';
            } else {
                targetChar = this.resolveNoteChar(this.selectedNoteType, laneKey);
                if (!targetChar || current === targetChar) return;
            }
        }

        pattern[hitIndex] = targetChar;
        groove[drumKey] = DrumUtils.arrayToGroove(pattern, groove.measures, groove.division, groove.timeSignature);
        this.syncFromCurrentGroove();
        GrooveEditor.render();
        GrooveEditor.updateURL();
    },

    getCellX: function(index, gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat) {
        const beatIndex = Math.floor(index / stepsPerBeat);
        return gridStartX + (index * (cellWidth + cellGap)) + (beatIndex * beatGap);
    },

    isBeatBoundary: function(index, stepsPerBeat) {
        return (index + 1) % stepsPerBeat === 0;
    },

    isMeasureBoundary: function(index, stepsPerMeasure) {
        return (index + 1) % stepsPerMeasure === 0;
    },

    isOutlineHit: function(hitChar) {
        return hitChar === 'g';
    },

    getDisplayHit: function(rawHit, laneType) {
        if (!rawHit || rawHit === '-' || rawHit === '') return '-';
        switch (laneType) {
            case 'hihat-closed': return (rawHit === 'x' || rawHit === 'X') ? rawHit : '-';
            case 'hihat-open':   return rawHit === '+' ? '+' : '-';
            case 'kick':         return (rawHit === 'o' || rawHit === 'b') ? 'o' : '-';
            case 'pedal':        return (rawHit === 'p' || rawHit === 'b') ? 'p' : '-';
            default:             return rawHit;
        }
    },

    getCellHit: function(drumKey, stepIndex) {
        const groove = GrooveEditor.currentGroove;
        if (!groove || !groove[drumKey]) return '-';
        const pattern = DrumUtils.grooveToArray(groove[drumKey]);
        return pattern[stepIndex] || '-';
    },

    drawHitSymbol: function(group, cx, cellY, cellHeight, hitChar, color, cellBg) {
        const midY = cellY + cellHeight / 2;
        const fontSize = Math.max(8, Math.round(cellHeight * 0.75));

        const fillCell = () => {
            cellBg.setAttribute('fill', color);
            cellBg.setAttribute('stroke', color);
        };

        const addText = (content) => {
            const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            t.setAttribute('x', String(cx));
            t.setAttribute('y', String(midY));
            t.setAttribute('text-anchor', 'middle');
            t.setAttribute('dominant-baseline', 'central');
            t.setAttribute('font-size', String(fontSize));
            t.setAttribute('font-weight', 'bold');
            t.setAttribute('fill', 'white');
            t.setAttribute('pointer-events', 'none');
            t.setAttribute('class', 'drum-hit');
            t.textContent = content;
            group.appendChild(t);
        };

        switch (hitChar) {
            case 'O': case 'X':
                fillCell();
                addText('>');
                break;
            case 'g': {
                const gt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                gt.setAttribute('x', String(cx));
                gt.setAttribute('y', String(midY));
                gt.setAttribute('text-anchor', 'middle');
                gt.setAttribute('dominant-baseline', 'central');
                gt.setAttribute('font-size', String(fontSize));
                gt.setAttribute('font-weight', 'bold');
                gt.setAttribute('fill', color);
                gt.setAttribute('pointer-events', 'none');
                gt.setAttribute('class', 'drum-hit');
                gt.textContent = 'o';
                group.appendChild(gt);
                break;
            }
            case 'f': {
                fillCell();
                const fns = 'http://www.w3.org/2000/svg';
                // Scale based only on cellHeight — cellWidth is not in scope here
                const sc = Math.max(0.5, cellHeight / 24);
                const bY = midY + 2.5 * sc;   // notehead baseline
                const gx = cx - 4 * sc;        // grace note X
                const mx = cx + 3 * sc;        // main note X

                // Slur arc
                const sl = document.createElementNS(fns, 'path');
                sl.setAttribute('d', `M${gx} ${midY - sc} Q${cx} ${midY - 5 * sc} ${mx} ${midY - sc}`);
                sl.setAttribute('stroke', 'white');
                sl.setAttribute('stroke-width', String(Math.max(0.5, 0.7 * sc)));
                sl.setAttribute('fill', 'none');
                sl.setAttribute('stroke-linecap', 'round');
                sl.setAttribute('pointer-events', 'none');
                group.appendChild(sl);

                // Grace notehead (small)
                const gh = document.createElementNS(fns, 'ellipse');
                gh.setAttribute('cx', String(gx));
                gh.setAttribute('cy', String(bY));
                gh.setAttribute('rx', String(1.6 * sc));
                gh.setAttribute('ry', String(1.1 * sc));
                gh.setAttribute('transform', `rotate(-20 ${gx} ${bY})`);
                gh.setAttribute('fill', 'white');
                gh.setAttribute('pointer-events', 'none');
                group.appendChild(gh);

                // Grace stem
                const gst = document.createElementNS(fns, 'line');
                gst.setAttribute('x1', String(gx + 1.4 * sc));
                gst.setAttribute('y1', String(bY - sc));
                gst.setAttribute('x2', String(gx + 1.4 * sc));
                gst.setAttribute('y2', String(bY - 6 * sc));
                gst.setAttribute('stroke', 'white');
                gst.setAttribute('stroke-width', String(Math.max(0.5, 0.7 * sc)));
                gst.setAttribute('pointer-events', 'none');
                group.appendChild(gst);

                // Grace flag
                const gfl = document.createElementNS(fns, 'line');
                gfl.setAttribute('x1', String(gx + 1.4 * sc));
                gfl.setAttribute('y1', String(bY - 5 * sc));
                gfl.setAttribute('x2', String(gx + 4 * sc));
                gfl.setAttribute('y2', String(bY - 3 * sc));
                gfl.setAttribute('stroke', 'white');
                gfl.setAttribute('stroke-width', String(Math.max(0.5, 0.7 * sc)));
                gfl.setAttribute('pointer-events', 'none');
                group.appendChild(gfl);

                // Main notehead (larger)
                const mh = document.createElementNS(fns, 'ellipse');
                mh.setAttribute('cx', String(mx));
                mh.setAttribute('cy', String(bY));
                mh.setAttribute('rx', String(2.4 * sc));
                mh.setAttribute('ry', String(1.7 * sc));
                mh.setAttribute('transform', `rotate(-20 ${mx} ${bY})`);
                mh.setAttribute('fill', 'white');
                mh.setAttribute('pointer-events', 'none');
                group.appendChild(mh);

                // Main stem
                const mst = document.createElementNS(fns, 'line');
                mst.setAttribute('x1', String(mx + 2.2 * sc));
                mst.setAttribute('y1', String(bY - 1.5 * sc));
                mst.setAttribute('x2', String(mx + 2.2 * sc));
                mst.setAttribute('y2', String(bY - 7.5 * sc));
                mst.setAttribute('stroke', 'white');
                mst.setAttribute('stroke-width', String(Math.max(0.6, sc)));
                mst.setAttribute('pointer-events', 'none');
                group.appendChild(mst);

                break;
            }
            case 'r':
                fillCell();
                addText('x');
                break;
            case '+':
                fillCell();
                break;
            case 'p':
                fillCell();
                break;
            case 'b':
                fillCell();
                // eslint-disable-next-line no-case-declarations
                const d = Math.max(2, cellHeight * 0.22);
                // eslint-disable-next-line no-case-declarations
                const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                diamond.setAttribute('points', `${cx},${midY - d} ${cx + d},${midY} ${cx},${midY + d} ${cx - d},${midY}`);
                diamond.setAttribute('fill', 'white');
                diamond.setAttribute('opacity', '0.6');
                diamond.setAttribute('pointer-events', 'none');
                diamond.setAttribute('class', 'drum-hit');
                group.appendChild(diamond);
                break;
            default:
                fillCell();
                break;
        }
    },

    // Bind event listeners
    bindEvents: function() {
        // Drum label click
        const wrapper = document.getElementById('sheetMusic');
        if (wrapper) {
            wrapper.addEventListener('click', (e) => {
                if (e.target.classList.contains('drum-label')) {
                    this.selectDrumType(e.target.getAttribute('data-drum'));
                }
            });
        }

        // Note type toolbar buttons
        document.querySelectorAll('.note-type-btn').forEach((btn) => {
            btn.addEventListener('click', () => this.selectNoteType(btn.getAttribute('data-type')));
        });

        // End drag on mouse release anywhere
        document.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.dragMode = null;
            this.lastDragCellKey = null;
        });

        // Touch drag: find cell under finger and paint it
        document.addEventListener('touchmove', (e) => {
            if (!this.isDragging || !this.editMode) return;
            e.preventDefault();
            const touch = e.touches[0];
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            if (!el) return;
            const cellGroup = el.closest ? el.closest('.groove-cell') : null;
            if (!cellGroup) return;
            const drumKey = cellGroup.getAttribute('data-drum');
            const hitIndex = Number(cellGroup.getAttribute('data-index'));
            const laneKey = cellGroup.getAttribute('data-lane');
            const laneType = cellGroup.getAttribute('data-lane-type') || null;
            const cellKey = `${laneKey}-${hitIndex}`;
            if (cellKey === this.lastDragCellKey) return;
            this.lastDragCellKey = cellKey;
            this.paintCell(drumKey, laneKey, hitIndex, laneType);
        }, { passive: false });

        // End touch drag
        const endTouchDrag = () => {
            this.isDragging = false;
            this.dragMode = null;
            this.lastDragCellKey = null;
        };
        document.addEventListener('touchend', endTouchDrag);
        document.addEventListener('touchcancel', endTouchDrag);
    },

    // ── Pattern management ─────────────────────────────────────

    // Build patterns[] from whatever is currently in currentGroove.
    // Handles both old multi-measure files and fresh starts.
    initPatterns: function() {
        const g = GrooveEditor.currentGroove;
        const measures = g.measures || 1;
        const spm = DrumUtils.calculateStepsPerMeasure(g.timeSignature, g.division);
        const names = DrumUtils.normalizeMeasureText(g.measureText, measures);

        this.patterns = [];
        for (let i = 0; i < measures; i++) {
            const pat = { name: names[i] || `M${i + 1}`, measures: 1 };
            DrumUtils.drumLaneKeys.forEach((key) => {
                const all = DrumUtils.grooveToArray(g[key]);
                const slice = all.slice(i * spm, (i + 1) * spm);
                pat[key] = DrumUtils.arrayToGroove(slice, 1, g.division, g.timeSignature);
            });
            this.patterns.push(pat);
        }

        this.activePatternIndex = 0;
        this.syncToCurrentGroove(0);
        this.renderPatternTabs();
    },

    // Copy pattern[index] data into currentGroove (preserving its measure count).
    syncToCurrentGroove: function(index) {
        const p = this.patterns[index];
        const g = GrooveEditor.currentGroove;
        DrumUtils.drumLaneKeys.forEach((key) => { g[key] = p[key] || ''; });
        g.measures = p.measures || 1;
        g.measureText = Array.from({ length: g.measures }, (_, i) => i === 0 ? p.name : '');
    },

    // Write currentGroove lane data (and measure count) back into patterns[activePatternIndex].
    syncFromCurrentGroove: function() {
        const p = this.patterns[this.activePatternIndex];
        const g = GrooveEditor.currentGroove;
        DrumUtils.drumLaneKeys.forEach((key) => { p[key] = g[key] || ''; });
        p.measures = g.measures || 1;
    },

    // Switch the active pattern, load it and re-render everything.
    setActivePattern: function(index) {
        this.activePatternIndex = index;
        this.syncToCurrentGroove(index);
        this.renderPatternTabs();
        GrooveEditor.render();
    },

    // Add a new blank 1-bar pattern and switch to it.
    addPattern: function() {
        const n = this.patterns.length + 1;
        const g = GrooveEditor.currentGroove;
        const pat = { name: `M${n}`, measures: 1 };
        DrumUtils.drumLaneKeys.forEach((key) => {
            pat[key] = DrumUtils.normalizeGroovePattern('', 1, g.division, g.timeSignature, '-');
        });
        this.patterns.push(pat);
        this.setActivePattern(this.patterns.length - 1);
    },

    // Delete the pattern at index; refuse if only one remains.
    deletePattern: function(index) {
        if (this.patterns.length <= 1) return;
        this.patterns.splice(index, 1);
        const next = Math.min(this.activePatternIndex, this.patterns.length - 1);
        this.activePatternIndex = next;
        this.syncToCurrentGroove(next);
        this.renderPatternTabs();
        GrooveEditor.render();
    },

    // Save a new name for a pattern.
    renamePattern: function(index, name) {
        const trimmed = name.trim() || `M${index + 1}`;
        this.patterns[index].name = trimmed;
        if (index === this.activePatternIndex) {
            GrooveEditor.currentGroove.measureText = [trimmed];
        }
        this.renderPatternTabs();
    },

    // Extend the active pattern from 1 bar to 2 bars.
    addMeasureToPattern: function() {
        const p = this.patterns[this.activePatternIndex];
        if ((p.measures || 1) >= 2) return;
        const g = GrooveEditor.currentGroove;
        const spm = DrumUtils.calculateStepsPerMeasure(g.timeSignature, g.division);
        const empty = Array(spm).fill('-');
        DrumUtils.drumLaneKeys.forEach((key) => {
            const current = DrumUtils.grooveToArray(g[key]);
            g[key] = DrumUtils.arrayToGroove(current.concat(empty), 2, g.division, g.timeSignature);
        });
        g.measures = 2;
        g.measureText = [p.name, ''];
        p.measures = 2;
        this.syncFromCurrentGroove();
        GrooveEditor.render();
    },

    // Trim the active pattern back to 1 bar (discards bar 2 content).
    removeMeasureFromPattern: function() {
        const p = this.patterns[this.activePatternIndex];
        if ((p.measures || 1) <= 1) return;
        const g = GrooveEditor.currentGroove;
        const spm = DrumUtils.calculateStepsPerMeasure(g.timeSignature, g.division);
        DrumUtils.drumLaneKeys.forEach((key) => {
            const slice = DrumUtils.grooveToArray(g[key]).slice(0, spm);
            g[key] = DrumUtils.arrayToGroove(slice, 1, g.division, g.timeSignature);
        });
        g.measures = 1;
        g.measureText = [p.name];
        p.measures = 1;
        this.syncFromCurrentGroove();
        GrooveEditor.render();
    },

    // Resize every pattern's lane data when division or time signature changes.
    resizeAllPatterns: function(prevDivision, prevTimeSig, nextDivision, nextTimeSig) {
        this.patterns.forEach((pat, i) => {
            if (i === this.activePatternIndex) return; // currentGroove already resized
            const m = pat.measures || 1;
            DrumUtils.drumLaneKeys.forEach((key) => {
                pat[key] = DrumUtils.resizeGroovePattern(
                    pat[key], m, prevDivision, prevTimeSig,
                    m, nextDivision, nextTimeSig, '-'
                );
            });
        });
    },

    // Rebuild the pattern tab buttons from scratch.
    renderPatternTabs: function() {
        const container = document.getElementById('patternTabs');
        if (!container) return;
        container.innerHTML = '';

        this.patterns.forEach((pat, i) => {
            const tab = document.createElement('div');
            tab.className = 'pattern-tab' + (i === this.activePatternIndex ? ' is-active' : '');

            const nameEl = document.createElement('span');
            nameEl.className = 'pattern-tab-name';
            nameEl.textContent = pat.name;

            nameEl.addEventListener('click', () => {
                if (i === this.activePatternIndex) {
                    this._startRenaming(tab, nameEl, i);
                } else {
                    this.setActivePattern(i);
                }
            });

            tab.appendChild(nameEl);

            if (this.patterns.length > 1) {
                const del = document.createElement('button');
                del.className = 'pattern-tab-del';
                del.textContent = '×';
                del.title = 'Delete pattern';
                del.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete pattern "${pat.name}"?`)) {
                        this.deletePattern(i);
                    }
                });
                tab.appendChild(del);
            }

            container.appendChild(tab);
        });

        const addBtn = document.createElement('button');
        addBtn.className = 'pattern-add';
        addBtn.textContent = '+';
        addBtn.title = 'Add pattern';
        addBtn.addEventListener('click', () => this.addPattern());
        container.appendChild(addBtn);
    },

    // Inline rename: replaces the name span with a text input.
    _startRenaming: function(tab, nameEl, index) {
        if (tab.querySelector('input.pattern-tab-input')) return;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'pattern-tab-input';
        input.value = this.patterns[index].name;
        input.maxLength = 24;

        const commit = () => { this.renamePattern(index, input.value); };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') {
                input.removeEventListener('blur', commit);
                this.renderPatternTabs();
            }
        });

        nameEl.replaceWith(input);
        input.focus();
        input.select();
    },

    setEditMode: function(enabled) {
        this.editMode = enabled;
        this.render();
        document.querySelectorAll('.groove-cell').forEach((cell) => {
            cell.style.cursor = enabled ? 'pointer' : 'default';
        });
    },

    clearDrumPattern: function(drumType) {
        const groove = GrooveEditor.currentGroove;
        const emptyPattern = DrumUtils.normalizeGroovePattern('', groove.measures, groove.division, groove.timeSignature, '-');

        switch (drumType) {
            case 'crash':  groove.crash  = emptyPattern; break;
            case 'hihat':  groove.hihat  = emptyPattern; break;
            case 'hitom':  groove.hitom  = emptyPattern; break;
            case 'midtom': groove.midtom = emptyPattern; break;
            case 'snare':  groove.snare  = emptyPattern; break;
            case 'lowtom': groove.lowtom = emptyPattern; break;
            case 'kick':   groove.kick   = emptyPattern; break;
        }

        GrooveEditor.render();
        GrooveEditor.updateURL();
    },

    applyPlaybackHighlight: function(cellBg, drumColor) {
        cellBg.setAttribute('fill', '#4a3d1a');
        cellBg.setAttribute('stroke', drumColor);
        cellBg.setAttribute('stroke-width', '2');
    },

    clearPlaybackHighlight: function(cellBg) {
        const drumKey = cellBg.parentElement.getAttribute('data-drum');
        const stepIndex = Number(cellBg.parentElement.getAttribute('data-index'));
        const drumColor = this.drumColors[drumKey];
        this.restoreCellBackground(cellBg, stepIndex, drumKey, drumColor);
    },

    restoreCellBackground: function(cellBg, stepIndex, drumKey, drumColor) {
        if (stepIndex === this.playbackStepIndex) {
            this.applyPlaybackHighlight(cellBg, drumColor);
            return;
        }

        const displayHit = cellBg.getAttribute('data-display-hit') || '-';
        if (displayHit !== '-' && displayHit !== '' && !this.isOutlineHit(displayHit)) {
            cellBg.setAttribute('fill', drumColor);
            cellBg.setAttribute('stroke', drumColor);
            cellBg.setAttribute('stroke-width', '1');
        } else {
            const baseFill = cellBg.getAttribute('data-downbeat') === '1' ? '#302a22' : '#261f18';
            cellBg.setAttribute('fill', baseFill);
            cellBg.setAttribute('stroke', '#3a3a3a');
            cellBg.setAttribute('stroke-width', '1');
        }
    },

    updatePlaybackHighlight: function() {
        this.activePlaybackCells.forEach((cellBg) => {
            this.clearPlaybackHighlight(cellBg);
        });
        this.activePlaybackCells = [];

        if (!Number.isInteger(this.playbackStepIndex)) {
            return;
        }

        const activeCells = document.querySelectorAll(`.groove-cell[data-index="${this.playbackStepIndex}"] .groove-cell-bg`);
        activeCells.forEach((cellBg) => {
            const drumKey = cellBg.parentElement.getAttribute('data-drum');
            const drumColor = this.drumColors[drumKey] || '#333';
            this.applyPlaybackHighlight(cellBg, drumColor);
            this.activePlaybackCells.push(cellBg);
        });
    },

    setPlaybackStep: function(stepIndex) {
        this.playbackStepIndex = Number.isInteger(stepIndex) ? stepIndex : null;
        this.updatePlaybackHighlight();
    }
};
