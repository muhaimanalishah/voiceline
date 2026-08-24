import React from "react";
import styles from "./Kbd.module.css";

export interface KbdProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Kbd({ children, className = "", style }: KbdProps) {
  return (
    <kbd className={`${styles.kbd} ${className}`} style={style}>
      {children}
    </kbd>
  );
}
