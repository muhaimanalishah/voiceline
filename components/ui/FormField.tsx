"use client";

import React from "react";
import styles from "./FormField.module.css";

export interface FormFieldProps {
  label?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  error,
  children,
  className = "",
}: FormFieldProps) {
  return (
    <div className={`${styles.field} ${className}`}>
      {label && <label className={styles.label}>{label}</label>}
      {children}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`${styles.input} ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`${styles.textarea} ${className}`}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
