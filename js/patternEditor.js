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
    dragMode: null,        // 'paint' | 'erase'
    lastDragCellKey: null, // '<laneKey>-<index>' to skip re-painting same cell
    drumColors: {
        crash: '#F59E0B',
        hihat: '#FF6B35',
        ride:  '#06B6D4',
        hitom: '#8B5CF6',
        midtom: '#6366F1',
        snare: '#004E89',
        lowtom: '#10B981',
        kick: '#2ECC71'
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
        hihat:   [{ label: 'Normal', char: 'x' }, { label: 'Accent', char: 'X' }, { label: 'Ghost', char: 'g' }],
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
        const normal = options.find((o) => o.label === 'Normal');
        return normal ? normal.char : null;
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

    // Render the header strip above each measure: text label, + and × buttons
    renderMeasureHeaders: function(wrapper, groove, layout) {
        const { gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat, stepsPerMeasure } = layout;
        const measures = groove.measures;
        const measureText = DrumUtils.normalizeMeasureText(groove.measureText, measures);

        const makeSvgBtn = (x, y, w, h, label, fillColor, textColor, onClick) => {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.style.cursor = 'pointer';

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', String(x));
            rect.setAttribute('y', String(y));
            rect.setAttribute('width', String(w));
            rect.setAttribute('height', String(h));
            rect.setAttribute('rx', '3');
            rect.setAttribute('fill', fillColor);
            rect.setAttribute('stroke', textColor);
            rect.setAttribute('stroke-width', '0.8');
            rect.setAttribute('opacity', '0.75');

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', String(x + w / 2));
            text.setAttribute('y', String(y + h / 2));
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'central');
            text.setAttribute('font-size', '10');
            text.setAttribute('fill', textColor);
            text.setAttribute('pointer-events', 'none');
            text.textContent = label;

            g.appendChild(rect);
            g.appendChild(text);

            g.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
            g.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });
            g.addEventListener('mouseenter', () => rect.setAttribute('opacity', '1'));
            g.addEventListener('mouseleave', () => rect.setAttribute('opacity', '0.75'));

            return g;
        };

        for (let measureIndex = 0; measureIndex < measures; measureIndex++) {
            const startStep = measureIndex * stepsPerMeasure;
            const endStep = startStep + stepsPerMeasure - 1;
            const x = this.getCellX(startStep, gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat);
            const endX = this.getCellX(endStep, gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat) + cellWidth;
            const measureWidth = endX - x;

            const btnColumnW = measures > 1 ? 20 : 0;
            const inputWidth = Math.max(20, measureWidth - btnColumnW - 2);

            const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
            foreignObject.setAttribute('x', String(x));
            foreignObject.setAttribute('y', '4');
            foreignObject.setAttribute('width', String(inputWidth));
            foreignObject.setAttribute('height', '22');

            const htmlWrapper = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
            htmlWrapper.className = 'measure-text-input-wrap';

            const input = document.createElementNS('http://www.w3.org/1999/xhtml', 'input');
            input.type = 'text';
            input.className = 'measure-text-input';
            input.value = measureText[measureIndex] || '';
            input.placeholder = `M${measureIndex + 1}`;
            input.maxLength = 20;
            input.setAttribute('data-measure-index', String(measureIndex));
            input.addEventListener('input', (event) => {
                GrooveEditor.updateMeasureText(measureIndex, event.target.value);
            });

            htmlWrapper.appendChild(input);
            foreignObject.appendChild(htmlWrapper);
            wrapper.appendChild(foreignObject);

            if (measures > 1) {
                const delX = endX - 18;
                const del = makeSvgBtn(delX, 4, 16, 16, '×', '#3a1a1a', '#cc6666',
                    () => GrooveEditor.deleteMeasure(measureIndex));
                wrapper.appendChild(del);
            }

            const isLast = measureIndex === measures - 1;
            const barX = isLast
                ? endX + beatGap
                : this.getCellX((measureIndex + 1) * stepsPerMeasure, gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat) - beatGap / 2;
            const add = makeSvgBtn(Math.round(barX - 8), 26, 16, 14, '+', '#1a2e1a', '#66cc66',
                () => GrooveEditor.addMeasure(measureIndex));
            wrapper.appendChild(add);
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
            labelBg.setAttribute('fill', '#1e1e1e');
            labelBg.setAttribute('rx', '0');
            labelGroup.appendChild(labelBg);

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', String(labelWidth));
            label.setAttribute('y', drum.y + trackHeight / 2);
            label.setAttribute('text-anchor', 'end');
            label.setAttribute('dominant-baseline', 'central');
            label.setAttribute('font-size', '12');
            label.setAttribute('fill', '#cccccc');
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
                cellBg.setAttribute('fill', isDownbeat ? '#2e2e2e' : '#252525');
                cellBg.setAttribute('data-downbeat', isDownbeat ? '1' : '0');
                cellBg.setAttribute('stroke', '#3a3a3a');
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
                        cellBg.setAttribute('fill', '#3d3d3d');
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
                    line.setAttribute('stroke', '#666');
                    line.setAttribute('stroke-width', '2');
                    wrapper.appendChild(line);
                } else if (this.isBeatBoundary(index, stepsPerBeat)) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    const lineX = this.getCellX(index + 1, gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat) - (beatGap / 2);
                    line.setAttribute('x1', lineX);
                    line.setAttribute('y1', drum.y + 1);
                    line.setAttribute('x2', lineX);
                    line.setAttribute('y2', drum.y + cellHeight - 1);
                    line.setAttribute('stroke', '#484848');
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
        labelMask.setAttribute('fill', '#1a1a1a');
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
        if (laneType === 'hihat-open') return current === '+';
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
        return hitChar === 'g' || hitChar === '+' || hitChar === 'p';
    },

    getDisplayHit: function(rawHit, laneType) {
        if (!rawHit || rawHit === '-' || rawHit === '') return '-';
        switch (laneType) {
            case 'hihat-closed': return (rawHit === 'x' || rawHit === 'X' || rawHit === 'g') ? rawHit : '-';
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
                const r = Math.max(3, cellHeight * 0.28);
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', String(cx));
                circle.setAttribute('cy', String(midY));
                circle.setAttribute('r', String(r));
                circle.setAttribute('fill', 'none');
                circle.setAttribute('stroke', color);
                circle.setAttribute('stroke-width', '1.5');
                circle.setAttribute('pointer-events', 'none');
                circle.setAttribute('class', 'drum-hit');
                group.appendChild(circle);
                break;
            }
            case 'f':
                fillCell();
                addText('♩');
                break;
            case 'r':
                fillCell();
                addText('×');
                break;
            case '+': {
                const r = Math.max(3, cellHeight * 0.28);
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', String(cx));
                circle.setAttribute('cy', String(midY));
                circle.setAttribute('r', String(r));
                circle.setAttribute('fill', 'none');
                circle.setAttribute('stroke', color);
                circle.setAttribute('stroke-width', '1.5');
                circle.setAttribute('stroke-dasharray', '2,1');
                circle.setAttribute('pointer-events', 'none');
                circle.setAttribute('class', 'drum-hit');
                group.appendChild(circle);
                break;
            }
            case 'p': {
                const d = Math.max(3, cellHeight * 0.3);
                const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                diamond.setAttribute('points', `${cx},${midY - d} ${cx + d},${midY} ${cx},${midY + d} ${cx - d},${midY}`);
                diamond.setAttribute('fill', 'none');
                diamond.setAttribute('stroke', color);
                diamond.setAttribute('stroke-width', '1.5');
                diamond.setAttribute('pointer-events', 'none');
                diamond.setAttribute('class', 'drum-hit');
                group.appendChild(diamond);
                break;
            }
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
        cellBg.setAttribute('fill', '#3d3520');
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
            const baseFill = cellBg.getAttribute('data-downbeat') === '1' ? '#2e2e2e' : '#252525';
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
