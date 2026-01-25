use crossbeam_channel::{Receiver, Sender};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::thread;
use whisper_rs::{WhisperContext, WhisperContextParameters, FullParams, SamplingStrategy};

/// Whisper model configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhisperConfig {
    pub model_path: String,
    pub language: String,
    pub num_threads: u32,
    pub sample_rate: u32,
}

impl Default for WhisperConfig {
    fn default() -> Self {
        Self {
            model_path: "models/ggml-small.bin".to_string(),
            language: "en".to_string(),
            num_threads: 4,
            sample_rate: 16000,
        }
    }
}

/// Transcript result from Whisper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transcript {
    pub text: String,
    pub confidence: f32,
    pub timestamp: f64,
    pub is_final: bool,
}

/// Whisper engine using whisper-rs crate
pub struct WhisperEngine {
    config: WhisperConfig,
    context: Option<Arc<Mutex<WhisperContext>>>,
    audio_receiver: Option<Receiver<Vec<f32>>>,
    transcript_sender: Option<Sender<Transcript>>,
    transcript_receiver: Option<Receiver<Transcript>>,
    is_running: Arc<Mutex<bool>>,
}

impl WhisperEngine {
    pub fn new(config: WhisperConfig) -> Self {
        let (transcript_tx, transcript_rx) = crossbeam_channel::bounded(100);

        Self {
            config,
            context: None,
            audio_receiver: None,
            transcript_sender: Some(transcript_tx),
            transcript_receiver: Some(transcript_rx),
            is_running: Arc::new(Mutex::new(false)),
        }
    }

    /// Set audio input receiver
    pub fn set_audio_receiver(&mut self, receiver: Receiver<Vec<f32>>) {
        self.audio_receiver = Some(receiver);
    }

    /// Get transcript output receiver
    pub fn get_transcript_receiver(&mut self) -> Option<Receiver<Transcript>> {
        self.transcript_receiver.take()
    }

    /// Check if engine is running
    pub fn is_running(&self) -> bool {
        *self.is_running.lock().unwrap()
    }

    /// Stop transcription
    pub fn stop(&mut self) {
        *self.is_running.lock().unwrap() = false;
        info!("Whisper engine stopped");
    }

    /// Start Whisper processing
    pub fn start(&mut self) -> Result<(), String> {
        if self.audio_receiver.is_none() {
            return Err("Audio receiver not set".to_string());
        }

        // Check if model exists
        if !std::path::Path::new(&self.config.model_path).exists() {
            return Err(format!(
                "Whisper model not found at {}. Please ensure the model is bundled correctly.",
                self.config.model_path
            ));
        }

        info!("Loading Whisper model from: {}", self.config.model_path);

        // Load Whisper model
        let ctx_params = WhisperContextParameters::default();
        let ctx = WhisperContext::new_with_params(&self.config.model_path, ctx_params)
            .map_err(|e| format!("Failed to load Whisper model: {:?}", e))?;

        self.context = Some(Arc::new(Mutex::new(ctx)));
        *self.is_running.lock().unwrap() = true;

        info!("Whisper model loaded successfully");

        // Start audio processing thread
        self.start_audio_thread();

        Ok(())
    }

    /// Start thread to process audio chunks
    fn start_audio_thread(&mut self) {
        let audio_rx = self.audio_receiver.take().unwrap();
        let transcript_tx = self.transcript_sender.clone().unwrap();
        let context = self.context.clone().unwrap();
        let language = self.config.language.clone();
        let num_threads = self.config.num_threads;
        let is_running = self.is_running.clone();

        thread::spawn(move || {
            info!("Whisper audio processing thread started");

            let mut buffer: Vec<f32> = Vec::new();
            const CHUNK_SIZE: usize = 16000 * 3; // 3 seconds of audio at 16kHz

            loop {
                if !*is_running.lock().unwrap() {
                    info!("Whisper thread stopping (is_running = false)");
                    break;
                }

                match audio_rx.recv_timeout(std::time::Duration::from_millis(100)) {
                    Ok(samples) => {
                        buffer.extend_from_slice(&samples);

                        // Process when we have enough samples
                        if buffer.len() >= CHUNK_SIZE {
                            let chunk: Vec<f32> = buffer.drain(..CHUNK_SIZE).collect();

                            // Transcribe using whisper-rs
                            let mut ctx = context.lock().unwrap();

                            // Create parameters
                            let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
                            params.set_language(Some(&language));
                            params.set_n_threads(num_threads as i32);
                            params.set_print_progress(false);
                            params.set_print_special(false);
                            params.set_print_realtime(false);

                            // Run transcription
                            match ctx.full(params, &chunk) {
                                Ok(_) => {
                                    // Get number of segments
                                    let num_segments = ctx.full_n_segments()
                                        .unwrap_or(0);

                                    // Extract text from all segments
                                    for i in 0..num_segments {
                                        if let Ok(segment_text) = ctx.full_get_segment_text(i) {
                                            let text = segment_text.trim().to_string();

                                            if !text.is_empty() {
                                                let transcript = Transcript {
                                                    text,
                                                    confidence: 0.85,
                                                    timestamp: chrono::Utc::now().timestamp() as f64,
                                                    is_final: true,
                                                };

                                                if let Err(e) = transcript_tx.try_send(transcript) {
                                                    warn!("Failed to send transcript: {}", e);
                                                }
                                            }
                                        }
                                    }
                                }
                                Err(e) => {
                                    error!("Transcription error: {:?}", e);
                                }
                            }
                        }
                    }
                    Err(crossbeam_channel::RecvTimeoutError::Timeout) => {
                        // Continue loop
                        continue;
                    }
                    Err(crossbeam_channel::RecvTimeoutError::Disconnected) => {
                        info!("Audio receiver closed, stopping Whisper thread");
                        break;
                    }
                }
            }

            info!("Whisper audio processing thread stopped");
        });
    }
}
