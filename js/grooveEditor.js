/**
 * Groove Editor - Core groove creation and editing logic
 */

const GrooveEditor = {
    // Current groove data
    currentGroove: {
        title: '',
        author: '',
        comment: '',
        timeSignature: '4/4',
        division: 16,
        measures: 1,
        tempo: 80,
        swing: 0,
        measureText: [''],
        crash: '',
        hihat: '',
        hitom: '',
        midtom: '',
        snare: '',
        lowtom: '',
        kick: ''
    },

    // Initialize the editor
    init: function() {
        this.loadFromURL();
        this.ensureGroovePatterns();
        this.bindEvents();
        // Initialize the pattern editor
        if (typeof GroovePatternEditor !== 'undefined') {
            GroovePatternEditor.init();
        }
    },

    // Load groove data from URL or defaults
    loadFromURL: function() {
        const urlData = DrumUtils.parseGrooveFromURL();
        Object.assign(this.currentGroove, urlData);
    },

    // Create empty groove patterns
    ensureGroovePatterns: function() {
        const { measures, division, timeSignature } = this.currentGroove;
        this.currentGroove.measureText = DrumUtils.normalizeMeasureText(this.currentGroove.measureText, measures);
        DrumUtils.drumLaneKeys.forEach((drumKey) => {
            this.currentGroove[drumKey] = DrumUtils.normalizeGroovePattern(this.currentGroove[drumKey], measures, division, timeSignature, '-');
        });
    },

    // Resize existing patterns to new groove settings
    resizeGroovePatterns: function(nextSettings) {
        const previous = {
            measures: this.currentGroove.measures,
            division: this.currentGroove.division,
            timeSignature: this.currentGroove.timeSignature
        };

        DrumUtils.drumLaneKeys.forEach((drumKey) => {
            this.currentGroove[drumKey] = DrumUtils.resizeGroovePattern(
                this.currentGroove[drumKey],
                previous.measures,
                previous.division,
                previous.timeSignature,
                nextSettings.measures,
                nextSettings.division,
                nextSettings.timeSignature,
                '-'
            );
        });

        this.currentGroove.measures = nextSettings.measures;
        this.currentGroove.division = nextSettings.division;
        this.currentGroove.timeSignature = nextSettings.timeSignature;
        this.currentGroove.measureText = DrumUtils.normalizeMeasureText(this.currentGroove.measureText, nextSettings.measures);
    },

    // Resize only the measure count while preserving existing measures in place
    resizeMeasureCount: function(nextMeasureCount) {
        const division = this.currentGroove.division;
        const timeSignature = this.currentGroove.timeSignature;
        const stepsPerMeasure = DrumUtils.calculateStepsPerMeasure(timeSignature, division);

        DrumUtils.drumLaneKeys.forEach((drumKey) => {
            const normalizedPattern = DrumUtils.normalizeGroovePattern(
                this.currentGroove[drumKey],
                this.currentGroove.measures,
                division,
                timeSignature,
                '-'
            );
            const hits = DrumUtils.grooveToArray(normalizedPattern);
            const resizedHits = [];

            for (let measureIndex = 0; measureIndex < nextMeasureCount; measureIndex++) {
                const start = measureIndex * stepsPerMeasure;
                const end = start + stepsPerMeasure;
                const sourceMeasure = hits.slice(start, end);

                if (sourceMeasure.length === stepsPerMeasure) {
                    resizedHits.push(...sourceMeasure);
                } else {
                    resizedHits.push(...Array(stepsPerMeasure).fill('-'));
                }
            }

            this.currentGroove[drumKey] = DrumUtils.arrayToGroove(
                resizedHits,
                nextMeasureCount,
                division,
                timeSignature
            );
        });

        this.currentGroove.measures = nextMeasureCount;
        this.currentGroove.measureText = DrumUtils.normalizeMeasureText(this.currentGroove.measureText, nextMeasureCount);
    },

    // Update text attached to a specific measure without re-rendering the editor inputs
    updateMeasureText: function(measureIndex, value) {
        this.currentGroove.measureText = DrumUtils.normalizeMeasureText(this.currentGroove.measureText, this.currentGroove.measures);
        this.currentGroove.measureText[measureIndex] = value;
        this.updateURL();

        if (typeof DrumNotationRenderer !== 'undefined') {
            DrumNotationRenderer.render(this.currentGroove);
        }
    },

    // Bind UI events
    bindEvents: function() {
        // Title, Author, Comment inputs
        const titleInput = document.getElementById('titleInput');
        const authorInput = document.getElementById('authorInput');
        const commentInput = document.getElementById('commentInput');

        if (titleInput) titleInput.addEventListener('change', (e) => {
            this.currentGroove.title = e.target.value;
            this.updateURL();
        });

        if (authorInput) authorInput.addEventListener('change', (e) => {
            this.currentGroove.author = e.target.value;
        });

        if (commentInput) commentInput.addEventListener('change', (e) => {
            this.currentGroove.comment = e.target.value;
        });

        // Clear button
        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearGroove());
        }

        // Tempo controls
        const bpmInput = document.getElementById('bpmInput');
        const bpmSlider = document.getElementById('bpmSlider');

        if (bpmInput && bpmSlider) {
            bpmInput.addEventListener('change', (e) => {
                const value = Math.max(40, Math.min(300, parseInt(e.target.value) || 80));
                this.currentGroove.tempo = value;
                bpmSlider.value = value;
                bpmInput.value = value;
                this.render();
                this.updateURL();
            });

            bpmSlider.addEventListener('input', (e) => {
                this.currentGroove.tempo = parseInt(e.target.value);
                bpmInput.value = e.target.value;
                this.render();
                this.updateURL();
            });
        }

        // Swing controls
        const swingSlider = document.getElementById('swingSlider');
        const swingDisplay = document.getElementById('swingDisplay');

        if (swingSlider && swingDisplay) {
            swingSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.currentGroove.swing = value;
                swingDisplay.textContent = value + '%';
            });
        }

        // Time Signature
        const timeSignatureSelect = document.getElementById('timeSignature');
        if (timeSignatureSelect) {
            timeSignatureSelect.addEventListener('change', (e) => {
                this.resizeGroovePatterns({
                    timeSignature: e.target.value,
                    division: this.currentGroove.division,
                    measures: this.currentGroove.measures
                });
                this.render();
                this.updateURL();
            });
        }

        // Division
        const divisionSelect = document.getElementById('division');
        if (divisionSelect) {
            divisionSelect.addEventListener('change', (e) => {
                this.resizeGroovePatterns({
                    timeSignature: this.currentGroove.timeSignature,
                    division: parseInt(e.target.value),
                    measures: this.currentGroove.measures
                });
                this.render();
                this.updateURL();
            });
        }

        // Measures
        const measuresInput = document.getElementById('measuresInput');
        if (measuresInput) {
            const handleMeasureUpdate = (e) => {
                const value = Math.max(1, Math.min(32, parseInt(e.target.value) || 1));
                measuresInput.value = value;
                this.resizeMeasureCount(value);
                this.updateUI();
                this.render();
                this.updateURL();
            };

            measuresInput.addEventListener('input', handleMeasureUpdate);
            measuresInput.addEventListener('change', handleMeasureUpdate);
        }

        // Action buttons
        const downloadBtn = document.getElementById('downloadBtn');
        const printBtn = document.getElementById('printBtn');
        const shareBtn = document.getElementById('shareBtn');

        if (downloadBtn) downloadBtn.addEventListener('click', () => this.download());
        if (printBtn) printBtn.addEventListener('click', () => this.print());
        if (shareBtn) shareBtn.addEventListener('click', () => this.share());

        const saveFileBtn = document.getElementById('saveFileBtn');
        const openFileBtn = document.getElementById('openFileBtn');
        if (saveFileBtn) saveFileBtn.addEventListener('click', () => this.saveToFile());
        if (openFileBtn) openFileBtn.addEventListener('click', () => this.openFromFile());
    },

    // Clear the current groove
    clearGroove: function() {
        if (confirm('Are you sure you want to clear this groove?')) {
            this.currentGroove = {
                title: '',
                author: '',
                comment: '',
                timeSignature: '4/4',
                division: 16,
                measures: 1,
                tempo: 80,
                swing: 0,
                measureText: [''],
                crash: '',
                hihat: '',
                hitom: '',
                midtom: '',
                snare: '',
                lowtom: '',
                kick: ''
            };
            this.ensureGroovePatterns();
            this.updateUI();
            this.render();
            this.updateURL();
        }
    },

    // Update UI with current groove data
    updateUI: function() {
        const titleInput = document.getElementById('titleInput');
        const authorInput = document.getElementById('authorInput');
        const commentInput = document.getElementById('commentInput');
        const bpmInput = document.getElementById('bpmInput');
        const bpmSlider = document.getElementById('bpmSlider');
        const swingSlider = document.getElementById('swingSlider');
        const swingDisplay = document.getElementById('swingDisplay');
        const timeSignatureSelect = document.getElementById('timeSignature');
        const divisionSelect = document.getElementById('division');
        const measuresInput = document.getElementById('measuresInput');

        if (titleInput) titleInput.value = this.currentGroove.title;
        if (authorInput) authorInput.value = this.currentGroove.author;
        if (commentInput) commentInput.value = this.currentGroove.comment;
        if (bpmInput) bpmInput.value = this.currentGroove.tempo;
        if (bpmSlider) bpmSlider.value = this.currentGroove.tempo;
        if (swingSlider) swingSlider.value = this.currentGroove.swing;
        if (swingDisplay) swingDisplay.textContent = this.currentGroove.swing + '%';
        if (timeSignatureSelect) timeSignatureSelect.value = this.currentGroove.timeSignature;
        if (divisionSelect) divisionSelect.value = String(this.currentGroove.division);
        if (measuresInput) measuresInput.value = this.currentGroove.measures;
    },

    // Render the groove (update sheet music display)
    render: function() {
        // Use the interactive pattern editor for rendering
        if (GroovePatternEditor) {
            GroovePatternEditor.render();
        }

        if (typeof DrumNotationRenderer !== 'undefined') {
            DrumNotationRenderer.render(this.currentGroove);
        }
    },

    // Update URL with current groove
    updateURL: function() {
        window.history.replaceState({}, document.title, window.location.pathname);
    },

    // Download groove as MIDI
    download: function() {
        const hasAnyNotes = DrumUtils.drumLaneKeys.some((drumKey) => {
            return DrumUtils.grooveToArray(this.currentGroove[drumKey]).some((hit) => hit && hit !== '-');
        });

        if (!hasAnyNotes) {
            alert('Please create a groove before downloading');
            return;
        }

        // TODO: Implement MIDI export using jsmidgen
        alert('Download feature coming soon!');
    },

    // Print groove
    print: function() {
        const hasAnyNotes = DrumUtils.drumLaneKeys.some((drumKey) => {
            return DrumUtils.grooveToArray(this.currentGroove[drumKey]).some((hit) => hit && hit !== '-');
        });

        if (!hasAnyNotes) {
            alert('Please create a groove before printing');
            return;
        }

        if (typeof DrumNotationRenderer === 'undefined') {
            alert('Staff notation renderer is unavailable.');
            return;
        }

        const abcSource = DrumNotationRenderer.buildABC(this.currentGroove);
        const printWindow = window.open('', '_blank', 'width=1100,height=850');
        if (!printWindow) {
            alert('Unable to open the print preview window. Please allow pop-ups for this site.');
            return;
        }

        printWindow.document.open();
        printWindow.document.write(this.buildPrintDocument(abcSource));
        printWindow.document.close();
        printWindow.focus();
    },

    // Create a print-friendly document that renders the ABC staff notation in the print window
    buildPrintDocument: function(abcSource) {
        const groove = this.currentGroove;
        const title = groove.title || 'Untitled Groove';
        const author = groove.author ? `<div class="print-meta-line">By ${this.escapeHTML(groove.author)}</div>` : '';
        const comment = groove.comment ? `<div class="print-comment">${this.escapeHTML(groove.comment)}</div>` : '';
        const settings = [
            `${groove.timeSignature}`,
            `1/${groove.division} notes`,
            `${groove.tempo} BPM`,
            `${groove.measures} measure${groove.measures === 1 ? '' : 's'}`
        ].join(' • ');
        const abc2svgScriptUrl = new URL('lib/abc2svg/abc2svg-1.js', window.location.href).href;
        const percScriptUrl = new URL('lib/abc2svg/perc-1.js', window.location.href).href;
        const escapedAbcSource = JSON.stringify(abcSource);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHTML(title)} - Print</title>
    <style>
        @page {
            size: auto;
            margin: 0.5in;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            font-family: Georgia, "Times New Roman", serif;
            color: #111827;
            background: #ffffff;
        }

        .print-sheet {
            max-width: 10.5in;
            margin: 0 auto;
            padding: 0.2in 0;
        }

        .print-header {
            margin-bottom: 0.3in;
            border-bottom: 1px solid #d1d5db;
            padding-bottom: 0.18in;
        }

        .print-title {
            font-size: 22pt;
            font-weight: 700;
            margin-bottom: 0.08in;
        }

        .print-meta-line {
            font-size: 11pt;
            margin-bottom: 0.04in;
        }

        .print-settings {
            font-size: 10pt;
            color: #4b5563;
        }

        .print-comment {
            margin-top: 0.12in;
            font-size: 10.5pt;
            color: #1f2937;
        }

        .notation-wrapper {
            width: 100%;
            overflow: visible;
            min-height: 3in;
        }

        .notation-wrapper svg {
            display: block;
            width: 100%;
            height: auto;
        }

        .notation-wrapper pre,
        .print-error {
            white-space: pre-wrap;
            font-family: "Courier New", monospace;
            font-size: 10pt;
            color: #b91c1c;
        }

        @media print {
            .print-sheet {
                max-width: none;
                margin: 0;
                padding: 0;
            }
        }
    </style>
    <script src="${this.escapeHTML(abc2svgScriptUrl)}"></script>
    <script src="${this.escapeHTML(percScriptUrl)}"></script>
</head>
<body>
    <main class="print-sheet">
        <header class="print-header">
            <div class="print-title">${this.escapeHTML(title)}</div>
            ${author}
            <div class="print-settings">${this.escapeHTML(settings)}</div>
            ${comment}
        </header>
        <section id="printNotation" class="notation-wrapper"></section>
    </main>
    <script>
        (function () {
            var abcSource = ${escapedAbcSource};
            var container = document.getElementById('printNotation');
            var output = '';
            var errorText = '';

            function renderNotation() {
                if (typeof abc2svg === 'undefined' || !abc2svg.Abc) {
                    container.innerHTML = '<pre class="print-error">Unable to load abc2svg for printing.</pre>';
                    return;
                }

                try {
                    var abc = new abc2svg.Abc({
                        errmsg: function (msg) {
                            errorText += msg + '\\n';
                        },
                        img_out: function (str) {
                            output += str;
                        }
                    });

                    abc.tosvg('print-notation', abcSource);

                    if (typeof abc2svg.abc_end === 'function') {
                        abc2svg.abc_end();
                    }

                    container.innerHTML = errorText
                        ? '<pre class="print-error">' + errorText.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>' + output
                        : output;

                    window.setTimeout(function () {
                        window.print();
                    }, 150);
                } catch (error) {
                    container.innerHTML = '<pre class="print-error">' + String(error.message || error).replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';
                }
            }

            window.addEventListener('load', renderNotation);
            window.addEventListener('afterprint', function () {
                window.close();
            });
        })();
    </script>
</body>
</html>`;
    },

    // Escape user-provided text before embedding in the print document
    escapeHTML: function(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    // Save groove to a .drumgroove file
    saveToFile: function() {
        const data = Object.assign({ version: 1 }, this.currentGroove);
        const json = JSON.stringify(data, null, 2);
        const safeName = (this.currentGroove.title || 'untitled-groove')
            .replace(/[^a-z0-9\-_ ]/gi, '')
            .trim()
            .replace(/\s+/g, '-') || 'untitled-groove';
        DrumUtils.downloadFile(safeName + '.drumgroove', json, 'application/json');
    },

    // Open a .drumgroove file and load it into the editor
    openFromFile: function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.drumgroove,application/json';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = JSON.parse(evt.target.result);
                    this.loadFromData(data);
                } catch (err) {
                    alert('Could not open file: invalid or corrupted .drumgroove file.');
                }
            };
            reader.readAsText(file);
        });
        input.click();
    },

    // Load groove state from a plain data object (used by openFromFile)
    loadFromData: function(data) {
        const groove = {
            title: data.title || '',
            author: data.author || '',
            comment: data.comment || '',
            timeSignature: data.timeSignature || '4/4',
            division: Number(data.division) || 16,
            measures: Number(data.measures) || 1,
            tempo: Number(data.tempo) || 80,
            swing: Number(data.swing) || 0,
            measureText: Array.isArray(data.measureText) ? data.measureText : [''],
            crash: data.crash || '',
            hihat: data.hihat || '',
            hitom: data.hitom || '',
            midtom: data.midtom || '',
            snare: data.snare || '',
            lowtom: data.lowtom || '',
            kick: data.kick || ''
        };
        Object.assign(this.currentGroove, groove);
        this.ensureGroovePatterns();
        this.updateUI();
        this.render();
        this.updateURL();
    },

    // Share groove via URL
    share: function() {
        const shareURL = DrumUtils.generateShareURL(this.currentGroove);
        
        // Try to use native share API if available
        if (navigator.share) {
            navigator.share({
                title: this.currentGroove.title || 'My Groove',
                text: `Check out my drum groove: ${this.currentGroove.title}`,
                url: shareURL
            }).catch(err => console.log('Share error:', err));
        } else {
            // Fallback: copy to clipboard and show alert
            navigator.clipboard.writeText(shareURL).then(() => {
                alert('Share URL copied to clipboard!');
            }).catch(err => {
                alert('Share URL: ' + shareURL);
            });
        }
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        GrooveEditor.init();
    });
} else {
    GrooveEditor.init();
}
