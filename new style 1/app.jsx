/* Drum Editor — modern layout */
const { useState, useEffect, useRef, useMemo } = React;

const DRUMS = [
  { id: 'crash',   label: 'Crash',       color: 'oklch(0.78 0.14 80)',  staff: 'above' },
  { id: 'hihat',   label: 'Hi-Hat',      color: 'oklch(0.74 0.13 200)', staff: 'top'   },
  { id: 'ohh',     label: 'Open Hi-Hat', color: 'oklch(0.74 0.13 200)', staff: 'top'   },
  { id: 'ride',    label: 'Ride',        color: 'oklch(0.78 0.14 80)',  staff: 'top'   },
  { id: 'htom',    label: 'Hi-Tom',      color: 'oklch(0.72 0.14 30)',  staff: 'mid'   },
  { id: 'mtom',    label: 'Mid-Tom',     color: 'oklch(0.72 0.14 30)',  staff: 'mid'   },
  { id: 'ltom',    label: 'Low-Tom',     color: 'oklch(0.72 0.14 30)',  staff: 'mid'   },
  { id: 'snare',   label: 'Snare',       color: 'oklch(0.78 0.13 0)',   staff: 'mid'   },
  { id: 'kick',    label: 'Kick',        color: 'oklch(0.74 0.17 50)',  staff: 'low'   },
  { id: 'hhpedal', label: 'HH Pedal',    color: 'oklch(0.74 0.13 200)', staff: 'below' },
];

const ARTICULATIONS = [
  { id: 'normal', label: 'Normal', glyph: '●', hint: 'N' },
  { id: 'accent', label: 'Accent', glyph: '▲', hint: 'A' },
  { id: 'ghost',  label: 'Ghost',  glyph: '◯', hint: 'G' },
  { id: 'rim',    label: 'Rim',    glyph: '✕', hint: 'R' },
  { id: 'flam',   label: 'Flam',   glyph: 'flam', hint: 'F' },
];

/* Flam = small grace note slurred into a big main note */
function FlamGlyph({ size = 16 }) {
  return (
    <svg className="flam-svg" viewBox="0 0 26 18" width={size * 1.6} height={size} fill="none" aria-hidden="true">
      {/* slur from grace note to main note */}
      <path d="M6 4 Q12 1 17 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      {/* grace (small) note */}
      <line x1="7.4" y1="6" x2="7.4" y2="14" stroke="currentColor" strokeWidth="1" />
      <line x1="4.2" y1="12.4" x2="8.4" y2="9" stroke="currentColor" strokeWidth="1" />
      <ellipse cx="5.4" cy="14" rx="2.2" ry="1.6" transform="rotate(-20 5.4 14)" fill="currentColor" />
      {/* main (big) note */}
      <line x1="19.6" y1="4" x2="19.6" y2="14" stroke="currentColor" strokeWidth="1.3" />
      <ellipse cx="16.6" cy="14" rx="3.1" ry="2.3" transform="rotate(-20 16.6 14)" fill="currentColor" />
    </svg>
  );
}

const ARTIC_COLOR = {
  normal: 'oklch(0.74 0.17 50)',
  accent: 'oklch(0.82 0.18 90)',
  ghost:  'oklch(0.62 0.06 240)',
  rim:    'oklch(0.74 0.13 320)',
  flam:   'oklch(0.74 0.13 200)',
};

// Seed a tasty default groove so the empty state isn't depressing
function seedGroove(steps) {
  const g = {};
  DRUMS.forEach(d => g[d.id] = new Array(steps).fill(null));
  for (let i = 0; i < steps; i += 2) g.hihat[i] = 'normal';
  [0, 4, 8, 12].forEach(i => g.hihat[i] = 'accent');
  [4, 12].forEach(i => g.snare[i] = 'normal');
  g.snare[10] = 'ghost';
  g.snare[11] = 'ghost';
  [0, 6, 8, 14].forEach(i => g.kick[i] = 'normal');
  return g;
}

function clsx(...xs) { return xs.filter(Boolean).join(' '); }

/* ───────── Pattern (M1..) tabs ───────── */
function PatternTabs({ patterns, active, onSwitch, onAdd, onRename }) {
  const [editing, setEditing] = useState(null);
  return (
    <div className="pattern-tabs">
      {patterns.map((p, i) => (
        <div
          key={p.id}
          className={clsx('pattern-tab', active === i && 'active')}
          onClick={() => onSwitch(i)}
          onDoubleClick={() => setEditing(i)}
        >
          {editing === i ? (
            <input
              autoFocus
              defaultValue={p.name}
              onBlur={(e) => { onRename(i, e.target.value || p.name); setEditing(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
            />
          ) : (
            <>
              <span className="pt-name">{p.name}</span>
              <span className="pt-bars">{p.bars} bar{p.bars > 1 ? 's' : ''}</span>
            </>
          )}
        </div>
      ))}
      <button className="pattern-add" onClick={onAdd} title="Add pattern">＋</button>
    </div>
  );
}

/* ───────── Transport ───────── */
function Transport({ playing, onPlay, onStop, bpm, setBpm, timeSig, setTimeSig, division, setDivision, swing, setSwing }) {
  return (
    <div className="transport">
      <div className="transport-controls">
        <button className={clsx('btn-icon', 'btn-stop')} onClick={onStop} title="Stop">
          <svg viewBox="0 0 16 16" width="14" height="14"><rect x="3" y="3" width="10" height="10" rx="1" fill="currentColor"/></svg>
        </button>
        <button className={clsx('btn-play', playing && 'is-playing')} onClick={onPlay} title="Play / Pause">
          {playing ? (
            <svg viewBox="0 0 16 16" width="16" height="16"><rect x="4" y="3" width="3" height="10" fill="currentColor"/><rect x="9" y="3" width="3" height="10" fill="currentColor"/></svg>
          ) : (
            <svg viewBox="0 0 16 16" width="16" height="16"><path d="M4 3 L13 8 L4 13 Z" fill="currentColor"/></svg>
          )}
        </button>
        <button className="btn-icon" title="Record">
          <svg viewBox="0 0 16 16" width="12" height="12"><circle cx="8" cy="8" r="5" fill="oklch(0.7 0.18 25)"/></svg>
        </button>
        <button className="btn-icon" title="Metronome">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M5 13 L7 3 L9 3 L11 13 Z"/><line x1="4" y1="13" x2="12" y2="13"/><line x1="8" y1="8" x2="11" y2="5"/>
          </svg>
        </button>
      </div>

      <div className="transport-readout">
        <div className="readout-time"><span className="mono">00:00</span><span className="readout-label">elapsed</span></div>
        <div className="readout-bar"><span className="mono">1.1.1</span><span className="readout-label">bar.beat.tick</span></div>
      </div>

      <div className="transport-fields">
        <Field label="BPM">
          <div className="bpm-stepper">
            <button onClick={() => setBpm(Math.max(20, bpm - 1))}>−</button>
            <input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(Math.max(20, Math.min(300, +e.target.value || 0)))}
            />
            <button onClick={() => setBpm(Math.min(300, bpm + 1))}>+</button>
          </div>
        </Field>
        <Field label="Time">
          <select value={timeSig} onChange={(e) => setTimeSig(e.target.value)}>
            {['2/4', '3/4', '4/4', '5/4', '6/8', '7/8', '12/8'].map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Division">
          <select value={division} onChange={(e) => setDivision(+e.target.value)}>
            <option value={8}>1/8 Notes</option>
            <option value={16}>1/16 Notes</option>
            <option value={32}>1/32 Notes</option>
            <option value={12}>1/8 Triplets</option>
          </select>
        </Field>
        <Field label="Swing">
          <div className="swing-row">
            <input type="range" min="0" max="60" value={swing} onChange={(e) => setSwing(+e.target.value)} />
            <span className="mono swing-val">{swing}%</span>
          </div>
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="field-control">{children}</div>
    </label>
  );
}

/* ───────── Articulation picker ───────── */
function ArticulationPicker({ value, onChange, touch }) {
  return (
    <div className="artic-picker">
      <span className="artic-label">Brush</span>
      <div className="artic-row">
        {ARTICULATIONS.map(a => (
          <button
            key={a.id}
            className={clsx('artic-btn', value === a.id && 'active')}
            onClick={() => onChange(a.id)}
            style={{ '--ac': ARTIC_COLOR[a.id] }}
          >
            <span className="artic-glyph">{a.id === 'flam' ? <FlamGlyph size={13} /> : a.glyph}</span>
            <span className="artic-name">{a.label}</span>
            {!touch && <kbd>{a.hint}</kbd>}
          </button>
        ))}
        <button
          className={clsx('artic-btn', 'artic-erase', value === 'erase' && 'active')}
          onClick={() => onChange('erase')}
          style={{ '--ac': 'oklch(0.66 0.18 25)' }}
        >
          <span className="artic-glyph">⌫</span>
          <span className="artic-name">Erase</span>
          {!touch && <kbd>E</kbd>}
        </button>
      </div>
    </div>
  );
}

/* ───────── Notation preview (collapsible) ───────── */
function NotationPreview({ open, onToggle, bpm, timeSig }) {
  return (
    <div className={clsx('notation', open && 'open')}>
      <button className="notation-toggle" onClick={onToggle}>
        <span>{open ? '▾' : '▸'}</span>
        <span>Notation preview</span>
        <span className="notation-meta mono">{bpm} bpm · {timeSig}</span>
      </button>
      {open && (
        <div className="notation-body">
          <svg viewBox="0 0 1000 90" preserveAspectRatio="none" width="100%" height="90">
            {[0,1,2,3,4].map(i => <line key={i} x1="10" x2="990" y1={20 + i*12} y2={20 + i*12} stroke="oklch(0.4 0.005 60)" strokeWidth="0.8"/>)}
            <line x1="10" y1="20" x2="10" y2="68" stroke="oklch(0.85 0.005 60)" strokeWidth="2"/>
            <line x1="990" y1="20" x2="990" y2="68" stroke="oklch(0.85 0.005 60)" strokeWidth="2"/>
            <text x="22" y="42" fontFamily="serif" fontSize="22" fill="oklch(0.85 0.005 60)" fontWeight="700">𝄞</text>
            <text x="44" y="38" fontFamily="serif" fontSize="16" fill="oklch(0.85 0.005 60)" fontWeight="700">{timeSig.split('/')[0]}</text>
            <text x="44" y="56" fontFamily="serif" fontSize="16" fill="oklch(0.85 0.005 60)" fontWeight="700">{timeSig.split('/')[1]}</text>
            {[0,1,2,3].map(b => (
              <g key={b} transform={`translate(${80 + b*225}, 0)`}>
                <circle cx="20" cy="62" r="4" fill="oklch(0.85 0.005 60)" />
                <line x1="24" y1="62" x2="24" y2="32" stroke="oklch(0.85 0.005 60)" strokeWidth="1.5"/>
                <circle cx="60" cy="38" r="3.5" fill="none" stroke="oklch(0.85 0.005 60)" strokeWidth="1.2"/>
                <line x1="63" y1="38" x2="63" y2="62" stroke="oklch(0.85 0.005 60)" strokeWidth="1.2"/>
                <circle cx="100" cy="46" r="4" fill="oklch(0.85 0.005 60)" />
                <line x1="104" y1="46" x2="104" y2="20" stroke="oklch(0.85 0.005 60)" strokeWidth="1.5"/>
                <circle cx="140" cy="38" r="3.5" fill="none" stroke="oklch(0.85 0.005 60)" strokeWidth="1.2"/>
                <line x1="143" y1="38" x2="143" y2="62" stroke="oklch(0.85 0.005 60)" strokeWidth="1.2"/>
                <line x1="200" y1="20" x2="200" y2="68" stroke="oklch(0.4 0.005 60)" strokeWidth="1"/>
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}

/* ───────── Step grid ───────── */
function StepGrid({ grid, setGrid, steps, division, brush, playhead, rowMeta, setRowMeta, accent }) {
  const stepsPerBeat = division / 4;
  const beats = steps / stepsPerBeat;

  const onCell = (drum, i, e) => {
    setGrid(prev => {
      const next = { ...prev, [drum]: [...prev[drum]] };
      if (brush === 'erase' || e.shiftKey || e.button === 2) {
        next[drum][i] = null;
      } else {
        next[drum][i] = next[drum][i] === brush ? null : brush;
      }
      return next;
    });
  };

  return (
    <div className="grid-wrap">
      <div className="grid-header">
        <div className="grid-row-label-spacer" />
        <div className="grid-cells header" style={{ gridTemplateColumns: `repeat(${steps}, 1fr)` }}>
          {Array.from({ length: steps }).map((_, i) => {
            const beat = Math.floor(i / stepsPerBeat) + 1;
            const sub = (i % stepsPerBeat);
            const isBeat = sub === 0;
            return (
              <div key={i} className={clsx('grid-head-cell', isBeat && 'is-beat', i === playhead && 'is-play')}>
                {isBeat && <span className="mono beat-num">{beat}</span>}
                {!isBeat && <span className="mono sub-num">{['e','&','a'][sub-1] || ''}</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid-body">
        {DRUMS.map(d => {
          const meta = rowMeta[d.id] || { mute: false, solo: false, vel: 100 };
          return (
            <div key={d.id} className={clsx('grid-row', meta.mute && 'is-muted')}>
              <div className="grid-row-label">
                <span className="row-swatch" style={{ background: d.color }} />
                <span className="row-name">{d.label}</span>
                <div className="row-controls">
                  <button
                    className={clsx('row-btn', meta.solo && 'is-on')}
                    onClick={() => setRowMeta(d.id, { solo: !meta.solo })}
                    title="Solo"
                  >S</button>
                  <button
                    className={clsx('row-btn', meta.mute && 'is-on')}
                    onClick={() => setRowMeta(d.id, { mute: !meta.mute })}
                    title="Mute"
                  >M</button>
                </div>
              </div>
              <div className="grid-cells" style={{ gridTemplateColumns: `repeat(${steps}, 1fr)` }}>
                {grid[d.id].map((v, i) => {
                  const isBeat = i % stepsPerBeat === 0;
                  const isBar = i % (stepsPerBeat * 4) === 0;
                  return (
                    <button
                      key={i}
                      className={clsx(
                        'cell',
                        isBeat && 'is-beat',
                        isBar && 'is-bar',
                        i === playhead && 'is-play',
                        v && 'is-on',
                        v && `is-${v}`
                      )}
                      onContextMenu={(e) => { e.preventDefault(); onCell(d.id, i, { ...e, button: 2 }); }}
                      onClick={(e) => onCell(d.id, i, e)}
                      style={v ? { '--c': ARTIC_COLOR[v] } : undefined}
                    >
                      {v === 'accent' && <span className="cell-glyph">▲</span>}
                      {v === 'ghost'  && <span className="cell-glyph">◯</span>}
                      {v === 'rim'    && <span className="cell-glyph">✕</span>}
                      {v === 'flam'   && <span className="cell-glyph cell-flam"><FlamGlyph size={13} /></span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────── Inspector / right panel ───────── */
function Inspector({ meta, setMeta, onClear, onSave, onPrint, onOpen }) {
  return (
    <aside className="inspector">
      <div className="insp-section">
        <h3>Groove</h3>
        <Field label="Title">
          <input
            type="text"
            placeholder="Untitled groove"
            value={meta.title}
            onChange={(e) => setMeta({ ...meta, title: e.target.value })}
          />
        </Field>
        <Field label="Author">
          <input
            type="text"
            placeholder="Your name"
            value={meta.author}
            onChange={(e) => setMeta({ ...meta, author: e.target.value })}
          />
        </Field>
      </div>

      <div className="insp-actions">
        <button className="btn-primary" onClick={onSave}>
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3h7l3 3v7H3z"/><path d="M5 3v4h6V3"/><rect x="5" y="9" width="6" height="4"/></svg>
          Save
        </button>
        <button className="btn-ghost" onClick={onOpen}>Open</button>
        <button className="btn-ghost" onClick={onPrint}>Print</button>
        <button className="btn-danger" onClick={onClear}>Clear</button>
      </div>
    </aside>
  );
}

/* ───────── Top header ───────── */
function TopBar({ title, setTitle }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <ellipse cx="12" cy="6.5" rx="8" ry="3"/>
            <path d="M4 6.5v11c0 1.7 3.6 3 8 3s8-1.3 8-3v-11"/>
            <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>
          </svg>
        </div>
        <input
          className="brand-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          spellCheck={false}
        />
      </div>
      <nav className="topnav">
        <button className="nav-btn">File</button>
        <button className="nav-btn">Edit</button>
        <button className="nav-btn">View</button>
        <button className="nav-btn">Kit</button>
        <button className="nav-btn">Help</button>
      </nav>
      <div className="topright">
        <span className="status-dot" />
        <span className="status-text mono">autosaved · 12s ago</span>
        <button className="btn-share">Share</button>
      </div>
    </header>
  );
}

/* ───────── App root ───────── */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "layout": "studio",
  "accent": "amber",
  "notationOpen": true,
  "showSubdivisions": true,
  "touchMode": false
}/*EDITMODE-END*/;

const ACCENTS = {
  amber:   'oklch(0.74 0.17 50)',
  teal:    'oklch(0.72 0.14 200)',
  magenta: 'oklch(0.72 0.18 340)',
  lime:    'oklch(0.80 0.18 130)',
};

function App() {
  const [tweaks, setTweaksState] = useState(TWEAK_DEFAULTS);
  const setTweak = (k, v) => {
    const obj = typeof k === 'object' ? k : { [k]: v };
    setTweaksState(prev => {
      const next = { ...prev, ...obj };
      try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: obj }, '*'); } catch (e) {}
      return next;
    });
  };

  const [bpm, setBpm] = useState(96);
  const [timeSig, setTimeSig] = useState('4/4');
  const [division, setDivision] = useState(16);
  const [swing, setSwing] = useState(12);
  const [brush, setBrush] = useState('normal');
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(-1);

  const [patterns, setPatterns] = useState([
    { id: 'm1', name: 'M1', bars: 1 },
    { id: 'm2', name: 'Fill', bars: 1 },
  ]);
  const [activeP, setActiveP] = useState(0);

  const steps = useMemo(() => {
    const [num, den] = timeSig.split('/').map(Number);
    return Math.round(num * (division / den));
  }, [timeSig, division]);

  const [grids, setGrids] = useState(() => ({ m1: seedGroove(16), m2: seedGroove(16) }));
  const grid = grids[patterns[activeP].id] || seedGroove(steps);

  // re-seed grid length if division/timesig change
  useEffect(() => {
    setGrids(prev => {
      const next = { ...prev };
      patterns.forEach(p => {
        const cur = next[p.id];
        if (!cur || cur.kick.length !== steps) next[p.id] = seedGroove(steps);
      });
      return next;
    });
  }, [steps]);

  const setGrid = (updater) => {
    setGrids(prev => ({ ...prev, [patterns[activeP].id]: typeof updater === 'function' ? updater(prev[patterns[activeP].id]) : updater }));
  };

  const [rowMeta, setRowMetaState] = useState(() => {
    const m = {}; DRUMS.forEach(d => m[d.id] = { mute: false, solo: false, vel: 100 }); return m;
  });
  const setRowMeta = (id, patch) => setRowMetaState(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const [meta, setMeta] = useState({ title: '', author: '', tags: '', notes: '' });

  // Playhead tick
  useEffect(() => {
    if (!playing) { setPlayhead(-1); return; }
    const stepDur = (60 / bpm) * (4 / division) * 1000;
    const id = setInterval(() => setPlayhead(p => (p + 1) % steps), stepDur);
    return () => clearInterval(id);
  }, [playing, bpm, division, steps]);

  // Keyboard shortcuts for brush
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches('input, textarea, select')) return;
      const map = { n: 'normal', a: 'accent', g: 'ghost', r: 'rim', f: 'flam', e: 'erase' };
      if (map[e.key.toLowerCase()]) setBrush(map[e.key.toLowerCase()]);
      if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Tweaks mode protocol
  const [editMode, setEditMode] = useState(false);
  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === '__activate_edit_mode') setEditMode(true);
      if (e.data?.type === '__deactivate_edit_mode') setEditMode(false);
    };
    window.addEventListener('message', onMsg);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch {}
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const accentColor = ACCENTS[tweaks.accent] || ACCENTS.amber;

  const clearGrid = () => setGrid(_ => {
    const g = {}; DRUMS.forEach(d => g[d.id] = new Array(steps).fill(null)); return g;
  });

  return (
    <div className={clsx('app', `layout-${tweaks.layout}`, tweaks.touchMode && 'is-touch')} style={{ '--accent': accentColor }}>
      <TopBar title={meta.title || 'Untitled groove'} setTitle={(t) => setMeta({ ...meta, title: t })} />

      <Transport
        playing={playing}
        onPlay={() => setPlaying(p => !p)}
        onStop={() => { setPlaying(false); setPlayhead(-1); }}
        bpm={bpm} setBpm={setBpm}
        timeSig={timeSig} setTimeSig={setTimeSig}
        division={division} setDivision={setDivision}
        swing={swing} setSwing={setSwing}
      />

      <NotationPreview open={tweaks.notationOpen} onToggle={() => setTweak('notationOpen', !tweaks.notationOpen)} bpm={bpm} timeSig={timeSig} />

      <div className="workspace">
        <main className="main">
          <div className="main-head">
            <PatternTabs
              patterns={patterns}
              active={activeP}
              onSwitch={setActiveP}
              onAdd={() => {
                const n = patterns.length + 1;
                const id = `m${n}`;
                setPatterns([...patterns, { id, name: `M${n}`, bars: 1 }]);
                setGrids(prev => ({ ...prev, [id]: seedGroove(steps) }));
                setActiveP(patterns.length);
              }}
              onRename={(i, name) => setPatterns(p => p.map((x, j) => j === i ? { ...x, name } : x))}
            />
            <ArticulationPicker value={brush} onChange={setBrush} touch={tweaks.touchMode} />
          </div>

          <StepGrid
            grid={grid}
            setGrid={setGrid}
            steps={steps}
            division={division}
            brush={brush}
            playhead={playhead}
            rowMeta={rowMeta}
            setRowMeta={setRowMeta}
            accent={accentColor}
          />

          <div className="main-foot">
            <div className="hint">
              {tweaks.touchMode ? (
                <span>Tap to place · tap again to remove · use the <strong>Erase</strong> brush to clear any cell</span>
              ) : (
                <><kbd>Space</kbd> play · <kbd>N</kbd>/<kbd>A</kbd>/<kbd>G</kbd>/<kbd>R</kbd>/<kbd>F</kbd> brush · <kbd>Shift</kbd>+click clears a cell</>
              )}
            </div>
            <div className="zoom">
              <button>−</button><span className="mono">100%</span><button>+</button>
            </div>
          </div>
        </main>

        <Inspector
          meta={meta}
          setMeta={setMeta}
          onClear={clearGrid}
          onSave={() => {}}
          onPrint={() => window.print()}
          onOpen={() => {}}
        />
      </div>

      {editMode && (
        <TweaksPanel tweaks={tweaks} setTweak={setTweak} onClose={() => {
          setEditMode(false);
          try { window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*'); } catch {}
        }} />
      )}
    </div>
  );
}

/* ───────── Tweaks panel ───────── */
function TweaksPanel({ tweaks, setTweak, onClose }) {
  return (
    <div className="tweaks-panel">
      <div className="tweaks-head">
        <span>Tweaks</span>
        <button onClick={onClose}>✕</button>
      </div>
      <div className="tweaks-body">
        <div className="tw-section">
          <div className="tw-label">Layout</div>
          <div className="tw-segments">
            {['studio', 'stage', 'compact'].map(o => (
              <button key={o} className={clsx(tweaks.layout === o && 'active')} onClick={() => setTweak('layout', o)}>{o}</button>
            ))}
          </div>
        </div>
        <div className="tw-section">
          <div className="tw-label">Accent</div>
          <div className="tw-swatches">
            {Object.entries(ACCENTS).map(([k, v]) => (
              <button
                key={k}
                className={clsx('tw-swatch', tweaks.accent === k && 'active')}
                style={{ background: v }}
                onClick={() => setTweak('accent', k)}
                title={k}
              />
            ))}
          </div>
        </div>
        <div className="tw-section">
          <label className="tw-toggle">
            <input type="checkbox" checked={tweaks.notationOpen} onChange={(e) => setTweak('notationOpen', e.target.checked)} />
            <span>Notation preview</span>
          </label>
        </div>
        <div className="tw-section">
          <label className="tw-toggle">
            <input type="checkbox" checked={tweaks.showSubdivisions} onChange={(e) => setTweak('showSubdivisions', e.target.checked)} />
            <span>Show subdivisions (e &amp; a)</span>
          </label>
        </div>
        <div className="tw-section">
          <label className="tw-toggle">
            <input type="checkbox" checked={tweaks.touchMode} onChange={(e) => setTweak('touchMode', e.target.checked)} />
            <span>Touch mode (iPad / tablet)</span>
          </label>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
