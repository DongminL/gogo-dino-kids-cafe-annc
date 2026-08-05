import React, { useState, useEffect } from "react";
import styles from "@/features/announcement/components/CustomAnnouncementModal/CustomAnnouncementModal.module.scss";
import { CATEGORY_LABELS } from "@/features/announcement/announcements";
import { useAnnouncementStore } from "@/features/announcement/stores/useAnnouncementStore";
import type { Category } from "@/features/announcement/types/category";
import { ConfirmDialog } from "@/components/ConfirmDialog/ConfirmDialog";

const TEXT_MAX_LENGTH = 1000;

interface CustomAnnouncementModalProps {
  initialCategory: Category;
  onClose: () => void;
}

export function CustomAnnouncementModal({ initialCategory, onClose }: CustomAnnouncementModalProps): React.ReactNode {
  const addCustom = useAnnouncementStore((s) => s.addCustom);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>(initialCategory);
  const [text, setText] = useState("");

  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [key, setKey] = useState("");
  const [region, setRegion] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);

  const isDirty = title.trim() !== "" || text.trim() !== "" || key.trim() !== "";
  const requestClose = () => {
    if (isDirty) setConfirmClose(true);
    else onClose();
  };

  useEffect(() => {
    window.electronAPI?.getTtsConfig().then((config) => {
      setHasKey(config.hasKey);
      setRegion(config.region);
      setShowKeyForm(!config.hasKey);
    });
  }, []);

  const canSubmit = title.trim() && text.trim() && !submitting &&
    (!showKeyForm || (key.trim() && region.trim()));

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      if (showKeyForm) {
        await window.electronAPI?.setTtsConfig(key.trim(), region.trim());
      }
      await addCustom(title.trim(), category, text.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "방송 생성에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={requestClose}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>커스텀 방송 만들기</h2>
          <button className={styles.btnCloseX} onClick={requestClose}>&times;</button>
        </div>

        <div className={styles.settingsPanel}>
          <div className={styles.field}>
            <label className={styles.settingsLabel}>제목</label>
            <input
              type="text"
              className={styles.settingsInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 우천 시 안내"
              maxLength={50}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.settingsLabel}>카테고리</label>
            <select
              className={styles.settingsSelect}
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.settingsLabel}>
              방송 멘트
              <span className={styles.charCount}>{text.length}/{TEXT_MAX_LENGTH}</span>
            </label>
            <textarea
              className={styles.settingsTextarea}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, TEXT_MAX_LENGTH))}
              placeholder="안내 방송으로 읽어줄 멘트를 입력하세요."
              rows={4}
            />
          </div>

          {hasKey !== null && (
            <div className={styles.field}>
              {!showKeyForm ? (
                <button className={styles.btnLinkSmall} onClick={() => setShowKeyForm(true)}>
                  Azure 키 변경
                </button>
              ) : (
                <>
                  <label className={styles.settingsLabel}>Azure Speech 키/리전</label>
                  <input
                    type="password"
                    className={styles.settingsInput}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="구독 키"
                  />
                  <input
                    type="text"
                    className={styles.settingsInput}
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="리전 (예: koreacentral)"
                  />
                </>
              )}
            </div>
          )}

          {error && <p className={styles.errorText}>{error}</p>}
        </div>

        <div className={styles.modalFooter}>
          <div className={styles.settingsActions}>
            <button className={styles.btnCancel} onClick={requestClose}>취소</button>
            <button className={styles.btnConfirm} onClick={handleSubmit} disabled={!canSubmit}>
              {submitting ? "생성 중..." : "생성"}
            </button>
          </div>
        </div>

        {confirmClose && (
          <ConfirmDialog
            message="입력한 내용이 사라집니다. 창을 닫으시겠습니까?"
            confirmLabel="닫기"
            onConfirm={onClose}
            onCancel={() => setConfirmClose(false)}
          />
        )}
      </div>
    </div>
  );
}
