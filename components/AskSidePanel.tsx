"use client";

import { X } from "lucide-react";
import styles from "./AskSidePanel.module.css";

export interface AskSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AskSidePanel({ isOpen, onClose }: AskSidePanelProps) {
  if (!isOpen) return null;

  return (
    <aside className={styles.panel} aria-label="Ask AI about your transcriptions">
      <div className={styles.header}>
        <span className={styles.title}>Ask AI</span>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
      <div className={styles.body}>
        <span className={styles.placeholder}>Coming soon.</span>
      </div>
    </aside>
  );
}
