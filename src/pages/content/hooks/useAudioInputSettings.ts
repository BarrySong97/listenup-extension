import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "listenup:selected-audio-input-id";

const getStoredDeviceId = () => {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(STORAGE_KEY) ?? "";
};

const getDeviceLabel = (device: MediaDeviceInfo, index: number) =>
  device.label || `Microphone ${index + 1}`;

export const useAudioInputSettings = () => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceIdState] = useState<string>(
    getStoredDeviceId()
  );
  const [error, setError] = useState<string | null>(null);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setDevices([]);
      setError("Audio input selection is not supported");
      return;
    }

    try {
      const nextDevices = (await navigator.mediaDevices.enumerateDevices()).filter(
        (device) => device.kind === "audioinput"
      );

      setDevices(nextDevices);
      setError(null);
      setSelectedDeviceIdState((current) => {
        if (!current) {
          return "";
        }

        return nextDevices.some((device) => device.deviceId === current)
          ? current
          : "";
      });
    } catch (deviceError) {
      setDevices([]);
      setError(
        deviceError instanceof Error
          ? deviceError.message
          : "Unable to load microphones"
      );
    }
  }, []);

  useEffect(() => {
    refreshDevices();

    if (!navigator.mediaDevices?.addEventListener) {
      return;
    }

    const handleDeviceChange = () => {
      refreshDevices();
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
    };
  }, [refreshDevices]);

  const setSelectedDeviceId = useCallback((deviceId: string) => {
    setSelectedDeviceIdState(deviceId);
    window.localStorage.setItem(STORAGE_KEY, deviceId);
  }, []);

  const selectedDeviceLabel = useMemo(() => {
    if (!selectedDeviceId) {
      return "System default";
    }

    const selectedDevice = devices.find(
      (device) => device.deviceId === selectedDeviceId
    );

    return selectedDevice
      ? getDeviceLabel(selectedDevice, devices.indexOf(selectedDevice))
      : "System default";
  }, [devices, selectedDeviceId]);

  return {
    devices,
    selectedDeviceId,
    selectedDeviceLabel,
    error,
    refreshDevices,
    setSelectedDeviceId,
    getDeviceLabel,
  };
};
