use crossbeam_channel::{Receiver, Sender};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::thread;

/// Whisper model configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhisperConfig {
    pub model_path: String,
    pub whisper_bin_path: String,
    pub language: String,
    pub num_threads: u32,
    pub sample_rate: u32,
}

impl Default for WhisperConfig {
    fn default() -> Self {
        Self {
            model_path: "models/ggml-small.bin".to_string(),
            whisper_bin_path: "whisper-bin/whisper.exe".to_string(),
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

/// Whisper engine using external whisper.cpp process
pub struct WhisperEngineWrapper {
    config: WhisperConfig,
    audio_receiver: Option<Receiver<Vec<f32>>>,
    transcript_sender: Option<Sender<Transcript>>,
    transcript_receiver: Option<Receiver<Transcript>>,
    is_running: Arc<Mutex<bool>>,
    temp_dir: PathBuf,
}

impl WhisperEngineWrapper {
    pub fn new(config: WhisperConfig) -> Self {
        let (transcript_tx, transcript_rx) = crossbeam_channel::bounded(100);

        // Create temp directory for audio chunks
        let temp_dir = std::env::temp_dir().join("pilots-desk-whisper");
        std::fs::create_dir_all(&temp_dir).ok();

        Self {
            config,
            audio_receiver: None,
            transcript_sender: Some(transcript_tx),
            transcript_receiver: Some(transcript_rx),
            is_running: Arc::new(Mutex::new(false)),
            temp_dir,
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

    /// Start Whisper processing using external whisper.exe
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

        // Check if whisper.exe exists
        if !std::path::Path::new(&self.config.whisper_bin_path).exists() {
            return Err(format!(
                "Whisper binary not found at {}. Please ensure whisper.exe is bundled correctly.",
                self.config.whisper_bin_path
            ));
        }

        info!("Starting Whisper with external process:");
        info!("  Model: {}", self.config.model_path);
        info!("  Binary: {}", self.config.whisper_bin_path);

        *self.is_running.lock().unwrap() = true;

        // Start audio processing thread
        self.start_audio_thread();

        Ok(())
    }

    /// Start thread to process audio chunks
    fn start_audio_thread(&mut self) {
        let audio_rx = self.audio_receiver.take().unwrap();
        let transcript_tx = self.transcript_sender.clone().unwrap();
        let model_path = self.config.model_path.clone();
        let whisper_bin = self.config.whisper_bin_path.clone();
        let language = self.config.language.clone();
        let threads = self.config.num_threads;
        let sample_rate = self.config.sample_rate;
        let temp_dir = self.temp_dir.clone();
        let is_running = self.is_running.clone();

        thread::spawn(move || {
            info!("Whisper audio processing thread started (external process)");

            let mut buffer: Vec<f32> = Vec::new();
            const CHUNK_SIZE: usize = 16000 * 3; // 3 seconds of audio at 16kHz
            let mut chunk_counter = 0u32;

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
                            chunk_counter += 1;

                            // Save audio chunk to WAV file
                            let wav_path = temp_dir.join(format!("chunk_{}.wav", chunk_counter));

                            match save_wav(&wav_path, &chunk, sample_rate) {
                                Ok(_) => {
                                    // Call whisper.exe on the WAV file
                                    match run_whisper(
                                        &whisper_bin,
                                        &model_path,
                                        &wav_path,
                                        &language,
                                        threads,
                                    ) {
                                        Ok(text) => {
                                            let trimmed = text.trim().to_string();

                                            if !trimmed.is_empty() {
                                                let transcript = Transcript {
                                                    text: trimmed,
                                                    confidence: 0.85,
                                                    timestamp: chrono::Utc::now().timestamp() as f64,
                                                    is_final: true,
                                                };

                                                if let Err(e) = transcript_tx.try_send(transcript) {
                                                    warn!("Failed to send transcript: {}", e);
                                                }
                                            }
                                        }
                                        Err(e) => {
                                            error!("Whisper.exe error: {}", e);
                                        }
                                    }

                                    // Clean up WAV file
                                    std::fs::remove_file(&wav_path).ok();
                                }
                                Err(e) => {
                                    error!("Failed to save WAV file: {}", e);
                                }
                            }
                        }
                    }
                    Err(crossbeam_channel::RecvTimeoutError::Timeout) => {
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

/// Save audio samples to WAV file (16-bit PCM, mono)
fn save_wav(path: &PathBuf, samples: &[f32], sample_rate: u32) -> Result<(), String> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut writer = hound::WavWriter::create(path, spec)
        .map_err(|e| format!("Failed to create WAV writer: {}", e))?;

    for &sample in samples {
        // Convert f32 (-1.0 to 1.0) to i16
        let sample_i16 = (sample * 32767.0).clamp(-32768.0, 32767.0) as i16;
        writer.write_sample(sample_i16)
            .map_err(|e| format!("Failed to write sample: {}", e))?;
    }

    writer.finalize()
        .map_err(|e| format!("Failed to finalize WAV: {}", e))?;

    Ok(())
}

/// Run whisper.exe and return transcribed text
fn run_whisper(
    whisper_bin: &str,
    model_path: &str,
    wav_path: &PathBuf,
    language: &str,
    threads: u32,
) -> Result<String, String> {
    let output = Command::new(whisper_bin)
        .args(&[
            "-m", model_path,
            "-f", wav_path.to_str().unwrap(),
            "-l", language,
            "-t", &threads.to_string(),
            "--no-timestamps",
            "--output-txt",
        ])
        .output()
        .map_err(|e| format!("Failed to execute whisper.exe: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Whisper.exe failed: {}", stderr));
    }

    // whisper.cpp writes output to <input>.txt
    let txt_path = wav_path.with_extension("wav.txt");
    let text = std::fs::read_to_string(&txt_path)
        .unwrap_or_else(|_| String::from_utf8_lossy(&output.stdout).to_string());

    // Clean up txt file
    std::fs::remove_file(&txt_path).ok();

    Ok(text)
}
