# GitHub Actions - Automated Windows Build Setup

**Status**: ✅ Ready to deploy
**Date**: 2026-01-24

---

## What's Been Set Up

I've created two GitHub Actions workflows that will automatically build the Windows installer in the cloud:

### 1. Release Build (`build-release.yml`)
- **Triggered by**: Creating a version tag (e.g., `v0.1.0`)
- **Runs on**: Windows Server (GitHub-hosted)
- **Outputs**:
  - Windows .msi installer (~475 MB)
  - Automatic GitHub Release with installer attached
- **Use for**: Production releases

### 2. Test Build (`build-test.yml`)
- **Triggered by**: Manual run from GitHub Actions tab
- **Runs on**: Windows Server (GitHub-hosted)
- **Outputs**: Windows .msi installer (retained for 7 days)
- **Use for**: Testing builds without creating a release

---

## How to Trigger Builds

### Option A: Create a Release (Recommended)

This creates a proper GitHub Release with the installer:

```bash
cd /home/ricki28/pilots-desk

# 1. Commit all changes
git add .
git commit -m "Release v0.1.0"

# 2. Create and push tag
git tag v0.1.0
git push origin master --tags

# 3. GitHub Actions will automatically:
#    - Build the Windows installer
#    - Create a GitHub Release
#    - Attach the .msi file to the release
```

**Result**:
- Release page: `https://github.com/ricki2828/pilots-desk/releases/tag/v0.1.0`
- Download installer: Click on the .msi file in the release assets

### Option B: Manual Test Build

For testing without creating a release:

1. **Push your code**:
   ```bash
   git add .
   git commit -m "Test build"
   git push origin master
   ```

2. **Trigger build manually**:
   - Go to: https://github.com/ricki2828/pilots-desk/actions
   - Click "Build Test (Manual)" workflow
   - Click "Run workflow" button
   - Select branch: `master`
   - Click "Run workflow"

3. **Download the artifact**:
   - Wait for build to complete (~15-20 minutes)
   - Click on the completed workflow run
   - Scroll to "Artifacts" section
   - Download `pilots-desk-test-build.zip`
   - Extract to get the .msi installer

---

## What Happens During Build

### Build Process (15-20 minutes)

1. **Setup** (2 mins):
   - Checkout code
   - Install Node.js 20
   - Install Rust toolchain
   - Cache dependencies

2. **Download Whisper Model** (1-2 mins):
   - Downloads `ggml-small.bin` (466 MB)
   - Verifies download succeeded

3. **Install Dependencies** (2-3 mins):
   - `npm install`
   - Rust cargo dependencies

4. **Build Frontend** (30 seconds):
   - TypeScript compilation
   - Vite production build
   - Output: `dist/` directory

5. **Build Tauri** (8-12 mins):
   - Compile Rust backend
   - Bundle Whisper binary + DLLs
   - Bundle Whisper model
   - Create .msi installer

6. **Upload Artifacts** (1-2 mins):
   - Upload .msi to GitHub
   - Create release (if tag-triggered)

### Build Output

**Windows Installer**:
- File: `Pilots.Desk_0.1.0_x64_en-US.msi`
- Size: ~475 MB
- Contains:
  - Pilot's Desk application
  - Whisper binary (whisper-x86_64-pc-windows-msvc.exe)
  - Required DLLs (ggml-*.dll, SDL2.dll)
  - Whisper model (ggml-small.bin)

---

## First-Time Setup

### 1. Commit the Workflow Files

The workflows are already created in `.github/workflows/`. Commit them:

```bash
cd /home/ricki28/pilots-desk

# Add all new files
git add .github/workflows/
git add models/README.md
git add GITHUB_ACTIONS_SETUP.md
git add BUILD_INSTRUCTIONS.md
git add WINDOWS_WHISPER_READY.md

# Commit changes
git commit -m "Add GitHub Actions CI/CD workflows for Windows builds"

# Push to GitHub
git push origin master
```

### 2. Verify Workflows Are Active

1. Go to: https://github.com/ricki2828/pilots-desk/actions
2. You should see two workflows:
   - "Build and Release"
   - "Build Test (Manual)"

### 3. Run Your First Build

**Option 1 - Test Build** (safer first time):
```bash
# Just push your code
git push origin master

# Then manually trigger from GitHub Actions tab
```

**Option 2 - Full Release** (creates v0.1.0):
```bash
git tag v0.1.0
git push origin master --tags
```

---

## Monitoring Builds

### View Build Progress

1. Go to: https://github.com/ricki2828/pilots-desk/actions
2. Click on the running workflow
3. Click on "Build Windows Installer" job
4. Expand steps to see real-time logs

### Build Status Notifications

GitHub will send you email notifications for:
- ✅ Build succeeded
- ❌ Build failed

You can also add a status badge to your README:

```markdown
![Build Status](https://github.com/ricki2828/pilots-desk/actions/workflows/build-release.yml/badge.svg)
```

---

## Troubleshooting

### Build Fails: "Model download failed"

**Cause**: Whisper model download from HuggingFace failed

**Fix**: Update the download URL in the workflow:
```yaml
- name: Download Whisper model
  run: |
    mkdir -p models
    # Try alternative mirror:
    curl -L -o models/ggml-small.bin https://sourceforge.net/projects/whisper-cpp.mirror/files/ggml-small.bin/download
```

### Build Fails: "TypeScript errors"

**Cause**: TypeScript compilation errors in frontend code

**Fix**:
```bash
# Test locally first:
npm run build

# Fix any TypeScript errors, then:
git add .
git commit -m "Fix TypeScript errors"
git push
```

### Build Fails: "Cargo build failed"

**Cause**: Rust compilation errors in Tauri backend

**Fix**:
```bash
# Check Rust code for errors
cd src-tauri
cargo check

# Fix errors, then:
git add .
git commit -m "Fix Rust compilation errors"
git push
```

### Artifact Too Large (>2 GB)

**Cause**: GitHub has a 2 GB limit on artifacts

**Solution**: The current installer (~475 MB) is well under the limit. If you need to optimize:
- Use Whisper tiny model (75 MB) instead of small (466 MB)
- Enable compression in `tauri.conf.json`:
  ```json
  "bundle": {
    "windows": {
      "wix": {
        "compressed": true
      }
    }
  }
  ```

---

## Cost and Limits

### GitHub Actions Free Tier

- **Minutes/month**: 2,000 minutes (free for public repos)
- **Storage**: 500 MB artifacts
- **Concurrent jobs**: 20

### Build Time Per Run

- **Release build**: ~15-20 minutes
- **Test build**: ~15-20 minutes

### Usage Estimate

| Scenario | Builds/Month | Minutes Used | Cost |
|----------|--------------|--------------|------|
| Weekly releases | 4 | 60-80 mins | Free |
| Daily test builds | 30 | 450-600 mins | Free |
| Release + 10 tests/month | 14 | 210-280 mins | Free |

**Conclusion**: Well within free tier limits.

---

## Advanced Configuration

### Build Multiple Platforms

Want to build Linux/macOS versions too? Add jobs:

```yaml
jobs:
  build-windows:
    # ... existing Windows build ...

  build-linux:
    runs-on: ubuntu-latest
    steps:
      # Similar to Windows but for Linux
      # Outputs: .deb, .AppImage, .rpm

  build-macos:
    runs-on: macos-latest
    steps:
      # Similar to Windows but for macOS
      # Outputs: .dmg, .app
```

### Customize Release Notes

Edit the `body:` section in `build-release.yml`:

```yaml
- name: Create Release
  uses: softprops/action-gh-release@v1
  with:
    body: |
      ## Your custom release notes here

      ### Features
      - Feature 1
      - Feature 2
```

### Sign the Installer

For production, sign the .msi with a code signing certificate:

1. Get a code signing certificate
2. Add certificate to GitHub Secrets
3. Update workflow:
   ```yaml
   - name: Sign installer
     run: |
       signtool sign /f ${{ secrets.CERT_FILE }} /p ${{ secrets.CERT_PASSWORD }} installer.msi
   ```

---

## Next Steps

1. ✅ **Commit workflows**: `git add .github && git commit -m "Add CI/CD"`
2. ✅ **Push to GitHub**: `git push origin master`
3. ✅ **Create first release**: `git tag v0.1.0 && git push --tags`
4. ⏳ **Wait for build**: ~15-20 minutes
5. ⏳ **Download installer**: From GitHub Releases page
6. ⏳ **Test on Windows**: Install and verify functionality
7. ⏳ **Distribute to agents**: Share .msi installer

---

## Files Created

```
.github/
├── workflows/
│   ├── build-release.yml    (Automatic release builds)
│   └── build-test.yml        (Manual test builds)

models/
└── README.md                 (Model download instructions)

GITHUB_ACTIONS_SETUP.md       (This file)
BUILD_INSTRUCTIONS.md         (General build guide)
WINDOWS_WHISPER_READY.md      (Windows setup guide)
```

---

**Summary**: GitHub Actions is configured and ready. Just create a tag (`v0.1.0`) and push it to trigger your first automated Windows build! 🚀

**No Windows machine needed** - GitHub provides Windows servers for building.
