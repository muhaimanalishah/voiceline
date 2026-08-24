import { Loader2 } from "lucide-react";
import styles from "./loading.module.css";

export default function NoteLoading() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.topNav}>
          <div className={styles.backSkeleton} />
        </div>
        <div className={styles.headerSkeleton}>
          <div className={styles.titleSkeleton} />
          <div className={styles.metaSkeleton} />
        </div>
        <div className={styles.editorSkeleton}>
          <div className={styles.lineSkeleton} style={{ width: "95%" }} />
          <div className={styles.lineSkeleton} style={{ width: "88%" }} />
          <div className={styles.lineSkeleton} style={{ width: "92%" }} />
          <div className={styles.lineSkeleton} style={{ width: "70%" }} />
        </div>
        <div className={styles.centerSpinner}>
          <Loader2 size={24} className={styles.spinner} />
          <span>Loading note...</span>
        </div>
      </div>
    </div>
  );
}
