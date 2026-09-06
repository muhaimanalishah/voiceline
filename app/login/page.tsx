"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mic, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui";
import styles from "./login.module.css";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [passphrase, setPassphrase] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) {
      setError("Please enter your passphrase.");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passphrase }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Incorrect passphrase.");
          toast.error(data.error || "Incorrect passphrase.");
          return;
        }

        toast.success("Welcome back!");
        router.push(from);
        router.refresh();
      } catch (err) {
        console.error("Login request failed:", err);
        setError("Failed to authenticate. Please try again.");
      }
    });
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <Mic size={22} />
          </div>
          <h1 className={styles.title}>VoiceLine Access</h1>
          <p className={styles.subtitle}>
            Enter your passphrase to access your voice notes.
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label htmlFor="passphrase" className={styles.inputLabel}>
              Passphrase
            </label>
            <div className={styles.inputWrapper}>
              <input
                id="passphrase"
                type={showPassword ? "text" : "password"}
                className={styles.input}
                placeholder="Enter passphrase..."
                value={passphrase}
                onChange={(e) => {
                  setPassphrase(e.target.value);
                  if (error) setError(null);
                }}
                autoFocus
                disabled={isPending}
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.toggleBtn}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide passphrase" : "Show passphrase"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className={styles.errorMessage} role="alert">
              <Lock size={14} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isPending}
          >
            {isPending ? (
              <Spinner size="sm" />
            ) : (
              <>
                <span>Continue</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        <div className={styles.badgeNote}>
          Protected personal application
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className={styles.loginContainer}><Spinner size="xl" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
