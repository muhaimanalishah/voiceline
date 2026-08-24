"use client";

import React from "react";
import { TagDot } from "./TagDot";
import styles from "./TagChip.module.css";

export interface TagChipProps {
  name: string;
  color?: string | null;
  active?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
}

export function TagChip({
  name,
  color,
  active = false,
  onClick,
  title,
  className = "",
}: TagChipProps) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${active ? styles.chipActive : ""} ${className}`}
      onClick={onClick}
      title={title}
    >
      <TagDot color={color} size="sm" />
      <span>{name}</span>
    </button>
  );
}
