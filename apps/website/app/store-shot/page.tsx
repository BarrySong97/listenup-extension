/**
 * @purpose Chrome Web Store 商店截图用的静态页：左文案右产品 mock，按截图尺寸排版。
 * @role    只为截图存在的辅助路由，不在站点导航里，也不该被外部链接。
 * @deps    @listenup/mock-ui 的 SubtitlePanelMock / LogoMark
 * @gotcha  改动会直接影响商店素材；文案与首页 page.tsx 各写一份，不共享。见 docs/modules/website/README.md
 */
import { LogoMark, SubtitlePanelMock } from "@listenup/mock-ui";

export default function StoreShot() {
  return (
    <main className="flex min-h-screen items-center bg-[radial-gradient(circle_at_72%_44%,#f1f5f9_0%,#ffffff_42%,#f8fafc_100%)] px-20 py-14 font-sans text-[#16181d]">
      <section className="mx-auto grid w-full max-w-[1180px] grid-cols-[minmax(0,1fr)_420px] items-center gap-16">
        <div className="max-w-[590px]">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#1b1d26] text-white shadow-[0_12px_30px_-14px_rgba(0,0,0,0.7)]">
              <LogoMark size={25} />
            </span>
            <div>
              <p className="text-[17px] font-semibold tracking-tight">ListenUp</p>
              <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-black/40">
                Chrome extension
              </p>
            </div>
          </div>

          <h1 className="mt-12 text-[62px] font-semibold leading-[0.98] tracking-[-0.045em] text-balance">
            Interactive subtitles for YouTube.
          </h1>

          <p className="mt-7 max-w-[540px] text-[20px] leading-[1.55] text-black/58">
            Replay any line, understand phrases with AI, and export the full
            transcript for focused language learning.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            {["Click to replay", "AI explanations", "Transcript export"].map(
              (feature) => (
                <span
                  key={feature}
                  className="rounded-full border border-black/8 bg-white/80 px-4 py-2 text-[13px] font-medium text-black/60 shadow-sm backdrop-blur"
                >
                  {feature}
                </span>
              ),
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <SubtitlePanelMock />
        </div>
      </section>
    </main>
  );
}
