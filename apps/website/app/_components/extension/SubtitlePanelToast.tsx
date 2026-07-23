"use client";
import { FC } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface SubtitlePanelToastProps {
  message: string | null;
}

export const SubtitlePanelToast: FC<SubtitlePanelToastProps> = ({ message }) => {
  return (
    <AnimatePresence mode="wait">
      {message && (
        <motion.div
          key={message}
          initial={{ opacity: 0, scale: 0.88, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: -6 }}
          transition={{
            type: "spring",
            stiffness: 380,
            damping: 28,
            mass: 0.8,
          }}
          className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3"
        >
          <div className="inline-flex h-10 items-center rounded-full bg-zinc-800/82 px-4.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm">
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
