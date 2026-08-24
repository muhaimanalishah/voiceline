"use client";

import React, { useState, useRef, useEffect } from "react";
import styles from "./DropdownMenu.module.css";

export interface DropdownMenuProps {
  trigger: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}

export function DropdownMenu({
  trigger,
  children,
  align = "right",
  className = "",
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("click", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleTriggerClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    trigger.props.onClick?.(e);
    setIsOpen((prev) => !prev);
  };

  return (
    <div ref={containerRef} className={`${styles.container} ${className}`}>
      {React.cloneElement(trigger, {
        onClick: handleTriggerClick,
        "aria-haspopup": "menu",
        "aria-expanded": isOpen,
      })}
      {isOpen && (
        <div
          className={styles.dropdown}
          style={{ [align]: 0 }}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
          role="menu"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export interface DropdownMenuItemProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant?: "default" | "danger";
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
  className?: string;
}

export function DropdownMenuItem({
  children,
  icon,
  variant = "default",
  disabled = false,
  title,
  onClick,
  className = "",
}: DropdownMenuItemProps) {
  return (
    <button
      type="button"
      className={`${styles.item} ${
        variant === "danger" ? styles.itemDanger : ""
      } ${className}`}
      disabled={disabled}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) {
          onClick?.();
        }
      }}
      role="menuitem"
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
