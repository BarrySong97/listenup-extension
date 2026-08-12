/**
 * @purpose 提供完整 YouTube Cookie 串的本地粘贴、Keychain 保存/替换、状态与清除 UI。
 * @role    仅嵌入可信 main 的播放器布局；不读取浏览器 Cookie，也不回显 Cookie key/value/数量。
 * @deps    @tauri-apps/api/core、DesktopModal、HeroUI wrappers
 * @gotcha  保存成功必须立即清空输入；错误只映射后端阶段/类别，禁止拼接原始输入。
 */
import { Icon } from "@iconify/react";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { DesktopButton } from "./components/ui/DesktopButton";
import { DesktopModal } from "./components/ui/DesktopModal";
import { DesktopSecretArea } from "./components/ui/DesktopSecretArea";

type CookieVaultStatus = "missing" | "saved" | "failed";

interface CookieSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onCredentialsChanged?: () => void;
}

const statusLabel = (status: CookieVaultStatus) => {
  if (status === "saved") return "已保存到 macOS Keychain";
  if (status === "failed") return "暂时无法读取 Keychain 状态";
  return "尚未保存 Cookie";
};

const safeErrorLabel = (error: unknown) => {
  const category = String(error);
  if (category.includes("input-too-large")) return "Cookie 串超过 64 KiB 限制";
  if (category.includes("too-many-keys")) return "Cookie 键数量超过 180 个限制";
  if (category.includes("unsupported-attribute")) return "请只粘贴 key=value，不要包含 Path、Domain 等属性";
  if (category.includes("cookie-parse")) return "Cookie 格式无效，请粘贴完整 key=value 串";
  if (category.includes("cookie-store")) return "macOS Keychain 操作失败，请稍后重试";
  if (category.includes("cookie-webview")) return "Cookie 已处理，但当前播放器应用失败，请重新加载";
  return "Cookie 操作失败，请稍后重试";
};

export const CookieSettings = ({
  isOpen,
  onClose,
  onCredentialsChanged,
}: CookieSettingsProps) => {
  const [raw, setRaw] = useState("");
  const [status, setStatus] = useState<CookieVaultStatus>("missing");
  const [pending, setPending] = useState<"save" | "clear" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    void invoke<CookieVaultStatus>("get_youtube_cookie_status")
      .then(setStatus)
      .catch(() => setStatus("failed"));
  }, [isOpen]);

  const save = useCallback(async () => {
    setPending("save");
    setError(null);
    try {
      const next = await invoke<CookieVaultStatus>("save_youtube_cookies", { raw });
      setStatus(next);
      setRaw("");
      onCredentialsChanged?.();
    } catch (cause) {
      setError(safeErrorLabel(cause));
    } finally {
      setPending(null);
    }
  }, [onCredentialsChanged, raw]);

  const clear = useCallback(async () => {
    setPending("clear");
    setError(null);
    try {
      const next = await invoke<CookieVaultStatus>("clear_youtube_cookies");
      setStatus(next);
      setRaw("");
      onCredentialsChanged?.();
    } catch (cause) {
      setError(safeErrorLabel(cause));
    } finally {
      setPending(null);
    }
  }, [onCredentialsChanged]);

  const close = useCallback(() => {
    if (pending !== null) return;
    setRaw("");
    setError(null);
    onClose();
  }, [onClose, pending]);

  return (
    <DesktopModal
      isOpen={isOpen}
      onClose={close}
      ariaLabelledBy="cookie-settings-title"
      ariaDescribedBy="cookie-settings-description"
      size="lg"
      scroll="outside"
      isKeyboardDismissDisabled={pending !== null}
      backdropClassName="bg-[#11151c]/98 backdrop-blur"
      dialogClassName="max-w-xl rounded-2xl border-white/10 bg-[#171b22] p-5"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-amber-400/10 text-amber-300">
          <Icon icon="mdi:key-chain-variant" className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            id="cookie-settings-title"
            className="m-0 text-sm font-semibold text-white"
          >
            YouTube Cookie
          </h2>
          <p
            id="cookie-settings-description"
            className="mb-0 mt-1 text-[11px] leading-relaxed text-white/50"
          >
            仅在需要时手动粘贴完整 Cookie 串。ListenUp 不读取或复用任何浏览器 Cookie。
          </p>
        </div>
        <DesktopButton
          className="h-8 cursor-pointer rounded-lg px-2.5 text-[11px] text-white/50 hover:bg-white/10 hover:text-white"
          isDisabled={pending !== null}
          onPress={close}
        >
          完成
        </DesktopButton>
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[10px] text-white/55">
        {statusLabel(status)}
      </div>

      <label className="mt-4 block text-[11px] font-medium text-white/75">
        完整 Cookie 串
      </label>
      <DesktopSecretArea
        aria-label="完整 YouTube Cookie 串"
        placeholder="name=value; name2=value2; name3=value3"
        maxLength={64 * 1024}
        rows={5}
        value={raw}
        onChange={(event) => setRaw(event.target.value)}
        className="mt-2 min-h-28 w-full resize-y rounded-xl border border-white/10 bg-black/35 px-3 py-2 font-mono text-[11px] leading-relaxed text-white placeholder:text-white/25"
      />
      <p className="mb-0 mt-2 text-[10px] leading-relaxed text-white/35">
        只接受以分号分隔的 key=value；保存后输入会立即清空，页面不会显示 Cookie 名称、数量或值。
      </p>

      {error && <p className="mb-0 mt-3 text-[10px] text-red-300">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <DesktopButton
          className="h-9 cursor-pointer rounded-lg bg-red-500 px-4 text-[11px] font-semibold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-45"
          isDisabled={pending !== null || raw.trim().length === 0}
          onPress={() => void save()}
        >
          {pending === "save"
            ? "保存中…"
            : status === "missing"
              ? "保存 Cookie"
              : "替换 Cookie"}
        </DesktopButton>
        <DesktopButton
          className="h-9 cursor-pointer rounded-lg border border-white/10 px-4 text-[11px] text-white/55 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
          isDisabled={pending !== null || status === "missing"}
          onPress={() => void clear()}
        >
          {pending === "clear" ? "清除中…" : "清除已保存 Cookie"}
        </DesktopButton>
      </div>

      <p className="mb-0 mt-4 text-[10px] leading-relaxed text-amber-200/55">
        手动 Cookie 只能提高部分视频可播放的可能性，不保证登录、受限内容或长期有效。
      </p>
    </DesktopModal>
  );
};
