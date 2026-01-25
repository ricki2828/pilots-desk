mod audio;
mod storage;
mod whisper;
mod script;

use audio::{AudioCapture, AudioConfig, AudioLevels};
use log::info;
use script::{ScriptEngine, ScriptNode};
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};
use whisper::{Transcript, WhisperConfig, WhisperEngine};

/// Application state
pub struct AppState {
    audio_capture: Mutex<Option<AudioCapture>>,
    whisper_engine: Mutex<Option<WhisperEngine>>,
    script_engine: Mutex<Option<ScriptEngine>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            audio_capture: Mutex::new(None),
            whisper_engine: Mutex::new(None),
            script_engine: Mutex::new(None),
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

/// Initialize Whisper engine
#[tauri::command]
async fn init_whisper(state: State<'_, AppState>) -> Result<String, String> {
    let config = WhisperConfig::default();
    let engine = WhisperEngine::new(config);

    let mut whisper_guard = state.whisper_engine.lock().unwrap();
    *whisper_guard = Some(engine);

    info!("Whisper engine initialized");
    Ok("Whisper initialized (mock mode)".to_string())
}

/// Start transcription (connects audio to whisper)
#[tauri::command]
async fn start_transcription(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // Get audio receiver
    let audio_receiver = {
        let mut audio_guard = state.audio_capture.lock().unwrap();
        if let Some(ref mut capture) = *audio_guard {
            capture.get_receiver()
        } else {
            return Err("Audio not initialized".to_string());
        }
    };

    if audio_receiver.is_none() {
        return Err("Audio receiver already taken".to_string());
    }

    // Set up Whisper with audio receiver
    let transcript_receiver = {
        let mut whisper_guard = state.whisper_engine.lock().unwrap();
        if let Some(ref mut engine) = *whisper_guard {
            engine.set_audio_receiver(audio_receiver.unwrap());
            engine.start()?;
            engine.get_transcript_receiver()
        } else {
            return Err("Whisper not initialized".to_string());
        }
    };

    if let Some(rx) = transcript_receiver {
        // Start thread to forward transcripts to frontend
        std::thread::spawn(move || {
            info!("Transcript forwarding thread started");

            loop {
                match rx.recv() {
                    Ok(transcript) => {
                        // Emit transcript event to frontend
                        if let Err(e) = app_handle.emit("transcript", &transcript) {
                            log::error!("Failed to emit transcript: {}", e);
                        } else {
                            log::debug!("Transcript emitted: {}", transcript.text);
                        }
                    }
                    Err(e) => {
                        log::error!("Transcript receiver error: {}", e);
                        break;
                    }
                }
            }

            info!("Transcript forwarding thread stopped");
        });

        Ok("Transcription started".to_string())
    } else {
        Err("Failed to get transcript receiver".to_string())
    }
}

/// Stop transcription
#[tauri::command]
async fn stop_transcription(state: State<'_, AppState>) -> Result<String, String> {
    let mut whisper_guard = state.whisper_engine.lock().unwrap();

    if let Some(ref mut engine) = *whisper_guard {
        engine.stop();
        Ok("Transcription stopped".to_string())
    } else {
        Err("Whisper not initialized".to_string())
    }
}

/// Check if transcription is running
#[tauri::command]
async fn is_transcribing(state: State<'_, AppState>) -> Result<bool, String> {
    let whisper_guard = state.whisper_engine.lock().unwrap();

    if let Some(ref engine) = *whisper_guard {
        Ok(engine.is_running())
    } else {
        Ok(false)
    }
}

/// Load script from file
#[tauri::command]
async fn load_script(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    script_path: String
) -> Result<String, String> {
    // Resolve bundled resource path
    let resolved_path = app.path()
        .resolve(&script_path, tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve resource path for '{}': {}", script_path, e))?;

    info!("Script path requested: {}", script_path);
    info!("Resolved full path: {:?}", resolved_path);
    info!("Path exists: {}", resolved_path.exists());

    let engine = ScriptEngine::load_from_file(&resolved_path)
        .map_err(|e| format!("Failed to load script from {:?}: {}", resolved_path, e))?;

    let script_name = engine.get_name().to_string();
    let script_version = engine.get_version().to_string();

    let mut script_guard = state.script_engine.lock().unwrap();
    *script_guard = Some(engine);

    info!("Script loaded: {} v{}", script_name, script_version);
    Ok(format!("Loaded: {} v{}", script_name, script_version))
}

/// Get current script node
#[tauri::command]
async fn get_current_node(state: State<'_, AppState>) -> Result<Option<ScriptNode>, String> {
    let script_guard = state.script_engine.lock().unwrap();

    if let Some(ref engine) = *script_guard {
        Ok(engine.current_node().cloned())
    } else {
        Ok(None)
    }
}

/// Get all script nodes (for UI rendering)
#[tauri::command]
async fn get_all_nodes(state: State<'_, AppState>) -> Result<Vec<ScriptNode>, String> {
    let script_guard = state.script_engine.lock().unwrap();

    if let Some(ref engine) = *script_guard {
        Ok(engine.get_all_nodes().to_vec())
    } else {
        Err("No script loaded".to_string())
    }
}

/// Navigate to specific node (manual override)
#[tauri::command]
async fn navigate_to_node(state: State<'_, AppState>, node_id: String) -> Result<String, String> {
    let mut script_guard = state.script_engine.lock().unwrap();

    if let Some(ref mut engine) = *script_guard {
        engine.navigate_to(&node_id)?;
        Ok(format!("Navigated to: {}", node_id))
    } else {
        Err("No script loaded".to_string())
    }
}

/// Navigate back to previous node
#[tauri::command]
async fn navigate_back(state: State<'_, AppState>) -> Result<String, String> {
    let mut script_guard = state.script_engine.lock().unwrap();

    if let Some(ref mut engine) = *script_guard {
        engine.navigate_back()?;
        Ok("Navigated back".to_string())
    } else {
        Err("No script loaded".to_string())
    }
}

/// Process transcript and auto-navigate if keywords match
#[tauri::command]
async fn process_script_transcript(
    state: State<'_, AppState>,
    transcript: String,
) -> Result<Option<String>, String> {
    let mut script_guard = state.script_engine.lock().unwrap();

    if let Some(ref mut engine) = *script_guard {
        Ok(engine.process_transcript(&transcript))
    } else {
        Err("No script loaded".to_string())
    }
}

/// Set script variable
#[tauri::command]
async fn set_script_variable(
    state: State<'_, AppState>,
    name: String,
    value: String,
) -> Result<String, String> {
    let mut script_guard = state.script_engine.lock().unwrap();

    if let Some(ref mut engine) = *script_guard {
        engine.set_variable(&name, value.clone());
        Ok(format!("Set {} = {}", name, value))
    } else {
        Err("No script loaded".to_string())
    }
}

/// Reset script to beginning
#[tauri::command]
async fn reset_script(state: State<'_, AppState>) -> Result<String, String> {
    let mut script_guard = state.script_engine.lock().unwrap();

    if let Some(ref mut engine) = *script_guard {
        engine.reset();
        Ok("Script reset".to_string())
    } else {
        Err("No script loaded".to_string())
    }
}

/// Get widget configuration
#[tauri::command]
async fn get_widget(state: State<'_, AppState>, widget_id: String) -> Result<serde_json::Value, String> {
    let script_guard = state.script_engine.lock().unwrap();

    if let Some(ref engine) = *script_guard {
        if let Some(widget) = engine.get_widget(&widget_id) {
            let widget_json = serde_json::json!({
                "type": widget.widget_type,
                "config": widget.config,
            });
            Ok(widget_json)
        } else {
            Err(format!("Widget '{}' not found", widget_id))
        }
    } else {
        Err("No script loaded".to_string())
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
            init_whisper,
            start_transcription,
            stop_transcription,
            is_transcribing,
            load_script,
            get_current_node,
            get_all_nodes,
            navigate_to_node,
            navigate_back,
            process_script_transcript,
            set_script_variable,
            reset_script,
            get_widget,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
