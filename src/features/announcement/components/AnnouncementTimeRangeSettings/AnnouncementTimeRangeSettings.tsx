import React, { useState, useRef, useEffect } from "react";
import clsx from "clsx";
import styles from "./AnnouncementTimeRangeSettings.module.scss";
import type { AnnouncementTimeRangeSettings as ISettings, DayType, TimeRange } from "@/features/announcement/types/schedule";
import { Wheel } from "@/components/TimePicker/TimePicker";
import type { WheelOption } from "@/components/TimePicker/TimePicker";
import { Clock } from "lucide-react";
import { useAnnouncementStore } from "@/stores/useAnnouncementStore";
import { useKoreanClock } from "@/hooks/useKoreanClock";
import { getDayType } from "@/features/announcement/hooks/useScheduler";

const HOUR_OPTIONS: WheelOption[] = Array.from({ length: 24 }, (_, i) => {
  const v = String(i).padStart(2, "0");
  return { label: v, value: v };
});

const MINUTE_OPTIONS: WheelOption[] = Array.from({ length: 60 }, (_, i) => {
  const v = String(i).padStart(2, "0");
  return { label: v, value: v };
});

export function AnnouncementTimeRangeSettings(): React.ReactNode {
  const {
    showTimeRangeSettings,
    timeRangeSettings,
    dayTypeOverride,
    setTimeRangeSettings,
    setDayTypeOverride,
    setShowTimeRangeSettings,
  } = useAnnouncementStore();

  const currentTime = useKoreanClock();
  const detectedDayType = getDayType(currentTime);

  const [draft, setDraft] = useState<ISettings>(timeRangeSettings);
  const initialDayTypeOverride = useRef(dayTypeOverride);

  // Reset draft and initial override ref each time the modal opens
  useEffect(() => {
    if (showTimeRangeSettings) {
      setDraft(timeRangeSettings);
      initialDayTypeOverride.current = dayTypeOverride;
    }
  }, [showTimeRangeSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAuto = dayTypeOverride === null;
  const timeRangeEnabled = draft.enabled;
  const [activePicker, setActivePicker] = useState<{ dayType: DayType; field: keyof TimeRange } | null>(null);

  if (!showTimeRangeSettings) return null;

  const onClose = () => setShowTimeRangeSettings(false);

  const updateRange = (dayType: DayType, field: keyof TimeRange, hhmm: string) => {
    setDraft((prev) => ({
      ...prev,
      [dayType]: { ...prev[dayType], [field]: hhmm },
    }));
  };

  const handleConfirm = () => {
    setTimeRangeSettings(draft);
    onClose();
  };

  const handleCancel = () => {
    setDayTypeOverride(initialDayTypeOverride.current);
    onClose();
  };

  const handleAutoToggle = (checked: boolean) => {
    setDayTypeOverride(checked ? null : detectedDayType);
  };

  const togglePicker = (dayType: DayType, field: keyof TimeRange) => {
    setActivePicker((prev) =>
      prev?.dayType === dayType && prev?.field === field ? null : { dayType, field }
    );
  };

  const effectiveOverride = dayTypeOverride ?? detectedDayType;

  const renderTimeBox = (dayType: DayType, field: keyof TimeRange, label: string) => {
    const range = draft[dayType];
    const value = range[field];
    const [h, m] = value.split(":");
    const isActive = activePicker?.dayType === dayType && activePicker?.field === field;

    return (
      <div className={styles.timeBoxContainer}>
        <span className={styles.timeBlockLabel}>{label}</span>
        <div
          className={clsx(styles.timeDisplayBox, isActive && styles.active)}
          onClick={(e) => {
            e.stopPropagation();
            togglePicker(dayType, field);
          }}
        >
          <span className={styles.timeText}>{value}</span>
          <span className={styles.clockIcon}><Clock size={18} strokeWidth={2.5} /></span>
        </div>

        {isActive && (
          <div
            className={styles.timeDropdownWheels}
            onClick={(e) => e.stopPropagation()}
          >
            <Wheel
              options={HOUR_OPTIONS}
              value={h}
              onChange={(newH) => updateRange(dayType, field, `${newH}:${m}`)}
            />
            <span className={styles.wheelColon}>:</span>
            <Wheel
              options={MINUTE_OPTIONS}
              value={m}
              onChange={(newM) => updateRange(dayType, field, `${h}:${newM}`)}
            />
          </div>
        )}
      </div>
    );
  };

  const renderTimeRangeRows = (dayType: DayType) => {
    return (
      <div className={styles.timeRangeCompact}>
        {renderTimeBox(dayType, "start", "시작")}
        <div className={styles.timeRangeDivider}>~</div>
        {renderTimeBox(dayType, "end", "종료")}
      </div>
    );
  };

  return (
    <div className={styles.modalOverlay} onClick={handleCancel}>
      <div className={styles.modalContainer} onClick={(e) => {
        e.stopPropagation();
        setActivePicker(null);
      }}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>자동 재생 시간대 설정</h2>
          <button className={styles.btnCloseX} onClick={handleCancel}>&times;</button>
        </div>

        <div className={styles.settingsPanel}>
          <div className={styles.manualOverrideRow}>
            <span className={styles.settingsLabel}>시간대 제한 사용</span>
            <label className={styles.toggleSwitch}>
              <input
                type="checkbox"
                checked={timeRangeEnabled}
                onChange={(e) => setDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>

          {timeRangeEnabled && (
            <>
              <div className={styles.dayTypeSection}>
                <div className={styles.manualOverrideRow}>
                  <span className={styles.settingsLabel}>자동 설정</span>
                  <label className={styles.toggleSwitch}>
                    <input
                      type="checkbox"
                      checked={isAuto}
                      onChange={(e) => handleAutoToggle(e.target.checked)}
                    />
                    <span className={styles.toggleSlider} />
                  </label>
                </div>
                {isAuto ? (
                  <div className={styles.detectedDayType}>
                    <span className={styles.detectedLabel}>감지된 요일 유형</span>
                    <span className={styles.detectedValue}>
                      {detectedDayType === "weekday" ? "평일" : "주말·공휴일"}
                    </span>
                  </div>
                ) : (
                  <div className={styles.dayTypeButtons}>
                    <button
                      className={clsx(styles.dayTypeBtn, effectiveOverride === "weekday" && styles.active)}
                      onClick={() => setDayTypeOverride("weekday")}
                    >
                      평일
                    </button>
                    <button
                      className={clsx(styles.dayTypeBtn, effectiveOverride === "holiday" && styles.active)}
                      onClick={() => setDayTypeOverride("holiday")}
                    >
                      주말·공휴일
                    </button>
                  </div>
                )}
              </div>

              <div>
                {isAuto ? (
                  <>
                    <div>
                      <p className={styles.sectionTitle}>평일 시간대</p>
                      {renderTimeRangeRows("weekday")}
                    </div>
                    <div style={{ marginTop: "24px" }}>
                      <p className={styles.sectionTitle}>주말·공휴일 시간대</p>
                      {renderTimeRangeRows("holiday")}
                    </div>
                  </>
                ) : (
                  <div>
                    <p className={styles.sectionTitle}>
                      {effectiveOverride === "weekday" ? "평일 시간대" : "주말·공휴일 시간대"}
                    </p>
                    {renderTimeRangeRows(effectiveOverride)}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          <div className={styles.settingsActions}>
            <button className={styles.btnCancel} onClick={handleCancel}>취소</button>
            <button className={styles.btnConfirm} onClick={handleConfirm}>확인</button>
          </div>
        </div>
      </div>
    </div>
  );
}
