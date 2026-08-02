/**
 * @purpose 麦克风设置的空桩（固定返回空设备列表）。
 * @role    让演示面板复用扩展组件而不触碰真实设备权限。
 * @deps    react
 * @gotcha  官网不应弹出麦克风授权，保持为桩
 */
"use client";
import { useState } from "react";
export function useAudioInputSettings() {
  return { devices: [], selectedDeviceId: "", selectedDeviceLabel: "System default", error: null, refreshDevices: () => {}, setSelectedDeviceId: (_: string) => {} };
}
