/**
 * @purpose 演示用的解释卡片：静态内容 + 滑入动画，不发任何请求。
 * @role    RealExtensionPanel 里点击 Explain 后展示的覆盖层。
 * @deps    framer-motion、@iconify/react、./iconScale
 * @gotcha  对应扩展的 ExplainCard，但这里没有 AI、缓存与图片搜索
 */
"use client";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { iconScale } from "./iconScale";

export function ExplainView({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 z-30 flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-3 pb-2">
        <div>
          <div className="text-xl font-bold text-zinc-900">idioms</div>
          <div className="mt-1"><span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">noun</span></div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="inline-flex items-center justify-center h-9 w-9 rounded-md text-zinc-500 hover:bg-zinc-100" aria-label="Settings"><Icon icon="mdi:cog-outline" className={iconScale.headerAction} /></button>
          <button type="button" className="inline-flex items-center justify-center h-9 w-9 rounded-md text-zinc-500 hover:bg-zinc-100" aria-label="Refresh"><Icon icon="mdi:refresh" className={iconScale.headerAction} /></button>
          <button type="button" className="inline-flex items-center justify-center h-9 w-9 rounded-md text-zinc-500 hover:bg-zinc-100" aria-label="Close" onClick={onClose} data-lu-target="close"><Icon icon="mdi:close" className={iconScale.headerAction} /></button>
        </div>
      </div>
      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {/* Phonetics */}
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700"><span className="text-[10px] font-semibold uppercase text-zinc-500">US</span><span>/ˈɪdiəmz/</span></div>
          <div className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700"><span className="text-[10px] font-semibold uppercase text-zinc-500">UK</span><span>/ˈɪdɪəmz/</span></div>
        </div>
        {/* Context */}
        <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs italic text-zinc-600">&ldquo;Today we&apos;re going to learn ten common English <strong className="font-semibold not-italic text-zinc-900">idioms</strong>.&rdquo;</div>
        {/* Meaning */}
        <div>
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-700 mb-1"><Icon icon="mdi:book-open-page-variant-outline" className={iconScale.secondaryAction} /><span>Meaning</span></div>
          <div className="text-[15px] font-semibold text-zinc-900">Fixed expressions whose meaning cannot be guessed from the individual words alone.</div>
        </div>
        <div className="h-px bg-zinc-200/70" />
        {/* Details */}
        <div>
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-700 mb-1"><Icon icon="mdi:format-list-bulleted" className={iconScale.secondaryAction} /><span>Details &amp; Usage</span></div>
          <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-800">
            <li>Refers to figurative phrases the speaker is about to teach.</li>
            <li>Almost always used in fixed form — changing a word breaks the meaning.</li>
            <li>Learning idioms is a hallmark of advanced fluency.</li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
}
