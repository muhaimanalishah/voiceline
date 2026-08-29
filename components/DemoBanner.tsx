"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Zap, ExternalLink, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import styles from "./DemoBanner.module.css";

interface DemoBannerProps {
  githubUrl?: string;
}

export default function DemoBanner({
  githubUrl = "https://github.com",
}: DemoBannerProps) {
  const [isResetting, setIsResetting] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  const handleReset = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      const res = await fetch("/api/demo/reset", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset demo data.");
      }

      await queryClient.invalidateQueries();
      toast.success("Demo notes and tags reset to defaults!");
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to reset demo data.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className={styles.banner}>
      <div className={styles.leftGroup}>
        <span className={styles.badge}>
          <Zap size={11} />
          Demo Mode
        </span>
        <span className={styles.description}>
          Running locally with SQLite &amp; mock AI
        </span>
      </div>

      <div className={styles.rightGroup}>
        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.githubLink}
          title="View GitHub Course & Repository"
        >
          <ExternalLink size={12} />
          <span>GitHub Course</span>
        </a>

        <button
          type="button"
          className={styles.resetBtn}
          onClick={handleReset}
          disabled={isResetting}
          title="Reset demo notes and tags to initial defaults"
        >
          {isResetting ? (
            <Loader2 size={12} className={styles.spinning} />
          ) : (
            <RotateCcw size={12} />
          )}
          <span>Reset Demo Notes</span>
        </button>
      </div>
    </div>
  );
}
