import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface AudioDevice {
  name: string;
  id: string;
}

interface AudioSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AudioSettings({ isOpen, onClose }: AudioSettingsProps) {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadDevices();
    }
  }, [isOpen]);

  const loadDevices = async () => {
    try {
      setIsLoading(true);
      // TODO: Implement get_audio_devices in Rust backend
      // For now, show a placeholder
      setDevices([
        { name: "Default Microphone", id: "default" },
        { name: "System Loopback", id: "loopback" },
      ]);
      setSelectedDevice("default");
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to load audio devices:", err);
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    // TODO: Save selected device to backend
    console.log("Selected device:", selectedDevice);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-50 animate-popIn">
      <div className="bg-background border-2 border-foreground rounded-md shadow-pop-purple max-w-md w-full mx-4">
        {/* Header */}
        <div className="bg-accent border-b-2 border-foreground p-6">
          <h2 className="text-2xl font-heading font-bold text-accentForeground">
            Audio Settings
          </h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Microphone Selection */}
          <div>
            <label className="block text-sm font-heading font-bold text-foreground mb-2">
              Microphone Device
            </label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              disabled={isLoading}
              className="input w-full"
            >
              {isLoading ? (
                <option>Loading devices...</option>
              ) : (
                devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Info Box */}
          <div className="bg-tertiary/20 border-2 border-tertiary rounded-sm p-4">
            <p className="text-sm font-body text-foreground">
              <strong className="font-bold">Note:</strong> Make sure you've granted microphone
              permissions in Windows Settings. You should see audio levels moving when you speak.
            </p>
          </div>

          {/* Test Instructions */}
          <div className="space-y-2">
            <h3 className="text-sm font-heading font-bold text-foreground">
              Testing Your Microphone:
            </h3>
            <ul className="text-sm font-body text-foreground space-y-1 list-disc list-inside">
              <li>Click "Start Capture" to begin recording</li>
              <li>Speak into your microphone</li>
              <li>Watch the audio level meters fill up</li>
              <li>Green = good level, Yellow = moderate, Pink = too loud</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-border p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-muted border-2 border-foreground rounded-sm px-6 py-3 font-heading font-bold shadow-pop hover:shadow-pop-hover active:shadow-pop-active transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 btn-primary"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
