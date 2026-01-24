# Pilot's Desk - Build Instructions

**Date**: 2026-01-24
**Platform**: Multi-platform (Linux ARM64, Windows x64)

---

## Important: Platform-Specific Builds

### Your Current Server
- **Platform**: Linux ARM64 (aarch64)
- **Can build**: Linux ARM64 binaries
- **Cannot build**: Windows .msi installers (needs Windows x64 machine)

### For Production (BPO Agents)
- **Target platform**: Windows x64
- **Needs**: Windows machine to build .msi installer

---

## Build on Linux (This Server) - For Testing Only

### Prerequisites ✅ (Already Installed)
- Rust 1.93.0 ✅
- Node.js ✅
- Cargo ✅

### Build Command

```bash
cd /home/ricki28/pilots-desk
export PATH="$HOME/.cargo/bin:$PATH"
npm run tauri build
```

### Build Output (Linux ARM64)

```
src-tauri/target/release/bundle/
├── deb/
│   └── pilots-desk_0.1.0_arm64.deb        (Debian package)
├── appimage/
│   └── pilots-desk_0.1.0_aarch64.AppImage (Portable Linux app)
└── rpm/
    └── pilots-desk-0.1.0-1.aarch64.rpm    (RPM package)
```

**Note**: These Linux ARM64 builds are for testing only, not for Windows agents.

---

## Build on Windows - For Production Agents

### Prerequisites (On Windows Machine)

1. **Install Rust**:
   - Download: https://rustup.rs/
   - Run installer, choose default options
   - Restart terminal after installation

2. **Install Node.js**:
   - Download: https://nodejs.org/
   - Version: 18.x or later
   - Include npm in installation

3. **Install Visual Studio Build Tools** (for native compilation):
   - Download: https://visualstudio.microsoft.com/downloads/
   - Install "Desktop development with C++"
   - Or run: `npm install --global windows-build-tools`

### Setup Project on Windows

1. **Transfer project files** to Windows machine:
   ```bash
   # From Linux server (this machine):
   cd /home/ricki28/pilots-desk
   zip -r pilots-desk.zip .
   scp pilots-desk.zip user@windows-machine:

   # On Windows:
   # Extract pilots-desk.zip
   ```

2. **Verify files transferred**:
   ```
   pilots-desk/
   ├── src-tauri/
   │   └── sidecars/
   │       ├── whisper-x86_64-pc-windows-msvc.exe ✅
   │       └── *.dll (5 DLL files) ✅
   └── models/
       └── ggml-small.bin ✅
   ```

### Build Command (On Windows)

```powershell
cd pilots-desk
npm install
npm run tauri build
```

### Build Output (Windows x64)

```
src-tauri\target\release\bundle\msi\
└── Pilot's Desk_0.1.0_x64_en-US.msi   (~475 MB)
```

**This is what you distribute to BPO agents.**

---

## Build Times

| Platform | First Build | Subsequent Builds |
|----------|-------------|-------------------|
| Linux | 8-12 minutes | 2-4 minutes |
| Windows | 10-15 minutes | 3-5 minutes |

---

## Troubleshooting

### Windows: "cargo not found"

**Solution**: Restart terminal after Rust installation
```powershell
# Check if Rust is installed:
cargo --version
rustc --version
```

### Windows: "linker error" or "msvc not found"

**Solution**: Install Visual Studio Build Tools
```powershell
# Download and install:
https://visualstudio.microsoft.com/downloads/
# Select: "Desktop development with C++"
```

### Linux: "error: requires `rustc 1.70` or newer"

**Solution**: Update Rust
```bash
rustup update
```

### Build fails: "beforeBuildCommand failed"

**Solution**: TypeScript errors in frontend code
```bash
# Check TypeScript errors:
npm run build

# Common fix - remove unused variables or prefix with _
```

---

## Testing the Build

### On Windows

1. **Install the .msi**:
   - Double-click `Pilot's Desk_0.1.0_x64_en-US.msi`
   - Follow installer wizard
   - Grant permissions when prompted

2. **Launch Pilot's Desk**:
   - Start menu → Pilot's Desk
   - Grant microphone permission
   - Verify audio capture starts

3. **Test with SA audio sample**:
   - Copy one of the test audio files to Windows
   - Or speak in South African accent
   - Verify transcript appears

### On Linux (Testing)

1. **Install the AppImage**:
   ```bash
   chmod +x src-tauri/target/release/bundle/appimage/*.AppImage
   ./pilots-desk_0.1.0_aarch64.AppImage
   ```

2. **Or install the .deb**:
   ```bash
   sudo dpkg -i src-tauri/target/release/bundle/deb/*.deb
   pilots-desk
   ```

---

## Current Build Status

### ✅ Ready on This Server (Linux ARM64)

- Rust: 1.93.0 installed
- Cargo: 1.93.0 installed
- Node: Installed
- Project files: All in place
- Whisper binaries: Downloaded (Linux + Windows)
- Whisper model: Downloaded (466 MB)

**Can build**: Linux ARM64 packages (for testing)

### ⏳ Needs Windows Machine

To build the Windows .msi for production:

1. Get access to Windows x64 machine
2. Transfer project files
3. Install Rust + Node.js
4. Run `npm run tauri build`
5. Distribute `Pilot's Desk_0.1.0_x64_en-US.msi` to agents

---

## Quick Start (Windows Machine)

If you just want to build on Windows quickly:

```powershell
# 1. Install prerequisites
winget install Rustlang.Rustup
winget install OpenJS.NodeJS

# 2. Clone/copy project
cd pilots-desk

# 3. Install dependencies
npm install

# 4. Build
npm run tauri build

# 5. Output
# src-tauri\target\release\bundle\msi\Pilot's Desk_0.1.0_x64_en-US.msi
```

**Distribution**: Send the .msi to agents, they just double-click to install.

---

## Alternative: GitHub Actions CI/CD

You can automate Windows builds using GitHub Actions (no local Windows machine needed):

### `.github/workflows/build-windows.yml`

```yaml
name: Build Windows Installer

on:
  push:
    tags:
      - 'v*'

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install dependencies
        run: npm install

      - name: Build Tauri
        run: npm run tauri build

      - name: Upload installer
        uses: actions/upload-artifact@v4
        with:
          name: windows-installer
          path: src-tauri/target/release/bundle/msi/*.msi
```

**Trigger**: Push a git tag (`git tag v0.1.0 && git push --tags`)
**Download**: Installer available in GitHub Actions artifacts

---

## Files Checklist (Before Building on Windows)

Verify these files exist in your project before building:

```
✅ src-tauri/sidecars/whisper-x86_64-pc-windows-msvc.exe (28 KB)
✅ src-tauri/sidecars/ggml-base.dll (524 KB)
✅ src-tauri/sidecars/ggml-cpu.dll (667 KB)
✅ src-tauri/sidecars/ggml.dll (66 KB)
✅ src-tauri/sidecars/whisper.dll (473 KB)
✅ src-tauri/sidecars/SDL2.dll (2.4 MB)
✅ models/ggml-small.bin (466 MB)
✅ src-tauri/tauri.conf.json (Updated with sidecar config)
```

**All files present**: Ready to build ✅

---

**Summary**:
- **Linux build**: Running now (for testing)
- **Windows .msi**: Requires Windows machine
- **Agent distribution**: Windows .msi (~475 MB, zero-config installation)
