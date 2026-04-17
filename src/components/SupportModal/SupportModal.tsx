import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { BookOpen, MessageSquare } from "lucide-react";
import styles from "@/components/SupportModal/SupportModal.module.scss";
import { GITHUB_WIKI_URL, GOOGLE_FORM_URL } from "@/support-links";

interface SupportModalProps {
  type: "guide" | "feedback";
  onClose: () => void;
}

const CONFIG = {
  guide: {
    title: "사용 가이드",
    icon: <BookOpen size={22} />,
    url: GITHUB_WIKI_URL,
    description: "앱 사용 방법을 확인하려면\n핸드폰으로 QR 코드를 스캔하세요.",
  },
  feedback: {
    title: "건의하기",
    icon: <MessageSquare size={22} />,
    url: GOOGLE_FORM_URL,
    description: "버그 신고나 기능 건의를 남기려면\n핸드폰으로 QR 코드를 스캔하세요.",
  },
};

export function SupportModal({ type, onClose }: SupportModalProps): React.ReactNode {
  const config = CONFIG[type];

  const handleOpenExternal = () => {
    window.electronAPI?.openExternal(config.url);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleRow}>
            {config.icon}
            <h2 className={styles.modalTitle}>{config.title}</h2>
          </div>
          <button className={styles.btnCloseX} onClick={onClose}>&times;</button>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.description}>{config.description}</p>
          <div className={styles.qrWrapper}>
            <QRCodeSVG value={config.url} size={240} />
          </div>
          <p className={styles.qrCaption}>핸드폰으로 QR 코드를 스캔하세요</p>
          <button className={styles.btnOpenExternal} onClick={handleOpenExternal}>
            브라우저에서 열기
          </button>
        </div>
      </div>
    </div>
  );
}
