mod audio;
mod storage;

use audio::{AudioCapture, AudioConfig, AudioLevels};
use log::info;
use std::sync::Mutex;
use tauri::State;

/// Application state
pub struct AppState {
    audio_capture: Mutex<Option<AudioCapture>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            audio_capture: Mutex::new(None),
        }
    }
}

/// Initialize audio capture
#[tauri::command]
async fn init_audio(state: State<'_, AppState>) -> Result<String, String> {
    let config = AudioConfig::default();
    let capture = AudioCapture::new(config);

    let mut audio_guard = state.audio_capture.lock().unwrap();
    *audio_guard = Some(capture);

    info!("Audio system initialized");
    Ok("Audio initialized successfully".to_string())
}

/// Start audio capture
#[tauri::command]
async fn start_capture(state: State<'_, AppState>) -> Result<String, String> {
    let mut audio_guard = state.audio_capture.lock().unwrap();

    if let Some(ref mut capture) = *audio_guard {
        capture.start()?;
        Ok("Audio capture started".to_string())
    } else {
        Err("Audio not initialized".to_string())
    }
}

/// Stop audio capture
#[tauri::command]
async fn stop_capture(state: State<'_, AppState>) -> Result<String, String> {
    let mut audio_guard = state.audio_capture.lock().unwrap();

    if let Some(ref mut capture) = *audio_guard {
        capture.stop();
        Ok("Audio capture stopped".to_string())
    } else {
        Err("Audio not initialized".to_string())
    }
}

/// Get current audio levels
#[tauri::command]
async fn get_audio_levels(state: State<'_, AppState>) -> Result<AudioLevels, String> {
    let audio_guard = state.audio_capture.lock().unwrap();

    if let Some(ref capture) = *audio_guard {
        Ok(capture.get_levels())
    } else {
        Err("Audio not initialized".to_string())
    }
}

/// Check if audio is capturing
#[tauri::command]
async fn is_capturing(state: State<'_, AppState>) -> Result<bool, String> {
    let audio_guard = state.audio_capture.lock().unwrap();

    if let Some(ref capture) = *audio_guard {
        Ok(capture.is_capturing())
    } else {
        Ok(false)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    info!("Starting Pilot's Desk application");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            init_audio,
            start_capture,
            stop_capture,
            get_audio_levels,
            is_capturing,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
