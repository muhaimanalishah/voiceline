import React from "react";
import styles from "./Badge.module.css";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "accent" | "muted";
  dot?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Badge({
  children,
  variant = "default",
  dot = false,
  className = "",
  style,
}: BadgeProps) {
  const variantClass = {
    default: "",
    success: styles.variantSuccess,
    warning: styles.variantWarning,
    accent: styles.variantAccent,
    muted: styles.variantMuted,
  }[variant];

  return (
    <span
      className={`${styles.badge} ${variantClass} ${className}`}
      style={style}
    >
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  );
}
