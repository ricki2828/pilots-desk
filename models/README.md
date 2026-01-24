# Whisper Model Directory

This directory contains the Whisper speech-to-text model used by Pilot's Desk.

## Model Details

- **Model**: Whisper Small
- **File**: `ggml-small.bin`
- **Size**: ~466 MB
- **Source**: https://huggingface.co/ggerganov/whisper.cpp

## For Developers

### Local Development

The model file is **not committed to Git** due to its large size. To set up for local development:

```bash
# Download the model
curl -L -o models/ggml-small.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin

# Verify download (should be ~466 MB)
ls -lh models/ggml-small.bin
```

### GitHub Actions Build

GitHub Actions workflows automatically download the model during the build process. You don't need to do anything - just push your code and the CI will handle it.

## Model Performance

**Tested with South African accents**:
- Accuracy: ~95% (5-8% WER)
- Languages: English (all accents)
- Latency: ~200-400ms on modern CPUs

See `/home/ricki28/pilots-desk/SA_TESTING_STATUS.md` for detailed test results.

## Alternative Models

You can use different Whisper models by changing the download URL:

| Model | Size | WER | Speed | File |
|-------|------|-----|-------|------|
| Tiny | 75 MB | ~10% | 10x | ggml-tiny.bin |
| Base | 142 MB | ~8% | 7x | ggml-base.bin |
| **Small** | **466 MB** | **~6%** | **4x** | **ggml-small.bin** ⭐ |
| Medium | 1.5 GB | ~4% | 2x | ggml-medium.bin |
| Large | 2.9 GB | ~3% | 1x | ggml-large-v3.bin |

**Recommended**: Small (best balance of accuracy and speed for real-time transcription)

## Troubleshooting

### Model not found error

If you see "model not found" when building:

1. Check the file exists: `ls -lh models/ggml-small.bin`
2. Re-download: `rm models/ggml-small.bin && curl -L -o models/ggml-small.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin`
3. Verify size is ~466 MB (not a few KB HTML error page)

### Download fails

If the download fails, try:
- Using a different mirror: https://sourceforge.net/projects/whisper-cpp.mirror/
- Downloading manually and placing in `models/` directory
- Check your internet connection and firewall settings
