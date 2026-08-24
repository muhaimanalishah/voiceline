"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import styles from "./Modal.module.css";

export interface ModalProps {
  title?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
  hideHeader?: boolean;
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
  className = "",
  hideHeader = false,
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={`${styles.modal} ${wide ? styles.modalWide : ""} ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {!hideHeader && (
          <div className={styles.header}>
            <span className={styles.title}>{title}</span>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close dialog"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
