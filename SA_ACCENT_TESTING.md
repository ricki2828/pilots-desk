# South African Accent Testing Plan

Testing Whisper.cpp transcription accuracy with South African English accents.

## Objective

Validate that Whisper small model can accurately transcribe South African agents speaking English (both Gauteng/Johannesburg and Western Cape/Cape Town accents) before deploying to production.

---

## SA Accent Audio Sources

### Option 1: YouTube Audio Extraction (RECOMMENDED)

**South African Call Center Training Videos**:
1. Search: "South African call center training"
2. Search: "SA customer service agent"
3. Search: "South African telesales"

**SA News/Interviews**:
1. SABC News interviews (clear English, professional context)
2. eNCA news anchors and reporters
3. SA business interviews

**How to Download**:
```bash
# Install yt-dlp (better than youtube-dl)
pip install yt-dlp

# Download audio only (best quality)
yt-dlp -x --audio-format wav "https://youtube.com/watch?v=VIDEO_ID"

# Or download and convert to 16kHz mono (Whisper optimal)
yt-dlp -x --audio-format wav --postprocessor-args "ffmpeg:-ar 16000 -ac 1" "URL"
```

**Recommended Videos** (search these on YouTube):
- "South African accent examples" - Linguistic channels
- "SA English pronunciation" - Educational content
- "Johannesburg vs Cape Town accent" - Comparison videos

### Option 2: Mozilla Common Voice Dataset

**URL**: https://commonvoice.mozilla.org/en/datasets

**Steps**:
1. Download the dataset (English)
2. Filter for South African speakers (metadata includes country)
3. Extract SA-only clips

**Pros**:
- Free, open license
- Validated transcripts included
- Multiple speakers

**Cons**:
- Large download (~30GB for full English set)
- Need to filter for SA speakers
- Mostly read text (not natural conversation)

### Option 3: OpenSLR South African English Speech Corpus

**URL**: https://www.openslr.org/32/

**Description**:
- SLR32: South African English speech corpus
- Multiple speakers
- Read speech
- Free for research

**Download**:
```bash
wget https://www.openslr.org/resources/32/za_english.tar.gz
tar -xzf za_english.tar.gz
```

### Option 4: VoxLingua107 (Multi-language)

Includes South African English samples in multi-accent dataset.

### Option 5: Record Our Own (If Needed)

**Fiverr/Upwork**:
- Hire SA voice actor for $20-50
- Request: "Record 10 minutes of natural conversation, South African English accent"
- Specify: Sales/call center context phrases
- Get both Gauteng and Cape Town accents

---

## Test Audio Requirements

### What We Need

**Accent Varieties** (Priority Order):
1. **Gauteng/Johannesburg** (most common in call centers)
2. **Western Cape/Cape Town** (distinct accent)
3. **KwaZulu-Natal/Durban** (if available)

**Content Type**:
1. **Conversational speech** (not read text) - IDEAL
2. **Sales/customer service context** - BEST
3. **Clear audio** (no background noise) - REQUIRED
4. **Multiple speakers** - GOOD TO HAVE

**Audio Specs**:
- Format: WAV
- Sample rate: 16kHz (Whisper optimal)
- Channels: Mono
- Duration: 5-10 minutes total (across multiple clips)
- Quality: Clean, minimal background noise

---

## Testing Methodology

### Phase 1: Baseline Accuracy Test

**Goal**: Measure Whisper small model accuracy with SA accents

**Steps**:
1. Get 10 audio clips (1-2 min each) with known transcripts
2. Run through Whisper small
3. Compare output to ground truth
4. Calculate Word Error Rate (WER)

**Metrics**:
- Word Error Rate (WER): (Substitutions + Deletions + Insertions) / Total Words
- **Target**: WER < 10% (industry standard for good transcription)
- **Acceptable**: WER < 15% (still usable with some errors)
- **Concerning**: WER > 20% (may need different model)

### Phase 2: Sky TV Context Test

**Goal**: Test with sales pitch vocabulary

**Test Phrases** (have someone say these with SA accent):
1. "Hi, this is Sarah calling from Sky TV New Zealand"
2. "We have a special promotion on our Sky Sport package"
3. "It includes all rugby, cricket, and football coverage"
4. "The package is only $29.99 per month"
5. "Would you be interested in signing up today?"
6. "I'll need your credit card details to complete the order"
7. "Can I confirm your email address is john@example.com?"
8. "The installation will be scheduled within 48 hours"

**Focus Areas**:
- Sky TV brand names (Sky Sport, SoHo, etc.)
- Pricing mentions
- New Zealand place names (if mentioned)
- Common sales phrases

### Phase 3: Real-World Simulation

**Goal**: Test actual call flow

**Scenario**:
1. Use SA audio clip for agent speech
2. Use NZ accent audio for customer responses
3. Run through script navigation
4. Verify:
   - Script follows agent correctly
   - Keywords detected accurately
   - Node transitions work
   - Compliance phrases recognized

---

## Whisper Model Selection

### Models to Test

1. **Whisper Small** (DEFAULT)
   - Size: ~500MB
   - Speed: ~10x real-time (6 seconds for 1 minute audio)
   - Accuracy: Good for most accents
   - **Recommended for production**

2. **Whisper Base** (FALLBACK if Small struggles)
   - Size: ~150MB
   - Speed: ~15x real-time (4 seconds for 1 minute audio)
   - Accuracy: Slightly lower but faster

3. **Whisper Medium** (UPGRADE if needed)
   - Size: ~1.5GB
   - Speed: ~5x real-time (12 seconds for 1 minute audio)
   - Accuracy: Better, especially with accents
   - **Use only if Small model WER > 15%**

### Expected Performance

**Based on Whisper research**:
- Whisper is trained on diverse accents including South African
- Expected WER for SA English: 8-12% (good)
- Handles code-switching (English + Afrikaans words) reasonably well

**If WER is high (>15%)**:
1. Try Whisper Medium model
2. Consider fine-tuning on SA call center data (future)
3. Implement confidence scores (reject low-confidence segments)

---

## Testing Scripts

### 1. Download Test Audio

**File**: `tauri-client/test_audio/download_sa_audio.sh`

```bash
#!/bin/bash

# Create test audio directory
mkdir -p test_audio/sa_samples

# Example: Download from YouTube (replace with actual URLs)
# yt-dlp -x --audio-format wav --postprocessor-args "ffmpeg:-ar 16000 -ac 1" \
#   -o "test_audio/sa_samples/%(title)s.%(ext)s" \
#   "YOUTUBE_URL_HERE"

echo "Download SA accent audio samples and place in test_audio/sa_samples/"
echo "Ensure files are:"
echo "  - WAV format"
echo "  - 16kHz sample rate"
echo "  - Mono channel"
echo "  - 1-2 minutes duration each"
```

### 2. Test Whisper Accuracy

**File**: `tauri-client/test_audio/test_whisper.py`

```python
#!/usr/bin/env python3
"""
Test Whisper transcription accuracy with SA accent audio samples
"""

import subprocess
import os
import glob
from pathlib import Path
import json

# Ground truth transcripts (manually transcribe small samples)
GROUND_TRUTH = {
    "sample1.wav": "The text that should be transcribed",
    "sample2.wav": "Another sample transcript",
    # Add more as you create samples
}

def transcribe_with_whisper(audio_file, model="small"):
    """Run Whisper.cpp on audio file"""
    # Assuming whisper.cpp is compiled and in PATH
    cmd = [
        "./whisper-small",  # Whisper executable
        "-m", "models/ggml-small.bin",  # Model file
        "-f", audio_file,  # Input audio
        "-otxt",  # Output text
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    # Parse output (whisper.cpp saves to file)
    output_file = audio_file.replace(".wav", ".txt")
    if os.path.exists(output_file):
        with open(output_file, 'r') as f:
            return f.read().strip()

    return result.stdout.strip()

def calculate_wer(reference, hypothesis):
    """Calculate Word Error Rate"""
    ref_words = reference.lower().split()
    hyp_words = hypothesis.lower().split()

    # Simple WER calculation (Levenshtein distance at word level)
    # For production, use jiwer library: pip install jiwer

    # Placeholder - implement proper WER calculation
    from difflib import SequenceMatcher
    similarity = SequenceMatcher(None, ref_words, hyp_words).ratio()
    wer = (1 - similarity) * 100

    return wer

def main():
    audio_dir = "test_audio/sa_samples"
    audio_files = glob.glob(f"{audio_dir}/*.wav")

    if not audio_files:
        print(f"No WAV files found in {audio_dir}")
        print("Please download SA accent audio samples first")
        return

    print("Testing Whisper with SA accent audio samples...")
    print("=" * 60)

    total_wer = 0
    results = []

    for audio_file in audio_files:
        filename = os.path.basename(audio_file)
        print(f"\nProcessing: {filename}")

        # Transcribe
        transcript = transcribe_with_whisper(audio_file)
        print(f"Transcript: {transcript[:100]}...")

        # Calculate WER if ground truth available
        if filename in GROUND_TRUTH:
            ground_truth = GROUND_TRUTH[filename]
            wer = calculate_wer(ground_truth, transcript)
            total_wer += wer

            print(f"Ground Truth: {ground_truth[:100]}...")
            print(f"WER: {wer:.2f}%")

            results.append({
                "file": filename,
                "transcript": transcript,
                "ground_truth": ground_truth,
                "wer": wer
            })
        else:
            print("(No ground truth - manual verification needed)")
            results.append({
                "file": filename,
                "transcript": transcript,
                "wer": None
            })

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    if results:
        wer_results = [r for r in results if r['wer'] is not None]
        if wer_results:
            avg_wer = sum(r['wer'] for r in wer_results) / len(wer_results)
            print(f"Average WER: {avg_wer:.2f}%")

            if avg_wer < 10:
                print("✅ EXCELLENT - Production ready")
            elif avg_wer < 15:
                print("✅ GOOD - Acceptable for production")
            elif avg_wer < 20:
                print("⚠️  ACCEPTABLE - May need tuning")
            else:
                print("❌ POOR - Consider Whisper Medium or fine-tuning")

    # Save results
    with open("whisper_test_results.json", 'w') as f:
        json.dump(results, f, indent=2)

    print(f"\nResults saved to: whisper_test_results.json")

if __name__ == "__main__":
    main()
```

---

## Quick Start Guide

### Step 1: Get Audio Samples (Choose One)

**Option A: YouTube (Fastest)**
```bash
# Install yt-dlp
pip install yt-dlp

# Download a SA interview/call center video
yt-dlp -x --audio-format wav --postprocessor-args "ffmpeg:-ar 16000 -ac 1" \
  -o "test_audio/sa_samples/%(title)s.%(ext)s" \
  "YOUTUBE_URL_HERE"
```

**Option B: OpenSLR Dataset**
```bash
cd tauri-client
mkdir -p test_audio/sa_samples
wget https://www.openslr.org/resources/32/za_english.tar.gz
tar -xzf za_english.tar.gz -C test_audio/sa_samples/
```

**Option C: I'll help you find URLs**
- I can search for specific SA accent videos
- Point you to ready-made datasets
- Help extract audio

### Step 2: Compile Whisper.cpp (if not done)

```bash
cd tauri-client/src-tauri
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp

# Build for your platform
make

# Download Whisper small model
bash ./models/download-ggml-model.sh small

# Test it works
./main -m models/ggml-small.bin -f /path/to/test/audio.wav
```

### Step 3: Run Test Script

```bash
cd tauri-client
python test_audio/test_whisper.py
```

### Step 4: Analyze Results

- Check WER scores
- Listen to audio + read transcripts
- Identify problem areas (specific words, phrases)
- Decide if accuracy is acceptable

---

## Expected Timeline

**Day 1** (Today):
- [ ] Source 3-5 SA accent audio clips (YouTube)
- [ ] Convert to WAV 16kHz mono
- [ ] Create ground truth transcripts (manually type out what's said)

**Day 2**:
- [ ] Compile Whisper.cpp with small model
- [ ] Run test script on audio samples
- [ ] Calculate WER scores
- [ ] Document results

**Day 3**:
- [ ] If WER good (<15%): Integrate into Tauri app
- [ ] If WER poor (>15%): Test with Medium model or get more diverse samples
- [ ] Test end-to-end with script navigation

---

## Success Criteria

✅ **PASS**: Average WER < 15% across 5+ diverse SA accent clips
✅ **PASS**: Sky TV vocabulary transcribed correctly (Sport, SoHo, pricing)
✅ **PASS**: Transcription latency < 400ms (10x real-time for Whisper small)

❌ **FAIL**: Average WER > 20%
❌ **FAIL**: Consistent errors on key sales terms
❌ **FAIL**: Latency > 1 second

---

## Next Steps After Testing

**If Tests Pass**:
1. Replace mock Whisper in Tauri app
2. Build Windows installer with real Whisper
3. Test end-to-end integration
4. Deploy to CoSauce server

**If Tests Fail**:
1. Try Whisper Medium model
2. Test with more audio samples
3. Consider fine-tuning (advanced)
4. Evaluate alternative STT (Deepgram, AssemblyAI with SA accent support)

---

## Resources

**Whisper.cpp**:
- GitHub: https://github.com/ggerganov/whisper.cpp
- Models: https://github.com/ggerganov/whisper.cpp/tree/master/models

**Datasets**:
- OpenSLR SA English: https://www.openslr.org/32/
- Mozilla Common Voice: https://commonvoice.mozilla.org/

**WER Calculation**:
- jiwer library: `pip install jiwer`

**Audio Processing**:
- FFmpeg: Convert audio formats
- SoX: Audio manipulation
- Audacity: Manual audio editing

---

**Created**: 2026-01-24
**Status**: Ready to start testing
**Next**: Source SA accent audio samples
