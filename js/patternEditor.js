/**
 * Groove Pattern Editor - Interactive grid for editing drum patterns
 */

const GroovePatternEditor = {
    currentDrumType: 'hihat',
    editMode: true,
    playbackStepIndex: null,
    activePlaybackCells: [],
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

    contextMenuState: { drumKey: null, laneKey: null, hitIndex: null },
    _suppressNextTap: false,

    // Group compound eighth-note meters into dotted-quarter beats for grid spacing
    getGridBeatCount: function(timeSignature) {
        const timeSig = DrumUtils.parseTimeSignature(timeSignature);

        if (timeSig.denominator === 8 && timeSig.numerator > 3 && timeSig.numerator % 3 === 0) {
            return timeSig.numerator / 3;
        }

        return timeSig.numerator;
    },
    
    // Initialize the pattern editor
    init: function() {
        this.render();
        this.bindEvents();
    },

    // Set which drum to edit
    selectDrumType: function(drumType) {
        this.currentDrumType = drumType;
        this.render();
    },

    // Render the interactive groove grid
    render: function() {
        const container = document.getElementById('sheetMusic');
        if (!container) return;

        container.innerHTML = '';
        const groove = GrooveEditor.currentGroove;
        
        // Create main wrapper
        const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        wrapper.setAttribute('id', 'groove-wrapper');
        
        // Draw the groove pattern grid
        this.drawGrooveGrid(wrapper, groove);

        container.appendChild(wrapper);
        this.updatePlaybackHighlight();
    },

    // Render one text input above each measure inside the SVG so alignment matches exactly
    renderMeasureTextInputs: function(wrapper, groove, layout) {
        const {
            gridStartX,
            cellWidth,
            cellGap,
            beatGap,
            stepsPerBeat,
            stepsPerMeasure
        } = layout;

        const measureText = DrumUtils.normalizeMeasureText(groove.measureText, groove.measures);

        for (let measureIndex = 0; measureIndex < groove.measures; measureIndex++) {
            const startStep = measureIndex * stepsPerMeasure;
            const endStep = startStep + stepsPerMeasure - 1;
            const x = this.getCellX(startStep, gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat);
            const endX = this.getCellX(endStep, gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat) + cellWidth;
            const measureWidth = endX - x;
            const inputWidth = Math.min(measureWidth, 180);

            const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
            foreignObject.setAttribute('x', x);
            foreignObject.setAttribute('y', 8);
            foreignObject.setAttribute('width', inputWidth);
            foreignObject.setAttribute('height', 32);

            const htmlWrapper = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
            htmlWrapper.className = 'measure-text-input-wrap';

            const input = document.createElementNS('http://www.w3.org/1999/xhtml', 'input');
            input.type = 'text';
            input.className = 'measure-text-input';
            input.value = measureText[measureIndex] || '';
            input.placeholder = `Measure ${measureIndex + 1}`;
            input.maxLength = 20;
            input.setAttribute('data-measure-index', String(measureIndex));

            input.addEventListener('input', (event) => {
                GrooveEditor.updateMeasureText(measureIndex, event.target.value);
            });

            htmlWrapper.appendChild(input);
            foreignObject.appendChild(htmlWrapper);
            wrapper.appendChild(foreignObject);
        }
    },

    // Draw the interactive groove grid
    drawGrooveGrid: function(wrapper, groove) {
        const isTabletPortrait = window.matchMedia('(min-width: 641px) and (max-width: 1100px) and (orientation: portrait)').matches;
        const margin = 42;
        const trackHeight = isTabletPortrait ? 40 : 26;
        const trackGap = isTabletPortrait ? 4 : 2;
        const cellWidth = isTabletPortrait ? 18 : 14;
        const cellHeight = isTabletPortrait ? 28 : 18;
        const cellGap = isTabletPortrait ? 2 : 1;
        const beatGap = isTabletPortrait ? 8 : 4;
        const labelWidth = isTabletPortrait ? 68 : 68;
        const gridStartX = labelWidth + 8;
        const stepsPerMeasure = DrumUtils.calculateStepsPerMeasure(groove.timeSignature, groove.division);
        const beatsPerMeasure = this.getGridBeatCount(groove.timeSignature);
        const stepsPerBeat = Math.max(1, Math.round(stepsPerMeasure / beatsPerMeasure));

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

        this.renderMeasureTextInputs(wrapper, groove, {
            gridStartX,
            cellWidth,
            cellGap,
            beatGap,
            stepsPerBeat,
            stepsPerMeasure
        });

        drums.forEach((drum) => {
            const hits = DrumUtils.grooveToArray(drum.data);
            
            // Draw drum label and selector button
            const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            
            // Background for label
            const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            labelBg.setAttribute('x', '0');
            labelBg.setAttribute('y', drum.y);
            labelBg.setAttribute('width', String(labelWidth + 8));
            labelBg.setAttribute('height', String(cellHeight));
            labelBg.setAttribute('fill', '#1e1e1e');
            labelBg.setAttribute('rx', '0');
            labelGroup.appendChild(labelBg);

            // Label text (full name, right-aligned)
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', String(labelWidth));
            label.setAttribute('y', drum.y + (isTabletPortrait ? 19 : 12));
            label.setAttribute('text-anchor', 'end');
            label.setAttribute('dominant-baseline', 'central');
            label.setAttribute('font-size', isTabletPortrait ? '12' : '10');
            label.setAttribute('fill', '#cccccc');
            label.setAttribute('class', 'drum-label');
            label.setAttribute('data-drum', drum.key);
            label.setAttribute('cursor', 'pointer');
            label.textContent = drum.name;
            label.style.cursor = 'pointer';
            labelGroup.appendChild(label);

            wrapper.appendChild(labelGroup);

            // Draw groove hits for this drum
            hits.forEach((hit, index) => {
                const cellX = this.getCellX(index, gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat);
                const cellY = drum.y + (isTabletPortrait ? 8 : 5);
                const displayHit = this.getDisplayHit(hit, drum.laneType);

                // Create clickable cell
                const cellGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                cellGroup.setAttribute('class', 'groove-cell');
                cellGroup.setAttribute('data-drum', drum.key);
                cellGroup.setAttribute('data-index', index);
                cellGroup.style.cursor = this.editMode ? 'pointer' : 'default';

                // Cell background
                const cellBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                cellBg.setAttribute('class', 'groove-cell-bg');
                cellBg.setAttribute('x', cellX);
                cellBg.setAttribute('y', cellY);
                cellBg.setAttribute('width', cellWidth);
                cellBg.setAttribute('height', cellHeight);
                cellBg.setAttribute('fill', '#252525');
                cellBg.setAttribute('stroke', '#3a3a3a');
                cellBg.setAttribute('stroke-width', '1');
                cellBg.setAttribute('rx', '2');
                cellBg.setAttribute('data-display-hit', displayHit);
                if (index === this.playbackStepIndex) {
                    this.applyPlaybackHighlight(cellBg, drum.color);
                }
                cellGroup.appendChild(cellBg);

                // Draw hit indicator
                if (displayHit !== '-' && displayHit !== '') {
                    this.drawHitSymbol(cellGroup, cellX + cellWidth / 2, cellY, cellHeight, displayHit, drum.color, cellBg);
                }

                // Add click event (mouse only; touch handled via touchend below)
                cellGroup.addEventListener('click', (e) => {
                    if (this.editMode) {
                        this.toggleHit(drum.key, drum.laneKey, index, drum.laneType);
                    }
                });

                cellGroup.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (this.editMode) {
                        this.showNoteContextMenu(e, drum.key, drum.laneKey, index);
                    }
                });

                // Touch: long-press → context menu, short tap → toggle.
                // e.preventDefault() on touchstart is the only reliable way to stop
                // iOS Safari from showing its own copy/callout menu on long press.
                // It also suppresses the synthetic click, so toggle lives in touchend.
                let longPressTimer = null;
                let touchStartX = 0;
                let touchStartY = 0;
                let touchMoved = false;

                cellGroup.addEventListener('touchstart', (e) => {
                    if (!this.editMode) return;
                    e.preventDefault();
                    touchMoved = false;
                    // If the context menu is open, the tap should just close it
                    const menu = document.getElementById('noteContextMenu');
                    if (menu && !menu.classList.contains('hidden')) {
                        this._suppressNextTap = true;
                    }
                    const touch = e.touches[0];
                    touchStartX = touch.clientX;
                    touchStartY = touch.clientY;
                    longPressTimer = setTimeout(() => {
                        longPressTimer = null;
                        if (navigator.vibrate) navigator.vibrate(30);
                        this.showNoteContextMenu(
                            { clientX: touch.clientX, clientY: touch.clientY },
                            drum.key, drum.laneKey, index
                        );
                    }, 500);
                });

                cellGroup.addEventListener('touchmove', (e) => {
                    if (longPressTimer === null) return;
                    const touch = e.touches[0];
                    const dx = touch.clientX - touchStartX;
                    const dy = touch.clientY - touchStartY;
                    if (dx * dx + dy * dy > 64) {
                        touchMoved = true;
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                }, { passive: true });

                const onTouchEnd = () => {
                    if (longPressTimer !== null) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                        if (!touchMoved && !this._suppressNextTap) {
                            this.toggleHit(drum.key, drum.laneKey, index, drum.laneType);
                        }
                    }
                    this._suppressNextTap = false;
                };
                cellGroup.addEventListener('touchend', onTouchEnd);
                cellGroup.addEventListener('touchcancel', () => {
                    if (longPressTimer !== null) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                    this._suppressNextTap = false;
                });

                cellGroup.addEventListener('mouseenter', () => {
                    if (index !== this.playbackStepIndex && (displayHit === '-' || displayHit === '')) {
                        cellBg.setAttribute('fill', '#3d3d3d');
                    }
                });

                cellGroup.addEventListener('mouseleave', () => {
                    this.restoreCellBackground(cellBg, index, drum.key, drum.color);
                });

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

        // Set SVG dimensions
        const totalWidth = totalSteps > 0
            ? this.getCellX(totalSteps - 1, gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat) + cellWidth + margin
            : gridStartX + margin;
        document.getElementById('sheetMusic').setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight + 20}`);
        document.getElementById('sheetMusic').setAttribute('width', Math.min(totalWidth, 1200));
        document.getElementById('sheetMusic').setAttribute('height', totalHeight + 22);
    },

    // Calculate the X position for a step with extra spacing between beats
    getCellX: function(index, gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat) {
        const beatIndex = Math.floor(index / stepsPerBeat);
        return gridStartX + (index * (cellWidth + cellGap)) + (beatIndex * beatGap);
    },

    // Detect beat boundaries for visual grouping
    isBeatBoundary: function(index, stepsPerBeat) {
        return (index + 1) % stepsPerBeat === 0;
    },

    // Detect measure boundaries for stronger separators
    isMeasureBoundary: function(index, stepsPerMeasure) {
        return (index + 1) % stepsPerMeasure === 0;
    },

    // Toggle a hit at specific position, with lane-type-aware logic for split lanes
    toggleHit: function(drumKey, laneKey, hitIndex, laneType) {
        const groove = GrooveEditor.currentGroove;
        const pattern = DrumUtils.grooveToArray(groove[drumKey]);
        const current = pattern[hitIndex] || '-';

        switch (laneType) {
            case 'hihat-closed':
                // Toggle closed hi-hat; if open is present, replace it with closed
                pattern[hitIndex] = (current === 'x' || current === 'X' || current === 'g') ? '-' : 'x';
                break;
            case 'hihat-open':
                // Toggle open hi-hat; if closed is present, replace it with open
                pattern[hitIndex] = current === '+' ? '-' : '+';
                break;
            case 'kick':
                // Toggle kick component; preserve pedal if present
                if (current === '-')      pattern[hitIndex] = 'o';
                else if (current === 'o') pattern[hitIndex] = '-';
                else if (current === 'p') pattern[hitIndex] = 'b';
                else if (current === 'b') pattern[hitIndex] = 'p';
                break;
            case 'pedal':
                // Toggle pedal component; preserve kick if present
                if (current === '-')      pattern[hitIndex] = 'p';
                else if (current === 'p') pattern[hitIndex] = '-';
                else if (current === 'o') pattern[hitIndex] = 'b';
                else if (current === 'b') pattern[hitIndex] = 'o';
                break;
            default: {
                const drumLane = this.drumLaneConfig.find((lane) => lane.laneKey === laneKey);
                if (!drumLane) return;
                pattern[hitIndex] = (current === '-' || current === '') ? drumLane.hitChar : '-';
            }
        }

        groove[drumKey] = DrumUtils.arrayToGroove(pattern, groove.measures, groove.division, groove.timeSignature);
        GrooveEditor.render();
        GrooveEditor.updateURL();
    },

    // Returns true for hit types that are drawn as outlines on a dark cell (not filled)
    isOutlineHit: function(hitChar) {
        return hitChar === 'g' || hitChar === '+' || hitChar === 'p';
    },

    // Returns the character to display for a lane given the raw stored value.
    // Split lanes (hihat-closed, hihat-open, kick, pedal) only show their own note type.
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

    // Look up the current hit character for a drum lane at a step index
    getCellHit: function(drumKey, stepIndex) {
        const groove = GrooveEditor.currentGroove;
        if (!groove || !groove[drumKey]) return '-';
        const pattern = DrumUtils.grooveToArray(groove[drumKey]);
        return pattern[stepIndex] || '-';
    },

    // Draw the correct symbol for a hit based on its character type.
    // Filled hits (normal, accent, flam, rim, kick) fill the cellBg rect with color.
    // Outline hits (ghost, open hi-hat, hi-hat foot) draw on top of the dark cell.
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
                // Ghost: hollow circle on dark cell
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
                // Open hi-hat: dashed hollow circle on dark cell
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
                // Hi-hat foot: hollow diamond on dark cell
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
                // Kick + hi-hat foot: filled cell + small white diamond
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
                // Normal: fill entire cell with drum color
                fillCell();
                break;
        }
    },

    // Show the note-type context menu at the cursor position
    showNoteContextMenu: function(e, drumKey, laneKey, hitIndex) {
        const options = this.noteTypeOptions[laneKey] || [];
        if (options.length === 0) return;

        this.contextMenuState = { drumKey, laneKey, hitIndex };

        const groove = GrooveEditor.currentGroove;
        const pattern = DrumUtils.grooveToArray(groove[drumKey]);
        const currentHit = pattern[hitIndex] || '-';
        const displayHit = this.getDisplayHit(currentHit, (this.drumLaneConfig.find((l) => l.laneKey === laneKey) || {}).laneType || null);
        const laneName = (this.drumLaneConfig.find((l) => l.laneKey === laneKey) || {}).name || laneKey;
        const isActive = displayHit !== '-' && displayHit !== '';

        const menu = document.getElementById('noteContextMenu');
        if (!menu) return;

        let html = `<div class="note-context-title">${laneName}</div>`;
        options.forEach((option) => {
            const isCurrent = currentHit === option.char;
            html += `<button class="note-context-item${isCurrent ? ' is-current' : ''}" data-char="${option.char}">${option.label}</button>`;
        });
        if (isActive) {
            html += '<div class="note-context-sep"></div>';
            html += '<button class="note-context-item note-context-remove" data-char="-">Remove</button>';
        }

        menu.innerHTML = html;
        menu.classList.remove('hidden');

        // Position after content is set so clientWidth/Height are accurate
        const menuW = menu.offsetWidth || 150;
        const menuH = menu.offsetHeight || 200;
        const x = Math.min(e.clientX + 2, window.innerWidth - menuW - 8);
        const y = Math.min(e.clientY + 2, window.innerHeight - menuH - 8);
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        menu.querySelectorAll('.note-context-item').forEach((btn) => {
            btn.addEventListener('click', (evt) => {
                evt.stopPropagation();
                this.setHitType(this.contextMenuState.drumKey, this.contextMenuState.laneKey, this.contextMenuState.hitIndex, btn.getAttribute('data-char'));
                this.hideNoteContextMenu();
            });
        });
    },

    // Hide the note-type context menu
    hideNoteContextMenu: function() {
        const menu = document.getElementById('noteContextMenu');
        if (menu) menu.classList.add('hidden');
        this.contextMenuState = { drumKey: null, laneKey: null, hitIndex: null };
    },

    // Set a specific hit character at the given position
    setHitType: function(drumKey, laneKey, hitIndex, char) {
        if (!drumKey || hitIndex === null) return;
        const groove = GrooveEditor.currentGroove;
        const pattern = DrumUtils.grooveToArray(groove[drumKey]);
        pattern[hitIndex] = char;
        groove[drumKey] = DrumUtils.arrayToGroove(pattern, groove.measures, groove.division, groove.timeSignature);
        GrooveEditor.render();
        GrooveEditor.updateURL();
    },

    // Bind event listeners
    bindEvents: function() {
        // Drum label click to select
        const wrapper = document.getElementById('sheetMusic');
        if (wrapper) {
            wrapper.addEventListener('click', (e) => {
                if (e.target.classList.contains('drum-label')) {
                    const drum = e.target.getAttribute('data-drum');
                    this.selectDrumType(drum);
                }
            });
        }

        // Dismiss context menu when clicking/tapping outside it or pressing Escape
        const dismissOutside = (e) => {
            if (!e.target.closest('#noteContextMenu')) {
                this.hideNoteContextMenu();
            }
        };
        document.addEventListener('click', dismissOutside);
        document.addEventListener('touchstart', dismissOutside, { passive: true });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hideNoteContextMenu();
        });
    },

    // Enable/disable edit mode
    setEditMode: function(enabled) {
        this.editMode = enabled;
        this.render();
        
        // Update cursor for all cells
        const cells = document.querySelectorAll('.groove-cell');
        cells.forEach(cell => {
            cell.style.cursor = enabled ? 'pointer' : 'default';
        });
    },

    // Clear current drum pattern
    clearDrumPattern: function(drumType) {
        const groove = GrooveEditor.currentGroove;
        const emptyPattern = DrumUtils.normalizeGroovePattern('', groove.measures, groove.division, groove.timeSignature, '-');
        
        switch (drumType) {
            case 'crash':
                groove.crash = emptyPattern;
                break;
            case 'hihat':
                groove.hihat = emptyPattern;
                break;
            case 'hitom':
                groove.hitom = emptyPattern;
                break;
            case 'midtom':
                groove.midtom = emptyPattern;
                break;
            case 'snare':
                groove.snare = emptyPattern;
                break;
            case 'lowtom':
                groove.lowtom = emptyPattern;
                break;
            case 'kick':
                groove.kick = emptyPattern;
                break;
        }
        
        GrooveEditor.render();
        GrooveEditor.updateURL();
    },

    // Apply highlight styling to a cell during playback
    applyPlaybackHighlight: function(cellBg, drumColor) {
        cellBg.setAttribute('fill', '#3d3520');
        cellBg.setAttribute('stroke', drumColor);
        cellBg.setAttribute('stroke-width', '2');
    },

    // Restore the default visual state for a playback cell
    clearPlaybackHighlight: function(cellBg) {
        const drumKey = cellBg.parentElement.getAttribute('data-drum');
        const stepIndex = Number(cellBg.parentElement.getAttribute('data-index'));
        const drumColor = this.drumColors[drumKey];
        this.restoreCellBackground(cellBg, stepIndex, drumKey, drumColor);
    },

    // Restore the correct non-hover background for a cell using its stored display-hit attribute
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
            cellBg.setAttribute('fill', '#252525');
            cellBg.setAttribute('stroke', '#3a3a3a');
            cellBg.setAttribute('stroke-width', '1');
        }
    },

    // Update DOM elements for the active playback step without re-rendering the grid
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

    // Update the highlighted playback step
    setPlaybackStep: function(stepIndex) {
        this.playbackStepIndex = Number.isInteger(stepIndex) ? stepIndex : null;
        this.updatePlaybackHighlight();
    }
};
