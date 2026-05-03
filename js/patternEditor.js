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
        hitom: '#8B5CF6',
        midtom: '#6366F1',
        snare: '#004E89',
        lowtom: '#10B981',
        kick: '#2ECC71'
    },
    drumLaneConfig: [
        { name: 'Crash', shortLabel: 'C', key: 'crash', hitChar: 'x' },
        { name: 'Hi-Hat', shortLabel: 'H', key: 'hihat', hitChar: 'x' },
        { name: 'Hi-Tom', shortLabel: 'T1', key: 'hitom', hitChar: 'o' },
        { name: 'Mid-Tom', shortLabel: 'T2', key: 'midtom', hitChar: 'o' },
        { name: 'Snare', shortLabel: 'S', key: 'snare', hitChar: 'o' },
        { name: 'Low-Tom', shortLabel: 'T4', key: 'lowtom', hitChar: 'o' },
        { name: 'Kick', shortLabel: 'K', key: 'kick', hitChar: 'o' }
    ],

    noteTypeOptions: {
        crash:  [{ label: 'Normal', char: 'x' }, { label: 'Accent', char: 'X' }],
        hihat:  [{ label: 'Normal', char: 'x' }, { label: 'Accent', char: 'X' }, { label: 'Open', char: '+' }, { label: 'Ghost', char: 'g' }],
        hitom:  [{ label: 'Normal', char: 'o' }, { label: 'Accent', char: 'O' }, { label: 'Ghost', char: 'g' }, { label: 'Flam', char: 'f' }],
        midtom: [{ label: 'Normal', char: 'o' }, { label: 'Accent', char: 'O' }, { label: 'Ghost', char: 'g' }, { label: 'Flam', char: 'f' }],
        snare:  [{ label: 'Normal', char: 'o' }, { label: 'Accent', char: 'O' }, { label: 'Ghost', char: 'g' }, { label: 'Rim Click', char: 'r' }, { label: 'Flam', char: 'f' }],
        lowtom: [{ label: 'Normal', char: 'o' }, { label: 'Accent', char: 'O' }, { label: 'Ghost', char: 'g' }, { label: 'Flam', char: 'f' }],
        kick:   [{ label: 'Kick Drum', char: 'o' }, { label: 'Hi-Hat Foot', char: 'p' }, { label: 'Kick + Hi-Hat Foot', char: 'b' }]
    },

    contextMenuState: { drumKey: null, hitIndex: null },
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
        const margin = 46;
        const trackHeight = 42;
        const trackGap = 10;
        const cellWidth = 14;
        const cellHeight = 28;
        const cellGap = 2;
        const beatGap = 8;
        const labelWidth = 72;
        const gridStartX = labelWidth + 14;
        const stepsPerMeasure = DrumUtils.calculateStepsPerMeasure(groove.timeSignature, groove.division);
        const beatsPerMeasure = this.getGridBeatCount(groove.timeSignature);
        const stepsPerBeat = Math.max(1, Math.round(stepsPerMeasure / beatsPerMeasure));

        const drums = this.drumLaneConfig.map((lane, index) => ({
            name: lane.name,
            shortLabel: lane.shortLabel,
            key: lane.key,
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
            labelBg.setAttribute('x', '5');
            labelBg.setAttribute('y', drum.y);
            labelBg.setAttribute('width', String(labelWidth));
            labelBg.setAttribute('height', '36');
            labelBg.setAttribute('fill', drum.color);
            labelBg.setAttribute('opacity', '0.12');
            labelBg.setAttribute('rx', '4');
            labelGroup.appendChild(labelBg);

            // Label text
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', '12');
            label.setAttribute('y', drum.y + 23);
            label.setAttribute('font-size', '12');
            label.setAttribute('font-weight', 'bold');
            label.setAttribute('fill', drum.color);
            label.setAttribute('class', 'drum-label');
            label.setAttribute('data-drum', drum.key);
            label.setAttribute('cursor', 'pointer');
            label.textContent = drum.shortLabel;
            label.style.cursor = 'pointer';
            labelGroup.appendChild(label);

            const labelSubtext = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            labelSubtext.setAttribute('x', '30');
            labelSubtext.setAttribute('y', drum.y + 23);
            labelSubtext.setAttribute('font-size', '10');
            labelSubtext.setAttribute('fill', '#475569');
            labelSubtext.textContent = drum.name;
            labelGroup.appendChild(labelSubtext);

            wrapper.appendChild(labelGroup);

            // Draw groove hits for this drum
            hits.forEach((hit, index) => {
                const cellX = this.getCellX(index, gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat);
                const cellY = drum.y + 5;

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
                cellBg.setAttribute('fill', '#f0f0f0');
                cellBg.setAttribute('stroke', '#cbd5e1');
                cellBg.setAttribute('stroke-width', '1');
                cellBg.setAttribute('rx', '2');
                if (index === this.playbackStepIndex) {
                    this.applyPlaybackHighlight(cellBg, drum.color);
                }
                cellGroup.appendChild(cellBg);

                // Draw hit indicator
                if (hit !== '-' && hit !== '') {
                    this.drawHitSymbol(cellGroup, cellX + cellWidth / 2, cellY, cellHeight, hit, drum.color);
                }

                // Add click event (mouse only; touch handled via touchend below)
                cellGroup.addEventListener('click', (e) => {
                    if (this.editMode) {
                        this.toggleHit(drum.key, index);
                    }
                });

                cellGroup.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (this.editMode) {
                        this.showNoteContextMenu(e, drum.key, index);
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
                            drum.key, index
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
                            this.toggleHit(drum.key, index);
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
                    if (index !== this.playbackStepIndex) {
                        cellBg.setAttribute('fill', this.editMode ? '#e0e0e0' : '#f5f5f5');
                    }
                });

                cellGroup.addEventListener('mouseleave', () => {
                    this.restoreCellBackground(cellBg, index, drum.color);
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
                    line.setAttribute('stroke', '#475569');
                    line.setAttribute('stroke-width', '2');
                    wrapper.appendChild(line);
                } else if (this.isBeatBoundary(index, stepsPerBeat)) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    const lineX = this.getCellX(index + 1, gridStartX, cellWidth, cellGap, beatGap, stepsPerBeat) - (beatGap / 2);
                    line.setAttribute('x1', lineX);
                    line.setAttribute('y1', drum.y + 1);
                    line.setAttribute('x2', lineX);
                    line.setAttribute('y2', drum.y + cellHeight + 3);
                    line.setAttribute('stroke', '#CBD5E1');
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

    // Toggle a hit at specific position
    toggleHit: function(drumType, hitIndex) {
        const groove = GrooveEditor.currentGroove;
        const drumLane = this.drumLaneConfig.find((lane) => lane.key === drumType);
        if (!drumLane) {
            return;
        }

        const pattern = DrumUtils.grooveToArray(groove[drumType]);
        const key = drumType;

        // Toggle between hit and rest
        if (pattern[hitIndex] === '-' || pattern[hitIndex] === '') {
            pattern[hitIndex] = drumLane.hitChar;
        } else {
            // Remove hit
            pattern[hitIndex] = '-';
        }

        // Convert back to string and update groove
        groove[key] = DrumUtils.arrayToGroove(pattern, groove.measures, groove.division, groove.timeSignature);

        // Re-render the full groove so notation and grid stay in sync
        GrooveEditor.render();
        GrooveEditor.updateURL();
    },

    // Draw the correct symbol for a hit based on its character type
    drawHitSymbol: function(group, cx, cellY, cellHeight, hitChar, color) {
        const midY = cellY + cellHeight / 2;

        switch (hitChar) {
            case 'O': case 'X': {
                // Accent: filled circle shifted slightly down + small caret above
                const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                const tx = cx, ty = cellY + 5;
                poly.setAttribute('points', `${tx},${ty} ${tx - 3.5},${ty + 5} ${tx + 3.5},${ty + 5}`);
                poly.setAttribute('fill', color);
                poly.setAttribute('class', 'drum-hit');
                group.appendChild(poly);

                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', cx);
                circle.setAttribute('cy', midY + 3);
                circle.setAttribute('r', '5');
                circle.setAttribute('fill', color);
                circle.setAttribute('class', 'drum-hit');
                group.appendChild(circle);
                break;
            }
            case 'g': {
                // Ghost: hollow circle
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', cx);
                circle.setAttribute('cy', midY);
                circle.setAttribute('r', '4');
                circle.setAttribute('fill', 'none');
                circle.setAttribute('stroke', color);
                circle.setAttribute('stroke-width', '1.5');
                circle.setAttribute('class', 'drum-hit');
                group.appendChild(circle);
                break;
            }
            case 'r': {
                // Rim click: X mark
                const d = 4.5;
                const makeRimLine = (x1, y1, x2, y2) => {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
                    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
                    line.setAttribute('stroke', color);
                    line.setAttribute('stroke-width', '2');
                    line.setAttribute('stroke-linecap', 'round');
                    line.setAttribute('class', 'drum-hit');
                    group.appendChild(line);
                };
                makeRimLine(cx - d, midY - d, cx + d, midY + d);
                makeRimLine(cx + d, midY - d, cx - d, midY + d);
                break;
            }
            case 'f': {
                // Flam: small grace note (upper) + main note (lower)
                const grace = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                grace.setAttribute('cx', cx - 2);
                grace.setAttribute('cy', cellY + 9);
                grace.setAttribute('r', '2.5');
                grace.setAttribute('fill', color);
                grace.setAttribute('opacity', '0.65');
                grace.setAttribute('class', 'drum-hit');
                group.appendChild(grace);

                const main = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                main.setAttribute('cx', cx + 1);
                main.setAttribute('cy', midY + 4);
                main.setAttribute('r', '4');
                main.setAttribute('fill', color);
                main.setAttribute('class', 'drum-hit');
                group.appendChild(main);
                break;
            }
            case '+': {
                // Open hi-hat: x mark (lower) + small hollow circle above
                const openCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                openCircle.setAttribute('cx', cx);
                openCircle.setAttribute('cy', cellY + 6);
                openCircle.setAttribute('r', '3');
                openCircle.setAttribute('fill', 'none');
                openCircle.setAttribute('stroke', color);
                openCircle.setAttribute('stroke-width', '1.5');
                openCircle.setAttribute('class', 'drum-hit');
                group.appendChild(openCircle);

                const xd = 4;
                const xy = midY + 2;
                const makeOpenXLine = (x1, y1, x2, y2) => {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
                    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
                    line.setAttribute('stroke', color);
                    line.setAttribute('stroke-width', '2');
                    line.setAttribute('stroke-linecap', 'round');
                    line.setAttribute('class', 'drum-hit');
                    group.appendChild(line);
                };
                makeOpenXLine(cx - xd, xy - xd, cx + xd, xy + xd);
                makeOpenXLine(cx + xd, xy - xd, cx - xd, xy + xd);
                break;
            }
            case 'p': {
                // Hi-hat foot: hollow diamond
                const d = 5;
                const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                diamond.setAttribute('points', `${cx},${midY - d} ${cx + d},${midY} ${cx},${midY + d} ${cx - d},${midY}`);
                diamond.setAttribute('fill', 'none');
                diamond.setAttribute('stroke', color);
                diamond.setAttribute('stroke-width', '1.5');
                diamond.setAttribute('class', 'drum-hit');
                group.appendChild(diamond);
                break;
            }
            case 'b': {
                // Kick + hi-hat foot: filled circle (kick) with small diamond above
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', cx);
                circle.setAttribute('cy', midY + 3);
                circle.setAttribute('r', '4');
                circle.setAttribute('fill', color);
                circle.setAttribute('class', 'drum-hit');
                group.appendChild(circle);

                const d = 3.5;
                const dcy = midY - 8;
                const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                diamond.setAttribute('points', `${cx},${dcy - d} ${cx + d},${dcy} ${cx},${dcy + d} ${cx - d},${dcy}`);
                diamond.setAttribute('fill', color);
                diamond.setAttribute('class', 'drum-hit');
                group.appendChild(diamond);
                break;
            }
            default: {
                // Normal: filled circle centered in cell
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', cx);
                circle.setAttribute('cy', midY);
                circle.setAttribute('r', '4.5');
                circle.setAttribute('fill', color);
                circle.setAttribute('class', 'drum-hit');
                group.appendChild(circle);
                break;
            }
        }
    },

    // Show the note-type context menu at the cursor position
    showNoteContextMenu: function(e, drumKey, hitIndex) {
        this.contextMenuState = { drumKey, hitIndex };

        const groove = GrooveEditor.currentGroove;
        const pattern = DrumUtils.grooveToArray(groove[drumKey]);
        const currentHit = pattern[hitIndex] || '-';
        const options = this.noteTypeOptions[drumKey] || [];
        const laneName = (this.drumLaneConfig.find((l) => l.key === drumKey) || {}).name || drumKey;
        const isActive = currentHit !== '-' && currentHit !== '';

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
                this.setHitType(this.contextMenuState.drumKey, this.contextMenuState.hitIndex, btn.getAttribute('data-char'));
                this.hideNoteContextMenu();
            });
        });
    },

    // Hide the note-type context menu
    hideNoteContextMenu: function() {
        const menu = document.getElementById('noteContextMenu');
        if (menu) menu.classList.add('hidden');
        this.contextMenuState = { drumKey: null, hitIndex: null };
    },

    // Set a specific hit character at the given position
    setHitType: function(drumKey, hitIndex, char) {
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
        cellBg.setAttribute('fill', '#FEF3C7');
        cellBg.setAttribute('stroke', drumColor);
        cellBg.setAttribute('stroke-width', '2');
    },

    // Restore the default visual state for a playback cell
    clearPlaybackHighlight: function(cellBg) {
        this.restoreCellBackground(cellBg, Number(cellBg.parentElement.getAttribute('data-index')), this.drumColors[cellBg.parentElement.getAttribute('data-drum')]);
    },

    // Restore the correct non-hover background for a cell
    restoreCellBackground: function(cellBg, stepIndex, drumColor) {
        if (stepIndex === this.playbackStepIndex) {
            this.applyPlaybackHighlight(cellBg, drumColor);
            return;
        }

        cellBg.setAttribute('fill', '#f0f0f0');
        cellBg.setAttribute('stroke', '#ddd');
        cellBg.setAttribute('stroke-width', '1');
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
