# Development Notes

## Current Status

### Phase 1.2: Audio Capture Module - COMPLETED

Created Rust audio capture infrastructure with the following components:

#### Files Created:
- `src-tauri/src/audio.rs` - Audio capture module using cpal
- `src-tauri/src/storage.rs` - SQLite storage for transcripts
- `src-tauri/src/lib.rs` - Tauri command interface

#### Tauri Commands Available:
- `init_audio()` - Initialize audio system
- `start_capture()` - Start microphone + system audio capture
- `stop_capture()` - Stop all audio capture
- `get_audio_levels()` - Get current mic/system/combined audio levels
- `is_capturing()` - Check capture status

#### Features Implemented:
- **Microphone capture** using cpal (cross-platform)
- **Audio level monitoring** (RMS calculation for UI visualization)
- **Channel-based audio buffering** (crossbeam-channel)
- **SQLite local storage** for transcript caching
- **WASAPI loopback placeholder** (Windows-specific, requires testing on Windows)

## Platform Notes

### Current Development Environment
- **Platform:** Linux (aarch64-unknown-linux-gnu)
- **Target Platform:** Windows (for WASAPI loopback)

### Linux Limitations
- Cannot compile/test Tauri GTK dependencies without sudo
- WASAPI loopback is Windows-only feature
- Full integration testing requires Windows environment

### Windows Requirements
When testing on Windows, ensure:
1. Rust toolchain installed (rustup)
2. Node.js 20+ installed
3. Visual Studio Build Tools (for native compilation)
4. WebView2 runtime (usually pre-installed on Windows 11)

## Next Steps

### Phase 1.3: WASAPI Loopback (Windows-specific)
The current `audio.rs` includes a placeholder for WASAPI loopback. To implement full system audio capture:

1. Add `windows-rs` crate dependency
2. Implement WASAPI loopback using `IMMDeviceEnumerator` and `IAudioClient`
3. Test on Windows with both web-based and desktop dialers

### Phase 1.4: Whisper.cpp Integration
Compile Whisper.cpp for Windows as a sidecar binary.

## Architecture Decisions

### Why cpal?
- Cross-platform audio I/O
- Low latency
- Active maintenance
- Used by many Rust audio projects

### Why crossbeam-channel?
- Lock-free performance
- Better than std::sync::mpsc for audio buffers
- Bounded channels prevent memory bloat

### Why rusqlite?
- Embedded database (no separate process)
- ACID transactions
- Simple schema for MVP
- Easy to migrate to PostgreSQL cloud later

## Audio Processing Flow

```
┌─────────────┐
│ Microphone  │──┐
└─────────────┘  │
                 │    ┌──────────────┐    ┌─────────────────┐
                 ├───→│ cpal Stream  │───→│ Audio Buffer    │
                 │    └──────────────┘    │ (crossbeam)     │
┌─────────────┐  │                        └─────────────────┘
│ System Audio│──┘                                 │
│ (WASAPI)    │                                    │
└─────────────┘                                    ▼
                                           ┌─────────────────┐
                                           │ Whisper.cpp     │
                                           │ (Sidecar)       │
                                           └─────────────────┘
                                                    │
                                                    ▼
                                           ┌─────────────────┐
                                           │ Transcript      │
                                           │ Stream          │
                                           └─────────────────┘
```

## Testing Strategy

### Unit Tests
- Audio RMS calculation ✅
- Storage CRUD operations ✅
- Config defaults ✅

### Integration Tests (Requires Windows)
- [ ] Microphone capture with real device
- [ ] WASAPI loopback with real audio
- [ ] Combined mic + system audio
- [ ] Audio level accuracy
- [ ] Buffer overflow handling

### South African Accent Testing
Remember: Agents are South African, customers are New Zealand.

Test samples needed:
- Gauteng accent (Johannesburg/Pretoria)
- Western Cape accent (Cape Town)
- KwaZulu-Natal accent (Durban)

## Known Issues

1. **WASAPI loopback not fully implemented** - Requires `windows-rs` crate and platform-specific code
2. **Linux build blocked** - Missing GTK dependencies (requires sudo)
3. **No audio samples yet** - Need SA-accented test recordings

## Dependencies Added

### Rust Crates (Cargo.toml)
```toml
cpal = "0.15"                    # Audio I/O
crossbeam-channel = "0.5"        # Lock-free channels
rusqlite = { version = "0.32", features = ["bundled"] }
uuid = { version = "1.0", features = ["v4", "serde"] }
log = "0.4"
env_logger = "0.11"
tokio = { version = "1", features = ["full"] }
chrono = { version = "0.4", features = ["serde"] }
```

## Build Commands

### Check (without full compile)
```bash
cargo check --manifest-path=src-tauri/Cargo.toml
```

### Build for Windows (cross-compile)
```bash
# Requires windows target installed
rustup target add x86_64-pc-windows-msvc
cargo build --target x86_64-pc-windows-msvc --manifest-path=src-tauri/Cargo.toml
```

### Run (on Windows)
```bash
npm run tauri dev
```

## Timeline Tracking

**3-Month Timeline** - Started: 2026-01-24

- ✅ Week 1, Day 1: Project initialization
- ✅ Week 1, Day 1: Rust audio module created
- ⏳ Week 1, Day 1-2: WASAPI integration (requires Windows)
- ⏳ Week 1, Day 2-3: Whisper.cpp sidecar
- ⏳ Week 1, Day 3-4: Frontend audio visualization
