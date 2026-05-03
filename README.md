# Drum Editor App

A web-based drum groove editor inspired by Groove Scribe. Create, edit, share, and export drum patterns with an intuitive interface.

## Features

- **Groove Editing**: Create drum patterns for hi-hat, snare, and kick
- **Playback**: Play grooves back at adjustable tempos with metronome
- **Sheet Music**: Visual representation of drum patterns
- **Export**: Download grooves as MIDI files or PDF sheet music
- **Share**: Share grooves via URL or generate shareable links
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Offline Support**: Auto-save to browser storage

## Project Structure

```
drum-editor-app/
├── index.html           # Main HTML file
├── css/
│   └── styles.css       # Styling
├── js/
│   ├── app.js           # Main app logic and event handlers
│   ├── grooveEditor.js  # Groove editing logic
│   ├── utils.js         # Utility functions
│   └── midi.js          # (To be added) MIDI playback
└── lib/
    ├── midi.js          # MIDI.js library
    ├── abc2svg.js       # ABC notation to SVG converter
    └── jsmidgen.js      # MIDI file generation
```

## Getting Started

### 1. Local Development

Use Live Server extension in VS Code:
- Install "Live Server" extension from VS Code marketplace
- Right-click on `index.html` and select "Open with Live Server"
- App will open at `http://localhost:5500`

### 2. Download Libraries

The app requires external libraries for MIDI playback and sheet music rendering:

**MIDI.js** (for audio playback)
```bash
# Download from: https://github.com/chrisgfortes/MIDI.js
# Place in lib/ folder
```

**abc2svg** (for sheet music rendering)
```bash
# Download from: https://github.com/jvf/abc2svg
# Place in lib/ folder
```

**jsmidgen** (for MIDI export)
```bash
# Download from: https://github.com/dingram/jsmidgen
# Place in lib/ folder
```

## Usage

### Basic Workflow

1. **Create Groove**: Set time signature, division, and number of measures
2. **Edit Pattern**: Click on the beat grid to add/remove drum hits (in edit mode)
3. **Adjust Settings**: Set tempo (BPM) and swing
4. **Preview**: Use the play button to hear your groove
5. **Export**: Download as MIDI or print sheet music
6. **Share**: Share the URL to let others play your groove

### Groove Notation

- `x` - Hi-hat hit
- `o` - Kick drum hit
- `O` - Snare hit (accent)
- `|` - Measure separator
- `-` - Rest/no hit

### Keyboard Shortcuts

- **Space**: Play/Pause
- **Ctrl+S / Cmd+S**: Save groove
- **Ctrl+Z / Cmd+Z**: Undo (coming soon)
- **Ctrl+Y / Cmd+Y**: Redo (coming soon)

## API Reference

### DrumUtils

Utility functions for groove manipulation:

- `formatTime(seconds)` - Convert seconds to MM:SS format
- `parseTimeSignature(timeSig)` - Parse time signature string
- `isTouchDevice()` - Check if device supports touch
- `generateShareURL(grooveData)` - Create shareable URL
- `storage.save(key, data)` - Save to localStorage
- `storage.load(key)` - Load from localStorage

### GrooveEditor

Main editor object:

- `currentGroove` - Current groove data
- `init()` - Initialize editor
- `render()` - Render groove visually
- `clearGroove()` - Clear current groove
- `download()` - Export as MIDI
- `print()` - Print sheet music
- `share()` - Share groove

### DrumApp

Main app controller:

- `init()` - Initialize application
- `togglePlayback()` - Start/stop playback
- `saveGroove()` - Save current groove
- `openModal(id)` - Open modal dialog

## Data Format

Grooves are stored as URL parameters:

```
?TimeSig=4/4&Div=16&Tempo=80&Measures=1&H=|xxxxxxxxxxxxxxxx|&S=|----O-------O---|&K=|o-------o-------|
```

- `TimeSig` - Time signature (2/4, 3/4, 4/4, 5/4)
- `Div` - Note division (8, 16, 32 for eighth, sixteenth, thirty-second notes)
- `Tempo` - BPM (beats per minute)
- `Measures` - Number of measures
- `H` - Hi-hat pattern
- `S` - Snare pattern
- `K` - Kick pattern

## LocalStorage

Current groove is auto-saved to localStorage key: `currentGroove`

Access via: `DrumUtils.storage.load('currentGroove')`

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Next Steps / TODO

- [ ] Complete MIDI playback integration
- [ ] Implement audio synthesis for drum sounds
- [ ] Add metronome click generation
- [ ] Implement groove editing UI (click to toggle hits)
- [ ] Add sticking notation (R/L for hands)
- [ ] Implement permutation generation
- [ ] Add groove library/templates
- [ ] Implement undo/redo
- [ ] Add swing quantization
- [ ] Improve sheet music rendering
- [ ] Add preset drum kits
- [ ] Mobile touch interface optimization

## Technologies

- **HTML5** - Markup
- **CSS3** - Styling and layout
- **Vanilla JavaScript (ES5/ES6)** - Logic
- **Web Audio API** - Audio playback (to be implemented)
- **SVG** - Graphics
- **localStorage** - Client-side storage

## License

MIT License - Feel free to modify and use for your projects

## Credits

Inspired by [Groove Scribe](https://www.mikeslessons.com/groove/) from Mike's Music Lessons
