# GitHub Actions CI/CD for Pilot's Desk

## Automated Workflows

### Build and Release (`build.yml`)

This workflow automatically builds the MSI installer for Windows.

#### Triggers:

1. **On Push to Master** (Automatic)
   - Builds when code changes in: `src/`, `src-tauri/`, `package.json`, `Cargo.toml`
   - Creates artifact available for 90 days
   - Download from: Actions → Build run → Artifacts section

2. **On Pull Request** (Automatic)
   - Builds PR to verify it compiles
   - Adds comment with download link
   - Great for testing before merge

3. **Manual Release** (Manual Trigger)
   - Go to: Actions → Build and Release → Run workflow
   - Check "Create a new release" option
   - Creates GitHub Release with installer attached
   - Tags release as `v0.6.3` (from tauri.conf.json)

## How to Use

### For Regular Development:
```bash
# Just push your changes
git add .
git commit -m "Your changes"
git push origin master

# Wait 10-15 minutes for build to complete
# Download installer from: https://github.com/ricki2828/pilots-desk/actions
```

### For Creating a Release:
1. Update version in `src-tauri/tauri.conf.json`
2. Commit and push the version bump
3. Go to Actions → Build and Release
4. Click "Run workflow"
5. Check "Create a new release" ✓
6. Click "Run workflow"
7. Release will appear at: https://github.com/ricki2828/pilots-desk/releases

### Download Latest Build:
- **From Actions**: https://github.com/ricki2828/pilots-desk/actions
  - Click latest successful build
  - Scroll to "Artifacts" section
  - Download `pilots-desk-installer-vX.X.X`

- **From Releases** (if created): https://github.com/ricki2828/pilots-desk/releases
  - Latest release has MSI attached
  - Includes SHA256 checksum for verification

## Artifacts Produced

Each build creates:
- `PilotsDesk-{version}-installer.msi` - Windows MSI installer
- `PilotsDesk-{version}-installer.msi.sha256` - Checksum for verification

## Build Time

Typical build time: **10-15 minutes**
- Node.js dependency install: ~2-3 min (cached after first run)
- Rust compile: ~5-7 min (cached after first run)
- Frontend build: ~1-2 min
- Tauri bundle: ~2-3 min

## Troubleshooting

### Build fails with "MSI not found"
- Check that `src-tauri/tauri.conf.json` has `"targets": ["msi"]`
- Verify version number is valid (no spaces, follows semver)

### Build is slow
- First build takes longer (15-20 min) to cache dependencies
- Subsequent builds are faster (~10 min) due to caching

### How to skip CI on a commit
Add `[skip ci]` to commit message:
```bash
git commit -m "Update docs [skip ci]"
```

## Cost

GitHub Actions is free for public repositories with generous limits:
- 2,000 minutes/month for free accounts
- Each build uses ~10-15 minutes
- Can do ~130+ builds/month for free

For private repos:
- 3,000 minutes/month on Team plan
- Windows runners use 2x minutes (so 15 min build = 30 min deducted)
