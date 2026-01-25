# Pilot's Desk

**Voice-responsive sales assistance platform for BPO agents**

Pilot's Desk provides real-time script guidance, live coaching, and compliance monitoring for sales agents. Features voice-triggered navigation, interactive widgets, and local transcription for privacy.

---

## Features

### Phase 1: Local Infrastructure ✅ (90% Complete - Ready for Windows Testing)
- **Audio Capture**: Microphone + system audio (WASAPI on Windows)
- **Speech-to-Text**: Whisper.cpp integration with mock mode fallback
- **Local Storage**: SQLite for call metadata and transcripts
- **Privacy-First**: 90-day retention, no cloud audio storage
- **South African Accent Support**: Optimized for SA agents → NZ customers

### Phase 2: Script Engine ✅ (100% Complete)
- **Voice-Responsive Navigation**: Automatic script progression based on keywords
- **Interactive Widgets**: Sky TV package calculator with voice triggers
- **Manual Override**: Click-to-jump and keyboard shortcuts (↑↓ arrows)
- **Hold/Pause Detection**: Pause transcription when customer on hold
- **Visual Script Flow**: Current node + dimmed next nodes preview

### Phase 3: Scoring & Coaching (Planned)
- Real-time adherence scoring via cloud LLM
- Compliance violation detection
- Inline nudges and coaching tips

### Phase 4: Governance & BI (Planned)
- Supervisor real-time dashboard
- Historical analytics and reporting
- Agent performance comparisons

---

## Quick Start

### Prerequisites

- **Windows 10/11** (primary target platform)
- **Node.js 18+** and npm
- **Rust** (stable channel)
- **Visual Studio C++ Build Tools** (Windows only)

### Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri:dev
```

### First Run

1. Application will open with "Not initialized" status
2. Click **Start Capture** to enable microphone
3. Click **Start Transcription** to begin voice recognition
4. Script will auto-load (Sky TV NZ pitch)
5. Speak into microphone to see transcripts and script navigation

---

## Building for Production

```bash
# Build Windows installer (.msi)
npm run tauri:build

# Output: src-tauri/target/release/bundle/msi/Pilot's Desk_0.1.0_x64_en-US.msi
```

See **[docs/WINDOWS_DEPLOYMENT.md](docs/WINDOWS_DEPLOYMENT.md)** for detailed build instructions.

---

## Development Mode

### Mock Transcription (Default)

The app includes mock transcription mode for development without Whisper.cpp:
- Detects audio via RMS calculation
- Generates placeholder transcripts: `"[MOCK] Audio detected"`
- Full UI and pipeline functional
- No Whisper binary required

### Real Whisper.cpp

For production:
1. Place `whisper.exe` in `src-tauri/sidecars/`
2. Place `ggml-small.bin` in `models/`
3. Restart app - automatically switches to real transcription

See **[docs/WHISPER_SETUP.md](docs/WHISPER_SETUP.md)** for setup.

---

## Project Structure

```
pilots-desk/
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── audio.rs        # Audio capture (cpal + WASAPI)
│   │   ├── whisper.rs      # Whisper.cpp integration
│   │   ├── script.rs       # Script engine
│   │   ├── storage.rs      # SQLite storage
│   │   └── lib.rs          # Tauri commands
│   └── sidecars/           # Place whisper.exe here
│
├── src/                    # React frontend
│   ├── components/
│   │   ├── ScriptViewer.tsx
│   │   └── PackageCalculator.tsx
│   └── App.tsx             # Main layout (70/30 split)
│
├── scripts/                # Script definitions
│   ├── schema.json
│   └── sky_tv_nz/
│       └── main_pitch.json
│
├── docs/                   # Documentation
│   ├── WINDOWS_DEPLOYMENT.md
│   ├── WINDOWS_TESTING.md
│   ├── WHISPER_SETUP.md
│   └── WASAPI_TODO.md
│
└── models/                 # Place ggml-small.bin here
```

---

## Usage

### Starting a Call

1. **Start Capture** → microphone activates
2. **Start Transcription** → voice recognition begins
3. Script auto-loads and displays
4. Speak → script auto-advances on keywords

### Voice Navigation

- Say keywords ("rugby", "sport", "not interested") to trigger transitions
- Click next node cards or use ↑↓ arrows for manual navigation
- Click "Pause" when customer on hold
- "Resume" when customer returns

### Package Calculator

- Navigate to sport pitch node
- Widget shows Sport/Movies/SoHo packages
- Say "I love rugby" → Sport package auto-enables
- Click checkboxes for manual selection

---

## Testing

See **[docs/WINDOWS_TESTING.md](docs/WINDOWS_TESTING.md)** for comprehensive test suite:
- Audio capture validation
- Whisper transcription accuracy
- South African accent validation (>95% target)
- Performance benchmarks
- Stress testing

---

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Transcription Latency | < 400ms | ✅ Ready |
| SA Accent Accuracy | > 95% | ⏳ Needs Windows testing |
| Memory Usage | < 500 MB | ✅ Lightweight |
| Startup Time | < 5 sec | ✅ Fast |

---

## Roadmap

- **Phase 1**: Local Infrastructure (90% ✅) - Windows testing pending
- **Phase 2**: Script Engine (100% ✅)
- **Phase 3**: Scoring & Coaching (Planned)
- **Phase 4**: Governance & BI (Planned)

---

## Troubleshooting

### "[MOCK] Audio detected" in transcripts
**Expected**: Mock mode active - install whisper.exe to enable real transcription

### WASAPI shows 0%
**Expected**: WASAPI loopback requires Windows testing - see docs/WASAPI_TODO.md

### Build fails on Linux
**Expected**: Target platform is Windows - use Windows machine for .msi build

---

## Documentation

- **[WINDOWS_DEPLOYMENT.md](docs/WINDOWS_DEPLOYMENT.md)** - Build and deploy guide
- **[WINDOWS_TESTING.md](docs/WINDOWS_TESTING.md)** - Test procedures and SA accent validation
- **[WHISPER_SETUP.md](docs/WHISPER_SETUP.md)** - Whisper.cpp installation
- **[WASAPI_TODO.md](docs/WASAPI_TODO.md)** - System audio implementation
- **[PROGRESS.md](PROGRESS.md)** - Development timeline

---

## Technologies

**Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite
**Backend**: Rust, Tauri 2.x, cpal, rusqlite, crossbeam
**External**: Whisper.cpp (small model), WASAPI

---

**Status**: Phase 2 Complete | Ahead of Schedule
**Next Milestone**: Windows testing + Phase 3 (Scoring & Coaching)

Built with ❤️ for BPO agents worldwide
