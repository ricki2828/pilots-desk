use crossbeam_channel::{bounded, unbounded, Receiver, Sender};
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::sync::Mutex;
use std::thread;

/// Audio configuration for capture
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub buffer_size: usize,
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self {
            sample_rate: 16000, // Whisper expects 16kHz
            channels: 1,        // Mono for STT
            buffer_size: 4096,
        }
    }
}

/// Audio levels for UI display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioLevels {
    pub mic_level: f32,
    pub system_level: f32,
    pub combined_level: f32,
}

/// Control commands for audio thread
enum AudioCommand {
    Start(Sender<Result<(), String>>), // Send back result of start attempt
    Stop,
}

/// Audio capture manager (thread-safe)
pub struct AudioCapture {
    config: AudioConfig,
    command_sender: Sender<AudioCommand>,
    audio_receiver: Option<Receiver<Vec<f32>>>,
    is_capturing: Arc<Mutex<bool>>,
    current_levels: Arc<Mutex<AudioLevels>>,
}

impl AudioCapture {
    pub fn new(config: AudioConfig) -> Self {
        let (cmd_sender, cmd_receiver) = unbounded::<AudioCommand>();
        let (audio_sender, audio_receiver) = bounded(100);

        let is_capturing = Arc::new(Mutex::new(false));
        let current_levels = Arc::new(Mutex::new(AudioLevels {
            mic_level: 0.0,
            system_level: 0.0,
            combined_level: 0.0,
        }));

        let config_clone = config.clone();
        let is_capturing_clone = is_capturing.clone();
        let levels_clone = current_levels.clone();

        // Spawn audio thread that owns the Stream
        thread::spawn(move || {
            audio_thread(cmd_receiver, audio_sender, config_clone, is_capturing_clone, levels_clone);
        });

        Self {
            config,
            command_sender: cmd_sender,
            audio_receiver: Some(audio_receiver),
            is_capturing,
            current_levels,
        }
    }

    /// Start audio capture
    pub fn start(&mut self) -> Result<(), String> {
        // Create a channel to receive the result from audio thread
        let (result_sender, result_receiver) = bounded(1);

        self.command_sender
            .send(AudioCommand::Start(result_sender))
            .map_err(|e| format!("Failed to send start command: {}", e))?;

        // Wait for audio thread to confirm stream started (or failed)
        match result_receiver.recv_timeout(std::time::Duration::from_secs(5)) {
            Ok(Ok(())) => {
                *self.is_capturing.lock().unwrap() = true;
                Ok(())
            }
            Ok(Err(e)) => {
                *self.is_capturing.lock().unwrap() = false;
                Err(e)
            }
            Err(_) => {
                *self.is_capturing.lock().unwrap() = false;
                Err("Audio thread timeout - no response from microphone".to_string())
            }
        }
    }

    /// Stop audio capture
    pub fn stop(&mut self) {
        let _ = self.command_sender.send(AudioCommand::Stop);
        *self.is_capturing.lock().unwrap() = false;
    }

    /// Get current audio levels for UI
    pub fn get_levels(&self) -> AudioLevels {
        self.current_levels.lock().unwrap().clone()
    }

    /// Get audio receiver for processing
    pub fn get_receiver(&mut self) -> Option<Receiver<Vec<f32>>> {
        self.audio_receiver.take()
    }

    /// Check if currently capturing
    pub fn is_capturing(&self) -> bool {
        *self.is_capturing.lock().unwrap()
    }

    /// Calculate RMS (Root Mean Square) for audio level with automatic gain
    fn calculate_rms(samples: &[f32]) -> f32 {
        if samples.is_empty() {
            return 0.0;
        }
        let sum: f32 = samples.iter().map(|s| s * s).sum();
        let rms = (sum / samples.len() as f32).sqrt();

        // Apply automatic gain: multiply by 10 to make levels more visible
        // This is just for UI display, doesn't affect actual audio capture
        // Cap at 1.0 (100%) to prevent overflow
        (rms * 10.0).min(1.0)
    }
}

/// Audio processing thread (owns the Stream)
fn audio_thread(
    cmd_receiver: Receiver<AudioCommand>,
    audio_sender: Sender<Vec<f32>>,
    config: AudioConfig,
    is_capturing: Arc<Mutex<bool>>,
    current_levels: Arc<Mutex<AudioLevels>>,
) {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
    use cpal::{SampleRate, StreamConfig};

    info!("Audio thread started");

    let mut mic_stream: Option<cpal::Stream> = None;

    loop {
        match cmd_receiver.recv() {
            Ok(AudioCommand::Start(result_sender)) => {
                info!("Starting audio capture");

                // Get microphone device
                let host = cpal::default_host();
                let device = match host.default_input_device() {
                    Some(d) => d,
                    None => {
                        error!("No default input device found");
                        let _ = result_sender.send(Err(
                            "No microphone detected. Please check:\n\
                            1. A microphone is plugged in\n\
                            2. Windows Settings → Privacy → Microphone → All 3 toggles are ON\n\
                            3. Your microphone is set as the default recording device in Windows Sound Settings".to_string()
                        ));
                        continue;
                    }
                };

                let device_name = device.name().unwrap_or_else(|_| "Unknown".to_string());
                info!("Using input device: {}", device_name);

                // Try to get the device's default/supported configuration
                let stream_config = match device.default_input_config() {
                    Ok(default_config) => {
                        info!("Using device's default config: {} Hz, {} channels",
                              default_config.sample_rate().0,
                              default_config.channels());

                        // Use device's native configuration
                        StreamConfig {
                            channels: default_config.channels(),
                            sample_rate: default_config.sample_rate(),
                            buffer_size: cpal::BufferSize::Default, // Let device decide buffer size
                        }
                    },
                    Err(e) => {
                        error!("Failed to get default config: {}, trying fallback", e);
                        // Fallback to our desired config
                        StreamConfig {
                            channels: config.channels,
                            sample_rate: SampleRate(config.sample_rate),
                            buffer_size: cpal::BufferSize::Default,
                        }
                    }
                };

                let sender_clone = audio_sender.clone();
                let levels_clone = current_levels.clone();
                let is_capturing_clone = is_capturing.clone();

                match device.build_input_stream(
                    &stream_config,
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        if *is_capturing_clone.lock().unwrap() {
                            let mic_level = AudioCapture::calculate_rms(data);

                            {
                                let mut current = levels_clone.lock().unwrap();
                                current.mic_level = mic_level;
                                current.combined_level = mic_level;
                            }

                            let samples: Vec<f32> = data.to_vec();
                            if let Err(e) = sender_clone.try_send(samples) {
                                warn!("Failed to send audio samples: {}", e);
                            }
                        }
                    },
                    move |err| {
                        error!("Audio stream error: {}", err);
                    },
                    None,
                ) {
                    Ok(stream) => {
                        if let Err(e) = stream.play() {
                            error!("Failed to start stream playback: {}", e);
                            let _ = result_sender.send(Err(format!(
                                "Failed to start microphone stream: {}.\n\
                                This usually means Windows is blocking microphone access.\n\
                                Please restart the app as Administrator or check Windows permissions.", e
                            )));
                            continue;
                        }
                        mic_stream = Some(stream);
                        info!("Audio capture started successfully on device: {}", device_name);
                        let _ = result_sender.send(Ok(()));
                    }
                    Err(e) => {
                        error!("Failed to build input stream: {}", e);
                        let _ = result_sender.send(Err(format!(
                            "Failed to access microphone: {}.\n\
                            Possible causes:\n\
                            1. Microphone is being used by another application\n\
                            2. Windows permissions not granted\n\
                            3. Microphone driver issue\n\
                            Try closing other apps using the microphone and restart Pilot's Desk.", e
                        )));
                    }
                }
            }
            Ok(AudioCommand::Stop) => {
                info!("Stopping audio capture");
                if let Some(stream) = mic_stream.take() {
                    drop(stream);
                    info!("Audio stream stopped");
                }
            }
            Err(_) => {
                info!("Audio thread command channel closed, exiting");
                break;
            }
        }
    }

    info!("Audio thread stopped");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_rms() {
        let samples = vec![0.5, -0.5, 0.3, -0.3];
        let rms = AudioCapture::calculate_rms(&samples);
        assert!(rms > 0.0 && rms < 1.0);
    }

    #[test]
    fn test_audio_config_default() {
        let config = AudioConfig::default();
        assert_eq!(config.sample_rate, 16000);
        assert_eq!(config.channels, 1);
    }
}
