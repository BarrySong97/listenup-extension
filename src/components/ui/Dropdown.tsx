import React, { useState, useRef, useEffect, cloneElement } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { Listbox, ListboxItem } from "@heroui/react";

export interface DropdownItem {
  key: string;
  label: string;
  icon?: string;
  onClick: () => void;
}

interface DropdownProps {
  trigger: React.ReactElement;
  items: DropdownItem[];
  className?: string;
  menuClassName?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  className = "",
  menuClassName = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleTriggerClick = () => {
    setIsOpen(!isOpen);
  };

  const handleItemClick = (item: DropdownItem) => {
    item.onClick();
    setIsOpen(false);
  };

  // 克隆trigger并添加onPressStart事件
  const triggerWithEvent = cloneElement(trigger, {
    onPressStart: handleTriggerClick,
  } as any);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger */}
      {triggerWithEvent}

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute right-0 top-full mt-1 z-50 ${menuClassName}`}
          >
            <Listbox className="bg-content1 border border-divider rounded-lg shadow-lg min-w-40">
              {items.map((item) => (
                <ListboxItem
                  key={item.key}
                  startContent={
                    item.icon && <Icon icon={item.icon} className="w-4 h-4" />
                  }
                  className="text-sm"
                  // onClick={() => handleItemClick(item)}
                  onPressStart={() => handleItemClick(item)}
                >
                  {item.label}
                </ListboxItem>
              ))}
            </Listbox>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
