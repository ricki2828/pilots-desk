# Whisper.cpp SA Accent Testing Plan

**Created**: 2026-01-24
**Status**: Audio samples ready, awaiting Whisper setup
**SA Audio Samples**: 5 samples downloaded (see SA_SAMPLES_SOURCED.md)

---

## Executive Summary

This document provides a complete testing plan for validating Whisper.cpp accuracy with South African accents before deploying to production. All SA audio samples have been sourced and are ready for testing.

**Prerequisites**: ✅ Complete
- [x] SA accent audio samples sourced (5 samples from IDEA)
- [x] Test audio directory created
- [x] Testing documentation prepared

**Next Steps**: Install Whisper.cpp and execute tests

---

## Quick Start: Whisper.cpp Installation

### Option A: Use Pre-built Binaries (RECOMMENDED - Fastest)

1. **Download pre-built Linux binary**:
```bash
# Download from whisper.cpp_binaries repo
cd /home/ricki28/pilots-desk
wget https://github.com/dscripka/whisper.cpp_binaries/releases/download/latest/whisper-linux-x64.zip
unzip whisper-linux-x64.zip
mv main src-tauri/sidecars/whisper
chmod +x src-tauri/sidecars/whisper
```

2. **Download Whisper small model**:
```bash
cd /home/ricki28/pilots-desk/whisper.cpp
bash ./models/download-ggml-model.sh small
cp models/ggml-small.bin ../models/
```

### Option B: Build from Source (if pre-built doesn't work)

If you have a Windows machine or can install cmake:

```bash
cd /home/ricki28/pilots-desk/whisper.cpp

# Install cmake first (requires sudo)
# sudo apt-get install cmake

# Build
cmake -B build
cmake --build build --config Release

# Copy binary
cp build/bin/main ../src-tauri/sidecars/whisper
chmod +x ../src-tauri/sidecars/whisper

# Download model
bash ./models/download-ggml-model.sh small
cp models/ggml-small.bin ../models/
```

### Option C: Use Python Whisper (for initial testing only)

```bash
# If pip/pipx is available
pipx install openai-whisper
```

---

## Test Execution

### Phase 1: Basic Transcription Test

**Objective**: Verify Whisper can transcribe SA audio samples

```bash
#!/bin/bash
# test_whisper_basic.sh

WHISPER="/home/ricki28/pilots-desk/src-tauri/sidecars/whisper"
MODEL="/home/ricki28/pilots-desk/models/ggml-small.bin"
TEST_DIR="/home/ricki28/pilots-desk/tauri-client/test_audio"

echo "=== Whisper.cpp SA Accent Basic Test ==="
echo ""

for audio in "$TEST_DIR"/sa_sample_*.mp3; do
    filename=$(basename "$audio")
    echo "Testing: $filename"

    # Run Whisper
    $WHISPER -m "$MODEL" -f "$audio" -otxt --language en

    echo "---"
done

echo "Test complete!"
```

**Expected Output**:
- Transcripts saved as `.txt` files next to audio files
- Review manually for accuracy

### Phase 2: Accuracy Measurement (WER Calculation)

**Objective**: Calculate Word Error Rate (WER) for each sample

**Steps**:
1. Listen to each audio file
2. Manually transcribe 60-120 seconds (ground truth)
3. Compare with Whisper output
4. Calculate WER

**Manual Transcription Template**:

Create `ground_truth.json`:
```json
{
  "sa_sample_johannesburg.mp3": {
    "speaker": "Female, Johannesburg, bilingual",
    "duration_seconds": 90,
    "ground_truth": "Type the exact transcript here after listening..."
  },
  "sa_sample_cape_town.mp3": {
    "speaker": "Female, 31, Cape Town, speech teacher",
    "duration_seconds": 90,
    "ground_truth": "Type the exact transcript here..."
  }
  // ... add for all 5 samples
}
```

**WER Calculation Script**:

Create `calculate_wer.py`:
```python
#!/usr/bin/env python3
"""
Calculate Word Error Rate for Whisper transcriptions
"""

import json
import re
from pathlib import Path

def normalize_text(text):
    """Normalize text for comparison"""
    text = text.lower()
    text = re.sub(r'[^\w\s]', '', text)  # Remove punctuation
    text = re.sub(r'\s+', ' ', text).strip()  # Normalize whitespace
    return text

def calculate_wer(reference, hypothesis):
    """
    Calculate Word Error Rate (WER)
    WER = (S + D + I) / N
    where:
      S = number of substitutions
      D = number of deletions
      I = number of insertions
      N = number of words in reference
    """
    ref_words = normalize_text(reference).split()
    hyp_words = normalize_text(hypothesis).split()

    # Use Levenshtein distance at word level
    d = [[0] * (len(hyp_words) + 1) for _ in range(len(ref_words) + 1)]

    for i in range(len(ref_words) + 1):
        d[i][0] = i
    for j in range(len(hyp_words) + 1):
        d[0][j] = j

    for i in range(1, len(ref_words) + 1):
        for j in range(1, len(hyp_words) + 1):
            if ref_words[i-1] == hyp_words[j-1]:
                d[i][j] = d[i-1][j-1]
            else:
                substitution = d[i-1][j-1] + 1
                insertion = d[i][j-1] + 1
                deletion = d[i-1][j] + 1
                d[i][j] = min(substitution, insertion, deletion)

    # WER = edit distance / reference length
    wer = (d[len(ref_words)][len(hyp_words)] / len(ref_words)) * 100
    return wer

def main():
    test_dir = Path("/home/ricki28/pilots-desk/tauri-client/test_audio")

    # Load ground truth
    with open(test_dir / "ground_truth.json") as f:
        ground_truth = json.load(f)

    results = []
    total_wer = 0
    count = 0

    print("=" * 70)
    print("WHISPER.CPP SA ACCENT WER ANALYSIS")
    print("=" * 70)
    print("")

    for filename, data in ground_truth.items():
        audio_file = test_dir / filename
        transcript_file = audio_file.with_suffix('.txt')

        if not transcript_file.exists():
            print(f"⚠️  {filename}: Transcript not found, skipping")
            continue

        # Read Whisper output
        with open(transcript_file) as f:
            hypothesis = f.read().strip()

        # Calculate WER
        wer = calculate_wer(data['ground_truth'], hypothesis)
        total_wer += wer
        count += 1

        # Print results
        print(f"File: {filename}")
        print(f"Speaker: {data['speaker']}")
        print(f"WER: {wer:.2f}%")

        if wer < 10:
            status = "✅ EXCELLENT"
        elif wer < 15:
            status = "✅ GOOD"
        elif wer < 20:
            status = "⚠️  ACCEPTABLE"
        else:
            status = "❌ POOR"

        print(f"Status: {status}")
        print("")
        print(f"Ground Truth ({len(data['ground_truth'])} chars):")
        print(f"  {data['ground_truth'][:100]}...")
        print("")
        print(f"Whisper Output ({len(hypothesis)} chars):")
        print(f"  {hypothesis[:100]}...")
        print("")
        print("-" * 70)
        print("")

        results.append({
            "filename": filename,
            "speaker": data['speaker'],
            "wer": wer,
            "status": status
        })

    # Summary
    avg_wer = total_wer / count if count > 0 else 0

    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Samples tested: {count}")
    print(f"Average WER: {avg_wer:.2f}%")
    print("")

    if avg_wer < 10:
        print("✅ EXCELLENT - Production ready")
        print("Whisper small model performs excellently with SA accents")
    elif avg_wer < 15:
        print("✅ GOOD - Acceptable for production")
        print("Whisper small model is suitable for deployment")
    elif avg_wer < 20:
        print("⚠️  ACCEPTABLE - Consider improvements")
        print("Recommendation: Test with Whisper medium model")
    else:
        print("❌ POOR - Not ready for production")
        print("Recommendation:")
        print("  1. Try Whisper medium model")
        print("  2. Check audio quality (16kHz mono)")
        print("  3. Consider fine-tuning or alternative STT")

    print("")

    # Save results
    with open(test_dir / "wer_results.json", 'w') as f:
        json.dump({
            "summary": {
                "average_wer": avg_wer,
                "samples_tested": count,
                "timestamp": "2026-01-24"
            },
            "results": results
        }, f, indent=2)

    print(f"Results saved to: {test_dir / 'wer_results.json'}")

if __name__ == "__main__":
    main()
```

### Phase 3: Accent-Specific Analysis

**Objective**: Identify specific pronunciation patterns Whisper handles well/poorly

**Focus Areas**:
1. **Vowel shifts**: SA "i" sounds (e.g., "like" → "laik")
2. **R pronunciation**: Hard rolling Rs vs soft Rs
3. **Afrikaans loanwords**: "braai", "ag", "eish"
4. **Code-switching**: English/Afrikaans mixing
5. **Diphthongs**: "ou" sounds, "ai" sounds
6. **Consonant clusters**: "thr", "str" pronunciation

**Analysis Template**:

Create `accent_analysis.md`:
```markdown
# SA Accent Analysis Results

## Johannesburg Sample (Female)
- **Overall WER**: X.XX%
- **Strengths**: [What Whisper handled well]
- **Weaknesses**: [What Whisper missed/mistranscribed]
- **Example errors**:
  - Said: "like" → Transcribed: "laik" ❌ (acceptable SA pronunciation)
  - Said: "braai" → Transcribed: "bry" ❌ (Afrikaans word)

## Cape Town Sample (Female)
...

## Recommendations
[Based on findings, suggest adjustments]
```

### Phase 4: Sky TV Vocabulary Test (Custom Audio)

**Objective**: Test Whisper with sales-specific terminology

**Method**:
1. Generate TTS audio with Sky TV sales pitch (SA accent)
2. Test Whisper transcription accuracy
3. Verify critical terms transcribed correctly

**Critical Sky TV Terms**:
- "Sky Sport"
- "Sky Movies"
- "SoHo"
- "twenty nine ninety nine" (pricing)
- "promotional offer"
- "rugby", "cricket", "football"
- "installation"
- "contract terms"

**TTS Generation**:
Use [VOBOX](https://vobox.io/text-to-speech-voices/south-african-english-voiceover) or [TTSFree](https://ttsfree.com/text-to-speech/english-south-africa)

**Test Script**:
```
Hi, this is Sarah calling from Sky TV New Zealand. We have a special promotion
on our Sky Sport package this month. It includes all rugby, cricket, and football
coverage for only twenty nine dollars ninety nine per month. The Sky Movies
package is also available, featuring SoHo and premium channels. Would you be
interested in signing up today? I'll need your email address to send you the
installation details. Can I confirm your contact number as well?
```

Expected output should correctly transcribe:
- ✅ "Sky TV" (not "Skype TV")
- ✅ "Sky Sport" (not "Sky sports")
- ✅ "SoHo" (not "Soho", "So-ho")
- ✅ "twenty nine dollars ninety nine" (not "2999", "$29.99")

### Phase 5: Performance Benchmarking

**Objective**: Measure transcription latency

```bash
#!/bin/bash
# benchmark_whisper.sh

WHISPER="/home/ricki28/pilots-desk/src-tauri/sidecars/whisper"
MODEL="/home/ricki28/pilots-desk/models/ggml-small.bin"
TEST_AUDIO="/home/ricki28/pilots-desk/tauri-client/test_audio/sa_sample_johannesburg.mp3"

echo "=== Whisper Performance Benchmark ==="
echo ""

# Run 5 times and average
total_time=0
runs=5

for i in $(seq 1 $runs); do
    echo "Run $i..."
    start_time=$(date +%s.%N)

    $WHISPER -m "$MODEL" -f "$TEST_AUDIO" -otxt --language en > /dev/null 2>&1

    end_time=$(date +%s.%N)
    elapsed=$(echo "$end_time - $start_time" | bc)
    total_time=$(echo "$total_time + $elapsed" | bc)

    echo "  Time: ${elapsed}s"
done

avg_time=$(echo "scale=2; $total_time / $runs" | bc)

echo ""
echo "Average time: ${avg_time}s"
echo ""

# Calculate real-time factor
# Assuming ~90 second audio sample
audio_duration=90
rtf=$(echo "scale=2; $avg_time / $audio_duration" | bc)

echo "Real-time factor: ${rtf}x"
echo ""

if (( $(echo "$avg_time < 10" | bc -l) )); then
    echo "✅ EXCELLENT - Fast enough for production"
elif (( $(echo "$avg_time < 20" | bc -l) )); then
    echo "✅ GOOD - Acceptable latency"
else
    echo "⚠️  SLOW - Consider optimization"
    echo "  - Try GPU acceleration"
    echo "  - Increase CPU threads"
    echo "  - Use 'tiny' or 'base' model"
fi
```

**Target Metrics**:
- **Latency**: <10 seconds for 90-second audio (RTF < 0.11x)
- **Memory**: <500 MB
- **CPU**: <50% (on 4-core system)

---

## Success Criteria

### Must Have (MVP)
- [x] SA audio samples sourced (5+ samples) ✅
- [ ] Whisper.cpp installed and functional
- [ ] Average WER <15% across all samples
- [ ] Critical Sky TV terms transcribed correctly
- [ ] Latency <10 seconds per minute of audio

### Nice to Have
- [ ] WER <10% (excellent)
- [ ] Test with 10+ SA samples (more coverage)
- [ ] GPU acceleration configured
- [ ] Streaming mode tested

---

## Next Steps After Testing

**If Tests Pass** (WER <15%):
1. Integrate Whisper.cpp into Tauri app
2. Replace mock transcription mode
3. Build Windows installer with Whisper binary
4. Deploy to CoSauce server
5. Run end-to-end integration test

**If Tests Fail** (WER >15%):
1. Try Whisper medium model (better accuracy, slower)
2. Test with more diverse SA audio samples
3. Analyze specific failure patterns
4. Consider alternative STT (Deepgram, AssemblyAI)
5. Document findings and recommendation

---

## Resources

**Audio Samples**:
- [IDEA South Africa Archive](https://www.dialectsarchive.com/south-africa) - 53 SA samples
- [OpenSLR SA Corpus](https://www.openslr.org/32/) - Large dataset (950MB)

**Whisper.cpp**:
- [GitHub Repository](https://github.com/ggml-org/whisper.cpp)
- [Pre-built Binaries](https://github.com/dscripka/whisper.cpp_binaries)
- [Model Download](https://github.com/ggml-org/whisper.cpp/tree/master/models)

**TTS for Testing**:
- [VOBOX SA English TTS](https://vobox.io/text-to-speech-voices/south-african-english-voiceover)
- [TTSFree SA TTS](https://ttsfree.com/text-to-speech/english-south-africa)

**WER Calculation**:
- [jiwer Python library](https://github.com/jitsi/jiwer) - Professional WER calculation

---

## Troubleshooting

### Whisper not found
```bash
ls -la /home/ricki28/pilots-desk/src-tauri/sidecars/whisper
chmod +x /home/ricki28/pilots-desk/src-tauri/sidecars/whisper
```

### Model not found
```bash
ls -la /home/ricki28/pilots-desk/models/ggml-small.bin
# Re-download if missing:
cd /home/ricki28/pilots-desk/whisper.cpp
bash ./models/download-ggml-model.sh small
cp models/ggml-small.bin ../models/
```

### Poor accuracy (WER >20%)
1. Check audio quality:
   ```bash
   ffprobe sa_sample_johannesburg.mp3
   # Should be: 16kHz, mono (or will be converted by Whisper)
   ```
2. Try medium model:
   ```bash
   bash ./models/download-ggml-model.sh medium
   cp models/ggml-medium.bin ../models/
   # Update test scripts to use ggml-medium.bin
   ```
3. Verify language setting:
   ```bash
   # Ensure --language en is specified
   ```

---

**Created**: 2026-01-24
**Last Updated**: 2026-01-24
**Status**: Ready for execution once Whisper.cpp is installed
**Blocking Issue**: cmake not available on server (need Windows machine or different approach)

---

## Alternative: Test with Online Whisper API (Quick Validation)

If local Whisper setup is challenging, you can quickly validate SA accent accuracy using OpenAI's Whisper API:

```python
import openai

openai.api_key = "YOUR_API_KEY"

audio_file = open("/home/ricki28/pilots-desk/tauri-client/test_audio/sa_sample_johannesburg.mp3", "rb")
transcript = openai.Audio.transcribe("whisper-1", audio_file, language="en")

print(transcript['text'])
```

This gives you immediate feedback on whether Whisper can handle SA accents, before investing time in local setup.
