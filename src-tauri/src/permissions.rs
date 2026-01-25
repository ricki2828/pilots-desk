/// Windows microphone permissions module
/// Triggers native Windows permission dialog automatically

#[cfg(target_os = "windows")]
pub async fn request_microphone_permission() -> Result<bool, String> {
    use windows::Media::Capture::{MediaCapture, MediaCaptureInitializationSettings};

    log::info!("Requesting Windows microphone permissions...");

    // Create MediaCapture instance - this triggers Windows permission dialog
    let capture = MediaCapture::new().map_err(|e| format!("Failed to create MediaCapture: {}", e))?;

    // Initialize with audio-only settings - this shows the permission popup
    let settings = MediaCaptureInitializationSettings::new()
        .map_err(|e| format!("Failed to create settings: {}", e))?;

    settings.SetStreamingCaptureMode(
        windows::Media::Capture::StreamingCaptureMode::Audio
    ).map_err(|e| format!("Failed to set audio mode: {}", e))?;

    // This line triggers the Windows permission dialog!
    match capture.InitializeAsync(&settings) {
        Ok(async_op) => {
            // Wait for user to grant/deny permission
            match async_op {
                Ok(_) => {
                    log::info!("✅ Microphone permission granted!");
                    Ok(true)
                },
                Err(e) => {
                    log::error!("❌ Microphone permission denied: {}", e);
                    Err(format!("Permission denied by user: {}", e))
                }
            }
        },
        Err(e) => {
            log::error!("Failed to request permissions: {}", e);
            Err(format!("Failed to request permissions: {}", e))
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub async fn request_microphone_permission() -> Result<bool, String> {
    // On non-Windows platforms, assume permissions are granted
    // (Linux/macOS handle this differently)
    log::info!("Non-Windows platform - skipping permission request");
    Ok(true)
}
