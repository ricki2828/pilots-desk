# South African Accent Audio Samples - SOURCED

**Status**: ✅ Successfully sourced 5 SA accent audio samples
**Source**: IDEA (International Dialects of English Archive)
**License**: Free for research/testing (credit required)
**Format**: MP3 (Whisper.cpp accepts MP3 directly)
**Total Duration**: ~20 minutes

---

## Downloaded Samples

All samples are located in: `/home/ricki28/pilots-desk/tauri-client/test_audio/`

### Sample 1: Johannesburg (Female)
- **File**: `sa_sample_johannesburg.mp3`
- **Size**: 1.6M
- **Speaker**: Female, rural SA near Johannesburg
- **Background**: Bilingual (Afrikaans/English), learned English at age 5
- **URL**: https://www.dialectsarchive.com/south-africa-1
- **Direct Download**: https://www.dialectsarchive.com/wp-content/uploads/2011/08/southafrica1.mp3

### Sample 2: Cape Town (Female)
- **File**: `sa_sample_cape_town.mp3`
- **Size**: 1.7M
- **Speaker**: Female, 31, speech and voice teacher from Cape Town
- **Background**: Discusses SA dialects and accents
- **URL**: https://www.dialectsarchive.com/south-africa-7
- **Direct Download**: https://www.dialectsarchive.com/wp-content/uploads/2011/08/southafrica7.mp3

### Sample 3: Pretoria (Male)
- **File**: `sa_sample_pretoria.mp3`
- **Size**: 1.4M
- **Speaker**: Male, 18, Zulu background, Pretoria
- **Background**: Film student, discusses education and aspirations
- **URL**: https://www.dialectsarchive.com/south-africa-3
- **Direct Download**: https://www.dialectsarchive.com/wp-content/uploads/2011/08/southafrica3.mp3

### Sample 4: Germiston (Male)
- **File**: `sa_sample_male_germiston.mp3`
- **Size**: 1.5M
- **Speaker**: Male, 22, White English SA, Germiston
- **URL**: https://www.dialectsarchive.com/south-africa-4
- **Direct Download**: https://www.dialectsarchive.com/wp-content/uploads/2011/08/southafrica4.mp3

### Sample 5: Johannesburg (Male)
- **File**: `sa_sample_male_johannesburg.mp3`
- **Size**: 1.5M
- **Speaker**: Male, 18, Black, Johannesburg
- **URL**: https://www.dialectsarchive.com/south-africa-5
- **Direct Download**: https://www.dialectsarchive.com/wp-content/uploads/2011/08/southafrica5.mp3

---

## Coverage Analysis

**Regional Coverage**:
- ✅ Johannesburg/Gauteng (3 samples)
- ✅ Cape Town/Western Cape (1 sample)
- ✅ Pretoria (1 sample)
- ❌ KwaZulu-Natal/Durban (not yet - can add more)

**Demographic Coverage**:
- ✅ Male speakers (3 samples)
- ✅ Female speakers (2 samples)
- ✅ White SA English (2+ samples)
- ✅ Black SA English (2+ samples)
- ✅ Zulu background (1 sample)
- ✅ Afrikaans/English bilingual (1 sample)

**Age Range**:
- 18-22 years old (3 samples)
- 31 years old (1 sample)
- Unknown age (1 sample)

---

## Additional Samples Available

The IDEA archive has 53 total South African samples. Here are more we can download if needed:

**More Regional Variety**:
- SA 6: Vereeniging (Female, White)
- SA 8: Meadowlands (Female, 17, Zulu)
- SA 9: Cape/Natal (Female, 36, White)
- SA 10: Kuils River (Female, 20, Coloured)
- SA 12: Clanwilliam (Female, 21, Black)
- SA 13: Paarl (Female, 20, Black)
- SA 14: Pretoria (Male, 37, White)

**Direct Download Pattern**:
```
https://www.dialectsarchive.com/wp-content/uploads/2011/08/southafrica{N}.mp3
```
Where {N} is the sample number (1-53, excluding 15)

---

## Next Steps

### 1. Compile Whisper.cpp (if not done)

```bash
cd /home/ricki28/pilots-desk/tauri-client/src-tauri
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp

# Build
make

# Download Whisper small model
bash ./models/download-ggml-model.sh small
```

### 2. Test Transcription Accuracy

Create simple test script:

```bash
#!/bin/bash
# test_whisper_sa.sh

WHISPER_BIN="./src-tauri/whisper.cpp/main"
WHISPER_MODEL="./src-tauri/whisper.cpp/models/ggml-small.bin"
TEST_DIR="./test_audio"

echo "Testing Whisper with SA accent samples..."
echo "=========================================="

for audio in $TEST_DIR/sa_sample_*.mp3; do
    filename=$(basename "$audio")
    echo ""
    echo "Testing: $filename"
    echo "---"

    # Run Whisper
    $WHISPER_BIN -m $WHISPER_MODEL -f "$audio" -otxt

    # Display transcript
    transcript_file="${audio%.mp3}.txt"
    if [ -f "$transcript_file" ]; then
        cat "$transcript_file"
    fi

    echo ""
done

echo "=========================================="
echo "Testing complete!"
```

### 3. Manual Verification (Initial)

Since we don't have ground truth transcripts yet, we'll:
1. Listen to each audio sample
2. Manually transcribe 30-60 seconds from each
3. Compare with Whisper output
4. Calculate approximate WER

### 4. Accent-Specific Analysis

Listen for how Whisper handles:
- SA pronunciation of vowels (e.g., "like" vs "laik")
- Hard "R" sounds (especially Cape accents)
- Afrikaans loanwords
- Rapid speech patterns
- Code-switching (English/Afrikaans)

---

## Expected Results

Based on Whisper research:
- **Target WER**: <15% (acceptable for production)
- **Ideal WER**: <10% (excellent)
- **Concerning WER**: >20% (consider Whisper Medium model)

**Known Strengths**:
- Whisper handles diverse accents well
- Trained on multilingual data including SA English
- Good with code-switching

**Potential Issues**:
- Afrikaans words pronounced in English context
- Very strong regional accents (rural speakers)
- Rapid conversational speech

---

## Alternative TTS Option (If Needed)

If you want to generate custom SA accent audio for specific sales phrases:

**Recommended Services**:
1. **VOBOX** (https://vobox.io/text-to-speech-voices/south-african-english-voiceover)
   - Downloadable as WAV/MP3
   - Multiple SA voices
   - Free tier available

2. **TTSFree** (https://ttsfree.com/text-to-speech/english-south-africa)
   - Instant generation
   - No signup required
   - Good for Sky TV sales pitch testing

**Sky TV Test Script**:
```
Hi, this is Sarah calling from Sky TV New Zealand. We have a special promotion
on our Sky Sport package this month. It includes all rugby, cricket, and football
coverage for only twenty nine dollars ninety nine per month. Would you be
interested in signing up today? I'll need your email address to send you the
details. Can I confirm your contact number as well?
```

---

## Citation

When using these samples, credit as:
> Audio samples from IDEA: International Dialects of English Archive.
> https://www.dialectsarchive.com

---

**Created**: 2026-01-24
**Last Updated**: 2026-01-24
**Status**: Ready for Whisper testing
**Total Samples**: 5 (can expand to 53 if needed)
