import React from "react";
import { DEFAULT_TAG_COLOR } from "@/lib/recordings/constants";
import styles from "./TagDot.module.css";

export interface TagDotProps {
  color?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: React.CSSProperties;
}

export function TagDot({
  color,
  size = "sm",
  className = "",
  style,
}: TagDotProps) {
  const sizeClass = {
    sm: styles.sizeSm,
    md: styles.sizeMd,
    lg: styles.sizeLg,
  }[size];

  return (
    <span
      className={`${styles.dot} ${sizeClass} ${className}`}
      style={{
        background: color || DEFAULT_TAG_COLOR,
        ...style,
      }}
    />
  );
}
