"use client";

import React from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Modal } from "./Modal";
import styles from "./ConfirmDialog.module.css";

export interface ConfirmDialogProps {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary" | "warning";
  isLoading?: boolean;
  error?: string | null;
  showIcon?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "primary",
  isLoading = false,
  error = null,
  showIcon = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal onClose={onCancel} hideHeader>
      {showIcon ? (
        <div className={styles.warnBox}>
          <div
            className={`${styles.warnIcon} ${
              variant === "warning" ? styles.warnIconWarning : ""
            }`}
          >
            {variant === "warning" ? <AlertTriangle size={16} /> : variant === "danger" ? <AlertTriangle size={16} /> : <Info size={16} />}
          </div>
          <span className={styles.title}>{title}</span>
        </div>
      ) : (
        <h3 className={styles.title} style={{ marginBottom: "0.75rem" }}>
          {title}
        </h3>
      )}

      {error && <div className={styles.errorText}>{error}</div>}

      {description && <div className={styles.description}>{description}</div>}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnGhost}
          onClick={onCancel}
          disabled={isLoading}
        >
          {cancelText}
        </button>
        <button
          type="button"
          className={variant === "danger" ? styles.btnDanger : styles.btnPrimary}
          onClick={onConfirm}
          disabled={isLoading}
        >
          {isLoading ? "Processing..." : confirmText}
        </button>
      </div>
    </Modal>
  );
}
