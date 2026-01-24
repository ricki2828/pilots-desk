# WASAPI Loopback Implementation TODO

## Current Status
The `audio.rs` module includes a placeholder for WASAPI loopback that returns `Ok(())` but doesn't actually capture system audio.

## What's Needed

### 1. Add windows-rs Dependency

Add to `Cargo.toml`:
```toml
[target.'cfg(windows)'.dependencies]
windows = { version = "0.58", features = [
    "Win32_Media_Audio",
    "Win32_System_Com",
    "Win32_Foundation",
] }
```

### 2. Implement WASAPI Loopback

Key Windows APIs needed:
- `CoCreateInstance` to get `IMMDeviceEnumerator`
- `IMMDeviceEnumerator::GetDefaultAudioEndpoint` with `eRender` + `eConsole`
- `IMMDevice::Activate` to get `IAudioClient`
- `IAudioClient::Initialize` with `AUDCLNT_STREAMFLAGS_LOOPBACK` flag
- `IAudioClient::GetService` to get `IAudioCaptureClient`
- Read from capture buffer in loop

### 3. Reference Implementation

See:
- https://docs.microsoft.com/en-us/windows/win32/coreaudio/capturing-a-stream
- https://github.com/RustAudio/cpal/issues/270 (WASAPI loopback discussion)

### 4. Alternative: Use cpal Fork

Some cpal forks support loopback:
- https://github.com/ishitatsuyuki/cpal/tree/loopback

Consider forking cpal temporarily or vendoring their loopback branch.

### 5. Testing Requirements

Must test on Windows with:
- **Web dialer** (Chrome/Edge browser audio)
- **Desktop softphone** (Avaya/Cisco/etc.)
- **Mixed audio** (system sounds + dialer)

### 6. Fallback Strategy

If WASAPI implementation is complex:
1. Ship MVP with mic-only mode
2. Add "Virtual Audio Cable" installation instructions for users
3. Have users route system audio to a virtual mic
4. Implement full WASAPI in v1.1

This trades implementation complexity for deployment complexity.

### 7. Estimated Effort

- **Research:** 2-4 hours
- **Implementation:** 4-8 hours
- **Testing:** 2-4 hours
- **Total:** ~1-2 days

## Priority

**MEDIUM** - Mic-only mode is functional for testing. WASAPI loopback needed before BPO deployment but not blocking other phases.

## Testing Checklist

- [ ] Captures browser audio (Chrome playing YouTube)
- [ ] Captures softphone audio (test app)
- [ ] No feedback loop when agent speaks
- [ ] Handles device changes (unplug/replug)
- [ ] Works with multiple audio devices
- [ ] Respects Windows audio permissions
