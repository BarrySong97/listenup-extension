import { FC } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { iconScale } from "@src/components/ui/iconScale";

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
        className="pointer-events-auto h-9 bg-zinc-900 px-4 text-white shadow-lg hover:bg-black"
        startContent={
          <Icon
            icon="mdi:crosshairs-gps"
            className={iconScale.secondaryAction}
          />
        }
        onPressStart={onPress}
      >
        <span className="text-xs font-semibold">Back to current</span>
      </Button>
    </motion.div>
  );
};
