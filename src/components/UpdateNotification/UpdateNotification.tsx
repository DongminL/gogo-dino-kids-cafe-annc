import React from "react";
import clsx from "clsx";
import { Download, RefreshCw, X, AlertCircle } from "lucide-react";
import styles from "./UpdateNotification.module.scss";
import { useUpdaterStore } from "@/stores/useUpdaterStore";

const GITHUB_RELEASES_URL = "https://github.com/DongminL/gogo-dino-kids-cafe-annc/releases/tag";

export function UpdateNotification() {
  const { status, updateInfo, downloadProgress, errorMessage, downloadUpdate, installUpdate, dismiss } = useUpdaterStore();

  if (status === "idle" || status === "checking" || status === "not-available") return null;

  if (status === "available" && updateInfo) {
    return (
      <div className={styles.updateNotification}>
        <div className={styles.updateIconWrapper}>
          <Download size={18} />
        </div>
        <span>새 버전 <button
          className={styles.updateVersionLink}
          onClick={() => window.electronAPI?.openExternal(`${GITHUB_RELEASES_URL}/v${updateInfo.version}`)}
        >{updateInfo.version}</button>이 출시되었습니다.</span>
        <button className={styles.updateActionBtn} onClick={downloadUpdate}>업데이트</button>
        <button className={styles.updateDismissBtn} onClick={dismiss}><X size={14} /></button>
      </div>
    );
  }

  if (status === "downloading") {
    const percent = Math.round(downloadProgress?.percent ?? 0);
    return (
      <div className={clsx(styles.updateNotification, styles.downloading)}>
        <div className={styles.downloadingHeader}>
          <div className={clsx(styles.updateIconWrapper, styles.rotating)}>
            <RefreshCw size={18} />
          </div>
          <span>다운로드 중... {percent}%</span>
        </div>
        <div className={styles.updateProgressBg}>
          <div className={styles.updateProgressFill} style={{ width: `${percent}%` }} />
        </div>
      </div>
    );
  }

  if (status === "downloaded") {
    return (
      <div className={clsx(styles.updateNotification, styles.downloaded)}>
        <div className={styles.updateIconWrapper}>
          <RefreshCw size={18} />
        </div>
        <span>업데이트 준비 완료. 재시작하면 설치됩니다.</span>
        <button className={styles.updateActionBtn} onClick={installUpdate}>지금 재시작</button>
        <button className={styles.updateDismissBtn} onClick={dismiss}><X size={14} /></button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={clsx(styles.updateNotification, styles.error)}>
        <div className={styles.updateIconWrapper}>
          <AlertCircle size={18} />
        </div>
        <span>업데이트 실패{errorMessage ? `: ${errorMessage}` : ""}</span>
        <button className={styles.updateDismissBtn} onClick={dismiss}><X size={14} /></button>
      </div>
    );
  }

  return null;
}
