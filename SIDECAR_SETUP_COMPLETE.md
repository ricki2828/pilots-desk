# Whisper Sidecar Setup - Complete

**Date**: 2026-01-24
**Status**: Linux testing environment ready ✅

---

## What We Just Set Up

I've created the complete Whisper sidecar structure for you. Here's what's in place:

### Directory Structure

```
/home/ricki28/pilots-desk/
├── src-tauri/
│   ├── sidecars/
│   │   └── whisper-x86_64-unknown-linux-gnu    (3.7 MB - Whisper binary for Linux)
│   └── tauri.conf.json                          (Updated with sidecar config)
└── models/
    └── ggml-small.bin                           (466 MB - Whisper small model)
```

### What Was Created

1. **Sidecars folder**: `/home/ricki28/pilots-desk/src-tauri/sidecars/`
   - This is where Tauri looks for external binaries to bundle
   - Currently contains Linux x64 binary for testing

2. **Models folder**: `/home/ricki28/pilots-desk/models/`
   - Contains the Whisper small model (ggml-small.bin)
   - This model will be bundled into the installer

3. **Tauri configuration updated**: `src-tauri/tauri.conf.json`
   - Added `"externalBin": ["sidecars/whisper"]` - tells Tauri to bundle the Whisper binary
   - Added `"resources": ["../models/*"]` - tells Tauri to bundle the model file

---

## How Tauri Sidecars Work

When you build the Tauri app, it will:

1. **Find the binary**: Look in `src-tauri/sidecars/` for files matching the pattern `whisper-<target-triple>`
   - Linux: `whisper-x86_64-unknown-linux-gnu`
   - Windows: `whisper-x86_64-pc-windows-msvc.exe`
   - macOS: `whisper-x86_64-apple-darwin`

2. **Bundle everything**: Package the binary + model into the installer
   - Windows .msi: ~520 MB (3.7 MB binary + 466 MB model + app code)
   - Linux: Similar size

3. **Install location**: When user installs, Tauri places files in:
   - Binary: App-specific directory (managed by Tauri)
   - Model: Resource directory (accessible via Tauri API)

4. **Runtime access**: Your Rust code spawns the Whisper process using Tauri's sidecar API:
   ```rust
   use tauri::api::process::Command;

   let (mut rx, _child) = Command::new_sidecar("whisper")
       .expect("failed to create whisper sidecar")
       .args(["-m", "models/ggml-small.bin", "-f", "audio.wav"])
       .spawn()
       .expect("Failed to spawn whisper");
   ```

---

## Current Status: Linux Testing Environment

✅ **What's working now**:
- Sidecar directory created
- Linux Whisper binary in place
- Model downloaded
- Tauri configuration updated

⏳ **What's needed for production (Windows)**:

When you have access to a Windows machine:

1. **Download Windows Whisper binary** (~3.7 MB):
   ```
   https://github.com/dscripka/whisper.cpp_binaries/releases/download/commit_3d42463/whisper-bin-x64.exe
   ```

2. **Place in sidecars folder** with correct name:
   ```
   /home/ricki28/pilots-desk/src-tauri/sidecars/whisper-x86_64-pc-windows-msvc.exe
   ```

3. **Build Windows installer**:
   ```bash
   npm run tauri build -- --target x86_64-pc-windows-msvc
   ```

4. **Output**: `src-tauri/target/release/bundle/msi/Pilots Desk_0.1.0_x64_en-US.msi` (~520 MB)

---

## Testing the Linux Setup (Optional)

You can test the sidecar on Linux right now to verify the concept works:

```bash
# Test Whisper binary directly
/home/ricki28/pilots-desk/src-tauri/sidecars/whisper-x86_64-unknown-linux-gnu \
  -m /home/ricki28/pilots-desk/models/ggml-small.bin \
  -f /home/ricki28/pilots-desk/tauri-client/test_audio/sa_sample_johannesburg.mp3

# Expected output:
# - Transcription of the SA accent audio
# - Confirms binary + model work together
```

---

## Key Files Modified

### `src-tauri/tauri.conf.json`

```json
{
  "bundle": {
    ...
    "resources": ["../models/*"],
    "externalBin": ["sidecars/whisper"],
    ...
  }
}
```

**What this does**:
- `externalBin`: Bundles the Whisper binary into the installer
- `resources`: Bundles the model file into the installer
- Tauri automatically handles platform-specific binary selection (Linux/Windows/macOS)

---

## Agent Installation Experience (Windows)

When you ship the Windows .msi installer to BPO agents:

1. **Download**: `Pilots Desk_0.1.0_x64_en-US.msi` (~520 MB)
2. **Double-click**: Windows installer runs
3. **Click "Next" a few times**: Standard Windows installer flow
4. **Done**: App installed with Whisper + model bundled inside

**Zero manual configuration required.**

The agent just:
- Launches Pilot's Desk
- Grants microphone permission (Windows prompt)
- Starts using it

Whisper runs automatically in the background. No Python, no command line, no technical setup.

---

## File Sizes Summary

| Component | Size | Location |
|-----------|------|----------|
| Whisper binary (Linux) | 3.7 MB | `src-tauri/sidecars/whisper-x86_64-unknown-linux-gnu` |
| Whisper model (small) | 466 MB | `models/ggml-small.bin` |
| Tauri app code | ~50 MB | `src-tauri/target/release/` |
| **Total installer** | **~520 MB** | Final .msi file |

---

## Next Steps

1. **Test on Linux** (optional): Verify Whisper transcribes the SA audio samples
2. **Get Windows binary**: When you have access to a Windows machine
3. **Build Windows installer**: Bundle everything into .msi
4. **Test on Windows**: Verify zero-config installation
5. **Ship to agents**: Distribute .msi installer

---

## Reference Documentation

- **Main guide**: `/home/ricki28/pilots-desk/WHISPER_INTEGRATION_GUIDE.md`
- **Deployment status**: `/home/ricki28/pilots-desk/DEPLOYMENT_COMPLETE.md`
- **SA accent testing**: `/home/ricki28/pilots-desk/SA_TESTING_STATUS.md`
- **Tauri sidecar docs**: https://tauri.app/v2/guides/building/sidecar/

---

**Summary**: The sidecar structure is now ready. When you have the Windows binary, just drop it in `src-tauri/sidecars/` with the name `whisper-x86_64-pc-windows-msvc.exe`, run `npm run tauri build`, and you'll get a zero-config installer for agents.

✅ **Linux testing environment complete**
⏳ **Windows build ready when you have access to a Windows machine**
