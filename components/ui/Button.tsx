"use client";

import React from "react";
import { Spinner } from "./Spinner";
import styles from "./Button.module.css";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "ghost"
    | "outline"
    | "danger"
    | "icon"
    | "iconDanger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "ghost",
      size = "md",
      isLoading = false,
      icon,
      fullWidth = false,
      className = "",
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    const variantClass = {
      primary: styles.variantPrimary,
      ghost: styles.variantGhost,
      outline: styles.variantOutline,
      danger: styles.variantDanger,
      icon: styles.variantIcon,
      iconDanger: styles.variantIconDanger,
    }[variant];

    const sizeClass = {
      sm: styles.sizeSm,
      md: styles.sizeMd,
      lg: styles.sizeLg,
    }[size];

    return (
      <button
        ref={ref}
        type={type}
        className={`${styles.btn} ${variantClass} ${sizeClass} ${
          fullWidth ? styles.fullWidth : ""
        } ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Spinner size={size === "lg" ? "md" : "sm"} />
        ) : icon ? (
          icon
        ) : null}
        {children && <span>{children}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
