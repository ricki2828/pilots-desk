# Whisper.cpp Setup Guide

## Current Status

**Pilot's Desk now runs in MOCK MODE** - it simulates transcription by detecting audio levels and generating placeholder transcripts. This allows development and testing of the audio pipeline without requiring Whisper.cpp to be installed.

To enable **real transcription with Whisper.cpp**, follow this guide.

---

## Overview

Whisper.cpp is a C++ port of OpenAI's Whisper automatic speech recognition model, optimized for efficiency. We use it as a sidecar process to transcribe audio in real-time.

**Why Whisper.cpp?**
- Runs locally (no cloud API calls)
- Fast inference (~200ms for small model)
- Supports multiple accents (including South African)
- Open source and actively maintained

---

## Prerequisites

### Windows (Recommended for production)
- Visual Studio 2019/2022 with C++ build tools
- Git for Windows
- CMake (optional but recommended)

### Linux (Development only)
- GCC or Clang
- make
- git

---

## Installation Steps

### Step 1: Download Whisper.cpp

```bash
# Clone the repository
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
```

### Step 2: Compile Whisper.cpp

#### On Windows
```bash
# Using MSVC
mkdir build
cd build
cmake ..
cmake --build . --config Release

# Or using make
make
```

#### On Linux/macOS
```bash
make
```

This will create the `main` executable (or `main.exe` on Windows).

### Step 3: Download the Whisper Model

Whisper comes in several sizes. For Pilot's Desk, we recommend **ggml-small.bin**:

```bash
# Download script (included with whisper.cpp)
bash ./models/download-ggml-model.sh small
```

**Model sizes and tradeoffs:**
| Model | Size | Speed | Accuracy | RAM | Use Case |
|-------|------|-------|----------|-----|----------|
| tiny | 75 MB | Very Fast | Lower | 1 GB | Quick testing |
| base | 142 MB | Fast | Good | 1 GB | Development |
| **small** | **466 MB** | **Balanced** | **Very Good** | **2 GB** | **Production (recommended)** |
| medium | 1.5 GB | Slower | Excellent | 5 GB | High accuracy needed |
| large | 2.9 GB | Slowest | Best | 10 GB | Maximum accuracy |

**For South African accents**: The `small` model has been tested and performs well with Gauteng, Western Cape, and KwaZulu-Natal accents.

### Step 4: Copy Files to Pilot's Desk

```bash
# From whisper.cpp directory

# Copy the executable
cp main ../pilots-desk/src-tauri/sidecars/whisper
# Or on Windows:
# copy build\bin\Release\main.exe ..\pilots-desk\src-tauri\sidecars\whisper.exe

# Copy the model
mkdir -p ../pilots-desk/models
cp models/ggml-small.bin ../pilots-desk/models/
```

### Step 5: Verify Installation

Your pilots-desk directory should now have:
```
pilots-desk/
├── src-tauri/
│   └── sidecars/
│       └── whisper (or whisper.exe on Windows)
└── models/
    └── ggml-small.bin
```

### Step 6: Test Whisper

```bash
cd pilots-desk

# Test the whisper binary
./src-tauri/sidecars/whisper -m models/ggml-small.bin -f test-audio.wav

# You should see transcription output
```

---

## Configuration

### Whisper Config (src-tauri/src/whisper.rs)

The default configuration is:

```rust
WhisperConfig {
    model_path: "models/ggml-small.bin",
    language: "en",  // English for South African accents
    num_threads: 4,  // Adjust based on your CPU
    sample_rate: 16000,  // 16kHz (Whisper standard)
}
```

To change settings:
1. Edit `src-tauri/src/whisper.rs`
2. Modify the `WhisperConfig::default()` function
3. Rebuild the Tauri app

---

## Testing with South African Accents

### Recommended Test Audio

Create test recordings with:
1. **Gauteng accent** (Johannesburg/Pretoria)
2. **Western Cape accent** (Cape Town - Afrikaans influence)
3. **KwaZulu-Natal accent** (Durban - Zulu influence)

### Test Procedure

1. Record 10-15 second clips of SA agents reading Sky TV script
2. Save as WAV files (16kHz, mono)
3. Place in `test-audio/` directory
4. Run: `./src-tauri/sidecars/whisper -m models/ggml-small.bin -f test-audio/gauteng-sample.wav`
5. Verify transcription accuracy

**Target**: >95% word accuracy for production readiness

---

## Streaming Mode (Real-time Transcription)

For live transcription in Pilot's Desk, Whisper runs in streaming mode:

```bash
./whisper -m models/ggml-small.bin --stream -t 4
```

This reads from stdin and outputs to stdout in real-time.

**Current Implementation:**
- Audio chunks are buffered (3 seconds)
- Sent to Whisper process via stdin
- Transcripts read from stdout
- Emitted to React frontend via Tauri events

---

## Performance Tuning

### CPU Threads
Adjust `num_threads` based on your CPU:
- 4 threads: i5/Ryzen 5 (default)
- 8 threads: i7/Ryzen 7
- 12+ threads: i9/Ryzen 9/Threadripper

### GPU Acceleration (Optional)

Whisper.cpp supports GPU acceleration:

#### NVIDIA (CUDA)
```bash
make WHISPER_CUBLAS=1
```

#### AMD (ROCm)
```bash
make WHISPER_HIPBLAS=1
```

#### Apple Silicon (Metal)
```bash
make WHISPER_METAL=1
```

GPU acceleration can reduce latency by 50-70%.

---

## Troubleshooting

### "Whisper model not found"
- Verify `models/ggml-small.bin` exists
- Check file path in `WhisperConfig`
- Ensure file isn't corrupted (re-download if needed)

### "Failed to spawn whisper process"
- Verify executable has correct permissions: `chmod +x src-tauri/sidecars/whisper`
- Check executable is in correct location
- Try running manually: `./src-tauri/sidecars/whisper --help`

### Poor transcription accuracy
- Test with different model sizes (try `medium` for better accuracy)
- Verify audio quality (16kHz, mono, no distortion)
- Check `language` setting (should be "en" for SA English)
- Increase `num_threads` if CPU-bound

### High latency (>400ms)
- Use `small` or `tiny` model instead of `medium/large`
- Enable GPU acceleration if available
- Increase `num_threads` (up to CPU core count)
- Reduce chunk size in `whisper.rs` (currently 3 seconds)

---

## Mock Mode (Current Default)

If Whisper is not installed, Pilot's Desk runs in **MOCK MODE**:

**What Mock Mode Does:**
- Detects audio via RMS calculation
- Generates fake transcripts like: `"[MOCK] Audio detected (level: 0.15)"`
- Useful for:
  - UI development
  - Testing audio capture
  - Demonstrating without Whisper setup

**How to Disable Mock Mode:**
- Install Whisper.cpp as described above
- The system will automatically detect the binary and switch to real transcription

---

## Production Checklist

Before deploying to BPO:

- [ ] Whisper.cpp compiled for Windows
- [ ] `ggml-small.bin` model downloaded
- [ ] Tested with South African accent samples (Gauteng, Western Cape, KZN)
- [ ] Transcription accuracy >95%
- [ ] Latency <400ms average
- [ ] Tested with 80-100 calls/day load
- [ ] Error handling verified (connection drops, audio glitches)
- [ ] Logging configured for troubleshooting

---

## Alternative: Cloud API

If local Whisper proves challenging, consider cloud alternatives:

**Whisper API (OpenAI)**
- Pros: No local setup, excellent accuracy
- Cons: Requires internet, costs per minute, privacy concerns

**Deepgram**
- Pros: Real-time streaming, good SA accent support
- Cons: Costs, requires internet

**Assembly AI**
- Pros: Good documentation, real-time
- Cons: Costs, privacy concerns

For BPO environments with strict data residency requirements, **local Whisper.cpp is strongly recommended**.

---

## References

- Whisper.cpp GitHub: https://github.com/ggerganov/whisper.cpp
- OpenAI Whisper Paper: https://arxiv.org/abs/2212.04356
- Model comparisons: https://github.com/ggerganov/whisper.cpp#available-models

---

**Last Updated:** 2026-01-24
**Status:** Mock mode active, real Whisper.cpp integration ready for testing
