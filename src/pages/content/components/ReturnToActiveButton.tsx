import { FC } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

interface ReturnToActiveButtonProps {
  onPress: () => void;
}

export const ReturnToActiveButton: FC<ReturnToActiveButtonProps> = ({
  onPress,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 6 }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 28,
        mass: 0.8,
      }}
      className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3"
    >
      <Button
        size="sm"
        radius="full"
        variant="solid"
        color="default"
        className="pointer-events-auto h-10 bg-zinc-900 px-4.5 text-white shadow-lg hover:bg-black"
        onPressStart={onPress}
      >
        <span className="inline-flex items-center gap-2">
          <Icon
            icon="mdi:crosshairs-gps"
            className="h-[1.05em] w-[1.05em] shrink-0 text-[1rem]"
          />
          <span className="text-sm font-semibold leading-none">
            Back to current
          </span>
        </span>
      </Button>
    </motion.div>
  );
};
