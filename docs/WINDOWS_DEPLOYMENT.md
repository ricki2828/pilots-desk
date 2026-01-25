# Windows Deployment Guide

**Last Updated:** 2026-01-24
**Status:** Ready for Windows build

---

## Prerequisites

### Development Machine Requirements
- Windows 10 or Windows 11 (64-bit)
- Visual Studio 2019 or newer with C++ build tools
- Rust toolchain (stable channel)
- Node.js 18+ and npm
- Git for Windows

### Installation Steps

1. **Install Visual Studio C++ Build Tools**
   ```powershell
   # Download from: https://visualstudio.microsoft.com/downloads/
   # Install "Desktop development with C++" workload
   ```

2. **Install Rust**
   ```powershell
   # Download from: https://rustup.rs/
   # Or use winget:
   winget install Rustlang.Rustup
   ```

3. **Install Node.js**
   ```powershell
   # Download from: https://nodejs.org/
   # Or use winget:
   winget install OpenJS.NodeJS.LTS
   ```

4. **Install Tauri CLI**
   ```powershell
   npm install -g @tauri-apps/cli
   ```

---

## Building the Windows Installer

### 1. Clone and Setup

```powershell
# Clone repository
git clone <repository-url>
cd pilots-desk

# Install dependencies
npm install
```

### 2. Build for Production

```powershell
# Build the Windows installer (.msi)
npm run tauri build

# Output will be in:
# src-tauri/target/release/bundle/msi/Pilot's Desk_0.1.0_x64_en-US.msi
```

### 3. Verify Build Output

The build process will create:
- **MSI Installer**: `Pilot's Desk_0.1.0_x64_en-US.msi`
- **Executable**: `src-tauri/target/release/pilots-desk.exe`
- **NSIS Installer** (optional): `Pilot's Desk_0.1.0_x64-setup.exe`

### 4. Test the Installer

```powershell
# Install on test machine
msiexec /i "Pilot's Desk_0.1.0_x64_en-US.msi"

# Or double-click the .msi file
```

---

## Development Build (Fast Iteration)

For development and testing without creating installer:

```powershell
# Run in development mode
npm run tauri dev

# This will:
# 1. Start Vite dev server (React hot reload)
# 2. Compile Rust backend
# 3. Launch application window
# 4. Enable hot reloading for frontend changes
```

---

## WASAPI Configuration

### Enable System Audio Loopback

The current build includes a WASAPI placeholder. To enable full system audio capture:

1. **Update Cargo.toml** (already configured):
   ```toml
   [dependencies.windows]
   version = "0.52"
   features = [
       "Win32_Media_Audio",
       "Win32_System_Com",
   ]
   ```

2. **Test WASAPI functionality**:
   - See `docs/WASAPI_TODO.md` for implementation guide
   - Run `npm run tauri dev` and start capture
   - Verify system audio appears in "System Audio (WASAPI)" meter

---

## Whisper.cpp Integration

### Option 1: Use Mock Mode (No Setup Required)

The application includes mock transcription mode for development:
- Detects audio via RMS calculation
- Generates placeholder transcripts
- Full UI and pipeline functional
- No Whisper binary needed

### Option 2: Install Real Whisper.cpp

For production deployment with real transcription:

1. **Download Pre-built Binary** (recommended):
   ```powershell
   # Download from: https://github.com/ggerganov/whisper.cpp/releases
   # Look for: whisper-bin-x64.zip (Windows x64)

   # Extract to project:
   # pilots-desk/src-tauri/sidecars/whisper.exe
   ```

2. **Or Compile from Source**:
   ```powershell
   git clone https://github.com/ggerganov/whisper.cpp.git
   cd whisper.cpp

   # Build with CMake
   cmake -B build -DCMAKE_BUILD_TYPE=Release
   cmake --build build --config Release

   # Copy binary
   copy build/bin/Release/main.exe ../pilots-desk/src-tauri/sidecars/whisper.exe
   ```

3. **Download Model**:
   ```powershell
   # Download ggml-small.bin (466 MB) - recommended for production
   curl -L -o models/ggml-small.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin

   # Or ggml-base.bin (142 MB) - faster, slightly less accurate
   curl -L -o models/ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin
   ```

4. **Test Whisper**:
   ```powershell
   # Restart application - it will auto-detect whisper.exe
   npm run tauri dev

   # Start transcription and verify real STT output
   ```

**See `docs/WHISPER_SETUP.md` for detailed instructions.**

---

## Installer Customization

### Custom Icon

Replace icons in `src-tauri/icons/`:
- `32x32.png` - Taskbar icon
- `128x128.png` - Installer icon
- `icon.ico` - Windows executable icon

### Branding

Edit `src-tauri/tauri.conf.json`:
```json
{
  "bundle": {
    "publisher": "Your Company",
    "copyright": "Copyright © 2026 Your Company",
    "shortDescription": "Your description",
    "longDescription": "Extended description"
  }
}
```

### Version Updates

Update version in three places:
1. `src-tauri/tauri.conf.json` → `"version": "0.2.0"`
2. `src-tauri/Cargo.toml` → `version = "0.2.0"`
3. `package.json` → `"version": "0.2.0"`

---

## Deployment to BPO Agents

### Manual Installation (Phase 1)

1. **Copy installer to network share**:
   ```powershell
   copy "Pilot's Desk_0.1.0_x64_en-US.msi" \\fileserver\software\
   ```

2. **Install on agent workstations**:
   ```powershell
   # Silent install
   msiexec /i "\\fileserver\software\Pilot's Desk_0.1.0_x64_en-US.msi" /quiet

   # Or with UI
   msiexec /i "\\fileserver\software\Pilot's Desk_0.1.0_x64_en-US.msi"
   ```

3. **Copy scripts to application data**:
   ```powershell
   # Scripts should be placed in:
   C:\Users\[AgentUsername]\AppData\Roaming\com.cosauce.pilotsdesk\scripts\
   ```

### Group Policy Deployment (Future)

For enterprise rollout:
1. Create GPO in Active Directory
2. Add MSI to Software Installation policy
3. Assign to agent computers OU
4. Agents receive app on next login

---

## Troubleshooting

### Build Fails with "link.exe not found"

**Solution**: Install Visual Studio C++ Build Tools
```powershell
# Verify installation:
where link.exe
# Should output: C:\Program Files\Microsoft Visual Studio\...\link.exe
```

### WebView2 Not Found

**Solution**: Install WebView2 Runtime (bundled in installer automatically)
```powershell
# Manual download if needed:
# https://developer.microsoft.com/en-us/microsoft-edge/webview2/
```

### Audio Capture Fails

**Solution**: Check microphone permissions
```powershell
# Windows Settings → Privacy → Microphone
# Ensure "Allow apps to access your microphone" is ON
```

### WASAPI Shows Zero Level

**Expected Behavior**: WASAPI loopback requires Windows implementation (see `docs/WASAPI_TODO.md`)
- Microphone capture works
- System audio shows 0% (not yet implemented)
- Combined level = mic level only

### Whisper Transcription Shows "[MOCK]"

**Expected Behavior**: Mock mode is active when whisper.exe not found
- Place whisper.exe in `src-tauri/sidecars/`
- Download model to `models/ggml-small.bin`
- Restart application

---

## Performance Optimization

### Build Size Reduction

```toml
# src-tauri/Cargo.toml
[profile.release]
strip = true          # Strip symbols
lto = true           # Link-time optimization
codegen-units = 1    # Better optimization
opt-level = "z"      # Optimize for size
```

### Startup Time

- Use `ggml-small.bin` model (faster load than `medium` or `large`)
- Pre-warm Whisper on app launch
- Cache script files in AppData

---

## Testing Checklist

Before deploying to production:

- [ ] Installer runs on fresh Windows 10 machine
- [ ] Installer runs on fresh Windows 11 machine
- [ ] Application starts without errors
- [ ] Microphone capture works
- [ ] WASAPI system audio capture works
- [ ] Whisper transcription produces accurate text
- [ ] South African accents transcribe correctly (>95% accuracy)
- [ ] Sky TV script loads and displays
- [ ] Voice navigation triggers correctly
- [ ] Package calculator widget functions
- [ ] Pause/resume controls work
- [ ] Application uninstalls cleanly

---

## Update Process

### For Users

1. Download new installer
2. Run installer (will upgrade existing installation)
3. Existing scripts and data preserved in AppData

### For Developers

```powershell
# Increment version
# Update tauri.conf.json, Cargo.toml, package.json

# Build new installer
npm run tauri build

# Test upgrade path
msiexec /i "Pilot's Desk_0.2.0_x64_en-US.msi"
```

---

## Distribution Checklist

Before sending to BPO:

- [ ] Version number updated
- [ ] Changelog documented
- [ ] Installer tested on clean Windows
- [ ] Documentation updated
- [ ] Sample scripts included
- [ ] Training materials prepared
- [ ] IT department notified (firewall, permissions)

---

## Support Information

**GitHub Issues**: [Repository Issues URL]
**Documentation**: `/docs/` folder in installation directory
**Logs**: `%APPDATA%\com.cosauce.pilotsdesk\logs\`

---

**Next Steps**: Run build on Windows machine and test with South African audio samples.
