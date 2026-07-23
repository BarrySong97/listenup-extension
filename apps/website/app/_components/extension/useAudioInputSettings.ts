"use client";
import { useState } from "react";
export function useAudioInputSettings() {
  return { devices: [], selectedDeviceId: "", selectedDeviceLabel: "System default", error: null, refreshDevices: () => {}, setSelectedDeviceId: (_: string) => {} };
}
