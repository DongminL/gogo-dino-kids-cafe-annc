import React from "react";
import clsx from "clsx";
import styles from "@/components/ConfirmDialog/ConfirmDialog.module.scss";

interface ConfirmDialogProps {
  message: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps): React.ReactNode {
  return (
    <div className={styles.confirmOverlay} data-confirm-modal onClick={(e) => { e.stopPropagation(); onCancel(); }}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>알림</h3>
        </div>
        <div className={styles.modalDivider} />
        <div className={styles.modalBody}>{message}</div>
        <div className={styles.modalDivider} />
        <div className={styles.modalFooter}>
          <button className={clsx(styles.btn, styles.btnDanger)} onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button className={styles.btn} onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
