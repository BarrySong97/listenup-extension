/**
 * @purpose 在 EmbeddedSource 内用 HeroUI Modal 输入并切换到新的 YouTube 链接。
 * @role    只承载换链接表单；播放器迁移、错误状态和请求状态仍由 App 编排。
 * @deps    @iconify/react、Desktop UI primitives
 * @gotcha  关闭只清理父级表单状态，不得退出 Embedded 锁或改变窗口尺寸。
 */
import { Icon } from "@iconify/react";
import { DesktopButton } from "./components/ui/DesktopButton";
import { DesktopIconButton } from "./components/ui/DesktopIconButton";
import { DesktopModal } from "./components/ui/DesktopModal";
import { DesktopTextField } from "./components/ui/DesktopTextField";

interface EmbeddedLinkEditorModalProps {
  isOpen: boolean;
  url: string;
  error: string | null;
  pending: boolean;
  onUrlChange: (url: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

const iconButtonClassName =
  "grid h-[26px] w-[26px] flex-none cursor-pointer place-items-center rounded-[7px] border-none bg-transparent p-0 text-fg-muted transition-colors hover:bg-wash hover:text-fg";

export const EmbeddedLinkEditorModal = ({
  isOpen,
  url,
  error,
  pending,
  onUrlChange,
  onClose,
  onSubmit,
}: EmbeddedLinkEditorModalProps) => (
  <DesktopModal
    isOpen={isOpen}
    onClose={onClose}
    ariaLabelledBy="embedded-link-editor-title"
    ariaDescribedBy="embedded-link-editor-description"
    isKeyboardDismissDisabled={pending}
    dialogClassName="max-w-[360px]"
  >
    <div className="flex items-center gap-2">
      <Icon
        icon="mdi:link-variant"
        className="h-4 w-4 flex-none text-fg-muted"
        aria-hidden="true"
      />
      <h2
        id="embedded-link-editor-title"
        className="m-0 flex-1 text-[13px] font-[650] text-fg"
      >
        播放新链接
      </h2>
      <DesktopIconButton
        className={iconButtonClassName}
        onPress={onClose}
        isDisabled={pending}
        tooltip="取消"
        ariaLabel="取消更换链接"
        icon={
          <Icon
            icon="mdi:close"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          />
        }
      />
    </div>
    <p
      id="embedded-link-editor-description"
      className="mb-3 mt-2 text-[11px] leading-relaxed text-fg-muted"
    >
      当前窗口会原地切换视频，标题栏、字幕区和所有操作保持不变。
    </p>
    <div className="flex gap-2">
      <DesktopTextField
        autoFocus
        aria-label="新的 YouTube 视频链接"
        aria-invalid={error ? true : undefined}
        placeholder="https://youtu.be/..."
        value={url}
        onChange={(event) => onUrlChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit();
        }}
        className="h-9 flex-1 rounded-lg border border-hairline bg-black/25 px-3 text-[11px] text-fg placeholder:text-fg-faint"
      />
      <DesktopButton
        className="h-9 cursor-pointer rounded-lg bg-yt px-3 text-[11px] font-semibold text-white hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
        isDisabled={pending}
        onPress={onSubmit}
      >
        {pending ? "切换中" : "播放"}
      </DesktopButton>
    </div>
    {error && (
      <p className="mb-0 mt-2 text-[10px] text-red-300" role="alert">
        {error}
      </p>
    )}
  </DesktopModal>
);
