import React, {
  cloneElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@iconify/react";

export interface DropdownItem {
  key: string;
  label: string;
  icon?: string;
  endIcon?: string;
  isSelected?: boolean;
  isDisabled?: boolean;
  items?: DropdownItem[];
  onClick?: () => void;
}

interface DropdownProps {
  trigger: React.ReactElement;
  items: DropdownItem[];
  className?: string;
  menuClassName?: string;
}

let openDropdownId: string | null = null;
const dropdownCloseCallbacks = new Set<() => void>();

const menuSurfaceClassName =
  "min-w-40 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg";
const itemClassName =
  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900";

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  className = "",
  menuClassName = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openSubmenuKey, setOpenSubmenuKey] = useState<string | null>(null);
  const [submenuDirection, setSubmenuDirection] = useState<"left" | "right">(
    "right"
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownId = useId();

  const itemMap = useMemo(() => {
    const map = new Map<string, DropdownItem>();

    const walk = (menuItems: DropdownItem[]) => {
      menuItems.forEach((item) => {
        map.set(item.key, item);
        if (item.items?.length) {
          walk(item.items);
        }
      });
    };

    walk(items);
    return map;
  }, [items]);

  useEffect(() => {
    const closeThis = () => {
      setIsOpen(false);
      setOpenSubmenuKey(null);
    };

    dropdownCloseCallbacks.add(closeThis);

    return () => {
      dropdownCloseCallbacks.delete(closeThis);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const root = dropdownRef.current;
      if (!root) return;
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      const isInside = path.length > 0
        ? path.includes(root)
        : root.contains(event.target as Node);
      if (!isInside) {
        setIsOpen(false);
        setOpenSubmenuKey(null);
        if (openDropdownId === dropdownId) {
          openDropdownId = null;
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownId]);

  const closeDropdown = () => {
    setIsOpen(false);
    setOpenSubmenuKey(null);
    if (openDropdownId === dropdownId) {
      openDropdownId = null;
    }
  };

  const handleTriggerClick = () => {
    if (openDropdownId && openDropdownId !== dropdownId) {
      dropdownCloseCallbacks.forEach((callback) => callback());
    }

    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    setOpenSubmenuKey(null);

    if (nextOpen) {
      openDropdownId = dropdownId;
    } else if (openDropdownId === dropdownId) {
      openDropdownId = null;
    }
  };

  const openSubmenu = (itemKey: string, anchorElement?: HTMLElement | null) => {
    if (anchorElement) {
      const anchorRect = anchorElement.getBoundingClientRect();
      const estimatedSubmenuWidth = 220;
      const viewportPadding = 8;
      const canOpenRight =
        anchorRect.right + estimatedSubmenuWidth <=
        window.innerWidth - viewportPadding;

      setSubmenuDirection(canOpenRight ? "right" : "left");
    }

    setOpenSubmenuKey(itemKey);
  };

  const mergeHandlers = <T extends (...args: any[]) => void>(
    original?: T,
    injected?: T
  ) => {
    return (...args: Parameters<NonNullable<T>>) => {
      original?.(...args);
      injected?.(...args);
    };
  };

  const handleItemPress = (item: DropdownItem) => {
    if (item.isDisabled) {
      return;
    }

    if (item.items?.length) {
      openSubmenu(item.key);
      return;
    }

    item.onClick?.();
    closeDropdown();
  };

  const renderMenu = (menuItems: DropdownItem[], nested = false) => (
    <div className={`${menuSurfaceClassName} ${nested ? "min-w-52" : ""}`}>
      {menuItems.map((item) => {
        const hasSubmenu = Boolean(item.items?.length);
        const isSubmenuOpen = openSubmenuKey === item.key;

        return (
          <div
            key={item.key}
            className="relative"
            onMouseEnter={(event) => {
              if (hasSubmenu) {
                openSubmenu(item.key, event.currentTarget);
              }
            }}
          >
            <button
              type="button"
              className={`${itemClassName} ${
                item.isDisabled ? "cursor-not-allowed opacity-50" : ""
              }`}
              onClick={(event) => {
                if (item.items?.length) {
                  openSubmenu(item.key, event.currentTarget);
                }

                handleItemPress(item);
              }}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {item.icon ? (
                  <Icon icon={item.icon} className="h-4 w-4 shrink-0" />
                ) : (
                  <span className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate">{item.label}</span>
              </span>
              {item.isSelected ? (
                <Icon icon="mdi:check" className="h-4 w-4 shrink-0 text-blue-600" />
              ) : null}
              {item.endIcon ? (
                <Icon icon={item.endIcon} className="h-4 w-4 shrink-0 text-zinc-400" />
              ) : null}
              {hasSubmenu ? (
                <Icon
                  icon="mdi:chevron-right"
                  className="h-4 w-4 shrink-0 text-zinc-400"
                />
              ) : null}
            </button>

            <AnimatePresence>
              {hasSubmenu && isSubmenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98, x: -4 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.98, x: -4 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                  className={`absolute top-0 z-[60] ${
                    submenuDirection === "right"
                      ? "left-full ml-1"
                      : "right-full mr-1"
                  }`}
                >
                  {renderMenu(item.items ?? [], true)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );

  const triggerProps = trigger.props as any;
  const triggerWithEvent = cloneElement(trigger, {
    onPressStart: mergeHandlers(triggerProps.onPressStart, handleTriggerClick),
    onClick: triggerProps.onClick,
  } as any);

  useEffect(() => {
    if (!openSubmenuKey) {
      return;
    }

    const openItem = itemMap.get(openSubmenuKey);
    if (!openItem?.items?.length) {
      setOpenSubmenuKey(null);
    }
  }, [itemMap, openSubmenuKey]);

  return (
    <div
      ref={dropdownRef}
      className={`relative ${className}`}
      onMouseLeave={() => setOpenSubmenuKey(null)}
    >
      {triggerWithEvent}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute right-0 top-full z-[100] mt-1 ${menuClassName}`}
          >
            {renderMenu(items)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
