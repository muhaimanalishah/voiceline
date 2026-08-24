"use client";

import React from "react";
import { Search } from "lucide-react";
import { Kbd } from "./Kbd";
import styles from "./SearchInput.module.css";

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  shortcut?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      shortcut = "⌘K",
      placeholder = "Search...",
      className = "",
      ...props
    },
    ref
  ) => {
    return (
      <div className={`${styles.wrap} ${className}`}>
        <Search size={13} className={styles.searchIcon} />
        <input
          ref={ref}
          type="text"
          className={styles.input}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...props}
        />
        {shortcut && (
          <span className={styles.shortcutHint}>
            <Kbd>{shortcut}</Kbd>
          </span>
        )}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";
