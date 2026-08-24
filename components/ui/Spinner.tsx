import React from "react";
import { Loader2 } from "lucide-react";
import styles from "./Spinner.module.css";

export interface SpinnerProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  style?: React.CSSProperties;
}

const SIZE_MAP = {
  xs: 11,
  sm: 13,
  md: 16,
  lg: 20,
  xl: 28,
};

export function Spinner({ size = "md", className = "", style }: SpinnerProps) {
  const pixelSize = typeof size === "string" ? SIZE_MAP[size] || 16 : size;

  return (
    <Loader2
      size={pixelSize}
      className={`${styles.spinner} ${className}`}
      style={style}
      aria-label="Loading..."
    />
  );
}
