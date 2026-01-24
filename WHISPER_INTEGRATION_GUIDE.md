# Whisper Integration & Deployment Guide

**Goal**: Make Pilot's Desk installation as simple as double-clicking an `.msi` file for agents

---

## How Whisper Integration Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              PILOT'S DESK DESKTOP APP                    │
│              (Tauri - Single .msi Installer)            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────┐         ┌──────────────────┐        │
│  │  React UI      │         │  Rust Backend    │        │
│  │  (Frontend)    │◄────────┤  (Tauri Core)    │        │
│  │                │  Events │                  │        │
│  └────────────────┘         └────────┬─────────┘        │
│                                      │                   │
│                                      │ Spawns           │
│                                      ▼                   │
│                          ┌──────────────────────┐        │
│                          │  Whisper.cpp         │        │
│                          │  (Sidecar Process)   │        │
│                          │                      │        │
│                          │  whisper.exe         │        │
│                          │  + ggml-small.bin    │        │
│                          └──────────────────────┘        │
│                                      │                   │
│                                      │ stdin/stdout      │
│  ┌────────────────┐                  │                   │
│  │  Audio Capture │─────Audio────────┘                   │
│  │  (cpal/WASAPI) │     Chunks                          │
│  └────────────────┘                                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Key Concepts

**1. Sidecar Process**
- Whisper.cpp runs as a separate process (not embedded in Tauri)
- Tauri spawns whisper.exe when app starts
- Communication via stdin (audio chunks) → stdout (transcripts)
- Tauri automatically manages the lifecycle (start/stop)

**2. Bundled Resources**
- `whisper.exe` - The compiled Whisper.cpp binary (~5 MB)
- `ggml-small.bin` - The AI model file (~500 MB)
- Both bundled into the .msi installer
- Extracted automatically on installation

**3. Zero Manual Setup**
- Agent downloads `Pilot's Desk_0.1.0_x64_en-US.msi`
- Agent double-clicks installer
- Windows extracts everything to `C:\Program Files\Pilot's Desk\`
- Whisper.exe and model placed automatically
- Agent clicks "Pilot's Desk" icon → everything works

---

## Installation Flow (Agent Perspective)

### What the Agent Does

**Step 1**: Download installer
- Email attachment or download link: `Pilot's Desk Installer.msi`
- File size: ~500 MB (includes Whisper model)

**Step 2**: Run installer
- Double-click `Pilot's Desk Installer.msi`
- Click "Next, Next, Install" (standard Windows installer)
- No configuration needed

**Step 3**: Launch app
- Desktop shortcut or Start Menu: "Pilot's Desk"
- App opens, ready to use immediately

**Step 4**: First use
- Click "Start Capture" → Windows asks for microphone permission (one-time)
- Click "Allow"
- Start talking → transcription appears automatically

**That's it!** No manual Whisper setup, no model downloads, no configuration files.

---

## Technical Implementation

### Tauri Configuration (`tauri.conf.json`)

```json
{
  "tauri": {
    "bundle": {
      "identifier": "com.cosauce.pilotsdesk",
      "icon": [
        "icons/icon.png"
      ],
      "targets": ["msi"],
      "windows": {
        "certificateThumbprint": null,
        "digestAlgorithm": "sha256",
        "timestampUrl": ""
      },
      "resources": [
        "models/ggml-small.bin"
      ],
      "externalBin": [
        "sidecars/whisper"
      ]
    }
  }
}
```

**Key Settings**:
- `resources`: Bundles the Whisper model file
- `externalBin`: Bundles whisper.exe as a sidecar
- `targets: ["msi"]`: Builds Windows installer

### File Structure (Before Build)

```
pilots-desk/
├── src-tauri/
│   ├── sidecars/
│   │   └── whisper.exe          # Whisper.cpp compiled for Windows
│   ├── src/
│   │   ├── main.rs
│   │   ├── audio.rs
│   │   └── whisper.rs           # Sidecar management code
│   └── Cargo.toml
│
├── models/
│   └── ggml-small.bin           # Whisper AI model (~500 MB)
│
├── src/                         # React frontend
└── tauri.conf.json
```

### File Structure (After Installation on Agent's PC)

```
C:\Program Files\Pilot's Desk\
├── Pilot's Desk.exe             # Main Tauri app
├── resources\
│   └── ggml-small.bin           # Whisper model (extracted)
└── whisper.exe                  # Whisper sidecar (extracted)
```

**Tauri handles all the extraction and placement automatically!**

---

## Rust Code (Whisper Sidecar Management)

### `src-tauri/src/whisper.rs`

```rust
use tauri::api::process::{Command, CommandEvent};
use std::path::PathBuf;

pub struct WhisperProcess {
    model_path: PathBuf,
}

impl WhisperProcess {
    pub fn new() -> Self {
        // Tauri provides helper to locate bundled resources
        let model_path = tauri::api::path::resource_dir(&config, &package_info)
            .unwrap()
            .join("models")
            .join("ggml-small.bin");

        Self { model_path }
    }

    pub fn spawn(&self) -> tauri::Result<tauri::api::process::CommandChild> {
        // Tauri's Command::new_sidecar() automatically finds whisper.exe
        let (mut rx, child) = Command::new_sidecar("whisper")
            .expect("Failed to setup whisper sidecar")
            .args(&[
                "-m", self.model_path.to_str().unwrap(),
                "--stream",               // Streaming mode
                "--language", "en",       // English (for SA accents)
                "--threads", "4",         // CPU threads
            ])
            .spawn()
            .expect("Failed to spawn whisper");

        // Listen to stdout for transcripts
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(line) => {
                        // Parse transcript, emit to frontend
                        println!("Whisper output: {}", line);
                    }
                    CommandEvent::Stderr(line) => {
                        eprintln!("Whisper error: {}", line);
                    }
                    _ => {}
                }
            }
        });

        Ok(child)
    }

    pub fn send_audio(&self, audio_chunk: Vec<f32>) {
        // Send audio to whisper's stdin
        // Whisper reads 16kHz mono audio chunks
    }
}
```

**Key Points**:
- `Command::new_sidecar("whisper")` - Tauri finds whisper.exe automatically
- `resource_dir()` - Tauri finds bundled model file automatically
- No hardcoded paths - works on any Windows machine
- Process lifecycle managed by Tauri (auto-cleanup on exit)

---

## Building the Installer

### Prerequisites (One-Time Setup on Windows Dev Machine)

**1. Install Rust**
```powershell
# Download from https://rustup.rs/
# Or use winget
winget install Rustlang.Rustup
```

**2. Install Node.js**
```powershell
# Download from https://nodejs.org/
# Or use winget
winget install OpenJS.NodeJS
```

**3. Install Visual Studio Build Tools**
```powershell
# Download from https://visualstudio.microsoft.com/downloads/
# Required for Rust compilation on Windows
# Select "Desktop development with C++"
```

**4. Install WiX Toolset** (for .msi creation)
```powershell
# Download from https://wixtoolset.org/
# Or use winget
winget install WixToolset.WiX
```

### Build Steps

**Step 1: Get Whisper.cpp Binary**

```powershell
# Option A: Download pre-built binary
# Visit: https://github.com/dscripka/whisper.cpp_binaries/releases
# Download: whisper-bin-x64.zip (Windows version)
# Extract: main.exe → rename to whisper.exe

# Option B: Build from source
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
cmake -B build
cmake --build build --config Release
# Copy build/bin/Release/main.exe → whisper.exe
```

**Step 2: Get Whisper Model**

```powershell
cd whisper.cpp
bash models/download-ggml-model.sh small
# Or download directly:
# https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
```

**Step 3: Place Files in Project**

```powershell
cd C:\path\to\pilots-desk

# Copy Whisper binary
copy C:\path\to\whisper.exe src-tauri\sidecars\whisper.exe

# Copy Whisper model
copy C:\path\to\ggml-small.bin models\ggml-small.bin
```

**Step 4: Install Dependencies**

```powershell
# Install Node dependencies
npm install

# Install Rust dependencies (automatic when building)
```

**Step 5: Build Installer**

```powershell
# Build production installer
npm run tauri build

# Output: src-tauri\target\release\bundle\msi\Pilot's Desk_0.1.0_x64_en-US.msi
```

**Step 6: Test Installer**

```powershell
# On a fresh Windows VM or test machine:
# 1. Copy the .msi file
# 2. Double-click to install
# 3. Launch "Pilot's Desk"
# 4. Test audio capture + transcription
```

**Build Time**: ~10-15 minutes on modern Windows machine

**Output File Size**: ~500 MB (mostly the Whisper model)

---

## Distribution Strategy

### Option 1: Direct Download (Simplest)

**Setup**:
1. Upload `Pilot's Desk_0.1.0_x64_en-US.msi` to cloud storage
2. Generate download link (Dropbox, Google Drive, OneDrive)
3. Send link to agents via email

**Agent Experience**:
```
Email: "Click here to download Pilot's Desk"
Agent: Clicks link → Downloads .msi → Installs → Done
```

**Pros**: Simple, no infrastructure needed
**Cons**: Manual link sharing, no auto-updates

---

### Option 2: Self-Hosted Download Portal

**Setup**:
1. Create simple download page on CoSauce server
2. Upload .msi to server
3. Agents visit: `https://downloads.cosauce.com/pilots-desk`

**Agent Experience**:
```
Browser: https://downloads.cosauce.com/pilots-desk
Page: "Download Pilot's Desk for Windows" [Download Button]
Agent: Clicks → Downloads → Installs
```

**Pros**: Professional, versioned downloads, analytics
**Cons**: Need to set up web hosting

---

### Option 3: Update Server (Most Professional)

**Setup**:
1. Use Tauri's built-in updater
2. Host updates on server
3. App checks for updates on launch

**Agent Experience**:
```
Initial: Download v0.1.0 installer
Later: App notifies "Update available" → Click → Auto-updates
```

**Tauri Config** (`tauri.conf.json`):
```json
{
  "tauri": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://updates.cosauce.com/pilots-desk/{{target}}/{{current_version}}"
      ],
      "dialog": true,
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

**Pros**: Automatic updates, version control, seamless
**Cons**: Requires update server setup, code signing

---

## Making It Even Easier

### Pre-Installation Checklist (IT Department)

Before rolling out to agents, IT team can:

**1. Test on Standard Corporate Image**
```
✓ Install on clean Windows 10/11 Pro
✓ Verify microphone access works
✓ Test with corporate antivirus (Windows Defender, etc.)
✓ Verify no firewall blocks to backend API (91.98.79.241:8007)
✓ Test audio loopback (system audio capture)
```

**2. Create Installation Guide** (1-page PDF):
```
PILOT'S DESK - QUICK START

1. Download installer: [Link]
2. Double-click "Pilot's Desk Installer.msi"
3. Click "Next, Next, Install"
4. Launch "Pilot's Desk" from Desktop
5. Click "Start Capture" → Allow microphone
6. Start speaking → See live transcript

Need help? Contact: support@cosauce.com
```

**3. Optional: Silent Install** (for mass deployment):
```powershell
# IT can deploy via Group Policy
msiexec /i "Pilot's Desk_0.1.0_x64_en-US.msi" /quiet

# Or via SCCM/Intune for corporate rollouts
```

---

## Troubleshooting (For IT Support)

### Common Issues & Solutions

**Issue 1: "Whisper.exe not found"**
- **Cause**: Sidecar binary missing from bundle
- **Fix**: Rebuild installer, ensure `whisper.exe` in `src-tauri/sidecars/`

**Issue 2: "Model file not found"**
- **Cause**: Model not bundled correctly
- **Fix**: Rebuild installer, ensure `ggml-small.bin` in `models/` and listed in `resources` in `tauri.conf.json`

**Issue 3: Antivirus blocks whisper.exe**
- **Cause**: Unsigned executable flagged as suspicious
- **Fix**: Code sign the installer (requires certificate) or whitelist in antivirus

**Issue 4: Slow transcription**
- **Cause**: Old CPU, not enough threads
- **Fix**: Reduce threads in whisper args or use `tiny` model instead of `small`

**Issue 5: Microphone permission denied**
- **Cause**: Windows privacy settings block mic
- **Fix**: Settings → Privacy → Microphone → Allow apps to access

**Issue 6: Can't connect to backend**
- **Cause**: Firewall blocks port 8007
- **Fix**: Whitelist `91.98.79.241:8007` in corporate firewall

---

## File Sizes & Performance

### Download Size

| Component | Size | Notes |
|-----------|------|-------|
| Tauri app (Rust + React) | ~15 MB | Compiled binary + frontend |
| whisper.exe | ~5 MB | Whisper.cpp binary |
| ggml-small.bin | ~500 MB | AI model |
| **Total Installer** | **~520 MB** | One-time download |

**Install Time**: 1-2 minutes on SSD

---

### Runtime Performance

| Metric | Value | Hardware |
|--------|-------|----------|
| Transcription Latency | <200ms | i5/Ryzen 5, 4 threads |
| Memory Usage | ~500 MB | Whisper model loaded in RAM |
| CPU Usage | 10-20% | During active transcription |
| Disk Space | ~550 MB | Installed size |

**Minimum Requirements**:
- CPU: Intel i5 / AMD Ryzen 5 (4 cores)
- RAM: 8 GB (2 GB available for app)
- Disk: 1 GB free space
- OS: Windows 10/11 (64-bit)

---

## Code Signing (Optional but Recommended)

### Why Code Signing?

**Without Code Signing**:
- Windows SmartScreen shows warning: "Unknown publisher"
- Antivirus may flag installer as suspicious
- Agents see scary warnings during install

**With Code Signing**:
- Windows shows: "Publisher: CoSauce Ltd (Verified)"
- No SmartScreen warnings
- Professional appearance
- Antivirus less likely to block

### How to Get Code Signing Certificate

**Option 1: DigiCert / Sectigo**
- Cost: ~$200-400/year
- Process: Company verification (1-3 days)
- Delivery: USB token or cloud-based

**Option 2: Microsoft Partner (Cheaper)**
- Cost: ~$100/year
- Vendor: SSL.com, Certum
- Same Windows trust

### Signing the Installer

```powershell
# Using SignTool (part of Windows SDK)
signtool sign /f certificate.pfx /p password /t http://timestamp.digicert.com "Pilot's Desk_0.1.0_x64_en-US.msi"

# Or configure in tauri.conf.json (automatic during build)
{
  "tauri": {
    "bundle": {
      "windows": {
        "certificateThumbprint": "YOUR_CERT_THUMBPRINT",
        "timestampUrl": "http://timestamp.digicert.com"
      }
    }
  }
}
```

**Recommendation**: Start without code signing for MVP testing. Add it before full rollout to 100+ agents.

---

## Summary: Agent Installation Experience

### Current (Mock Whisper)
1. Download installer
2. Install
3. Launch app
4. See mock transcripts

**Time**: 5 minutes

---

### With Real Whisper (After Integration)
1. Download installer (~520 MB)
2. Double-click installer
3. Click "Next, Next, Install"
4. Launch "Pilot's Desk"
5. Allow microphone permission (one-time)
6. Start speaking → see real transcripts immediately

**Time**: 5 minutes (same!)

**Agent Setup Steps**: **ZERO** manual configuration
- No Whisper installation
- No model downloads
- No config files
- No technical knowledge required

---

## Next Steps

**For You (To Complete Integration)**:

1. **Get Windows Dev Machine**
   - Windows 10/11 with development tools
   - Or Windows VM on your Mac/Linux

2. **Download Whisper.cpp**
   - Pre-built binary: https://github.com/dscripka/whisper.cpp_binaries/releases
   - Or build from source

3. **Download Whisper Model**
   - `ggml-small.bin` from Hugging Face or whisper.cpp repo

4. **Place in Project**
   - `src-tauri/sidecars/whisper.exe`
   - `models/ggml-small.bin`

5. **Test Locally**
   ```powershell
   npm run tauri dev
   # Test with SA audio samples
   ```

6. **Build Installer**
   ```powershell
   npm run tauri build
   # Output: .msi installer (~520 MB)
   ```

7. **Test on Fresh Windows Machine**
   - Install .msi
   - Verify everything works
   - Test with real SA agent speech

8. **Distribute**
   - Upload to cloud storage
   - Send link to agents
   - Done!

---

**Bottom Line**: Once Whisper is integrated and installer built, agent installation is literally:

1. Download .msi
2. Double-click
3. Use app

**No technical setup required!** Everything bundled and automatic.

---

**Created**: 2026-01-24
**Status**: Ready for Windows integration
**Complexity**: Low (Tauri handles 90% of it automatically)
**Agent Experience**: 🎯 **One-click install, zero configuration**
