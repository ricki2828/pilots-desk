/// Windows microphone permissions module
/// Opens Windows Settings directly to microphone permissions page

#[cfg(target_os = "windows")]
pub async fn request_microphone_permission() -> Result<String, String> {
    use std::process::Command;

    log::info!("Opening Windows microphone permissions settings...");

    // Open Windows Settings directly to microphone permissions page
    // This is much simpler and more reliable than trying to trigger a dialog
    match Command::new("cmd")
        .args(&["/C", "start", "ms-settings:privacy-microphone"])
        .spawn()
    {
        Ok(_) => {
            log::info!("✅ Opened Windows Settings - Microphone permissions page");
            Ok("Opened Windows Settings. Please enable 'Microphone access', 'Let apps access your microphone', and 'Let desktop apps access your microphone', then restart the app.".to_string())
        },
        Err(e) => {
            log::error!("❌ Failed to open Settings: {}", e);
            Err(format!("Failed to open Windows Settings: {}. Please open Settings manually.", e))
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub async fn request_microphone_permission() -> Result<String, String> {
    // On non-Windows platforms, assume permissions are granted
    // (Linux/macOS handle this differently)
    log::info!("Non-Windows platform - skipping permission request");
    Ok("Permissions granted (non-Windows platform)".to_string())
}
