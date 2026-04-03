import React, { useState, useMemo, useRef } from "react";
import "./AnnouncementTimeRangeSettings.scss";
import type { AnnouncementTimeRangeSettings as ISettings, DayType, TimeRange } from "@/features/announcement/types/schedule";
import { Wheel } from "@/components/TimePicker/TimePicker";
import type { WheelOption } from "@/components/TimePicker/TimePicker";

interface Props {
  settings: ISettings;
  detectedDayType: DayType;
  dayTypeOverride: DayType | null;
  onChangeDayTypeOverride: (v: DayType | null) => void;
  onChange: (s: ISettings) => void;
  onClose: () => void;
}

export function AnnouncementTimeRangeSettings({
  settings,
  detectedDayType,
  dayTypeOverride,
  onChangeDayTypeOverride,
  onChange,
  onClose,
}: Props): React.ReactNode {
  const [draft, setDraft] = useState<ISettings>(settings);
  const [isAuto, setIsAuto] = useState(dayTypeOverride === null);
  const initialDayTypeOverride = useRef(dayTypeOverride);

  const timeRangeEnabled = draft.enabled;
  const [activePicker, setActivePicker] = useState<{ dayType: DayType, field: keyof TimeRange } | null>(null);

  const hourOptions: WheelOption[] = useMemo(
    () => Array.from({ length: 24 }, (_, i) => ({ label: String(i).padStart(2, "0"), value: String(i).padStart(2, "0") })),
    []
  );
  const minuteOptions: WheelOption[] = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({ label: String(i).padStart(2, "0"), value: String(i).padStart(2, "0") })),
    []
  );

  const updateRange = (dayType: DayType, field: keyof TimeRange, hhmm: string) => {
    setDraft((prev) => ({
      ...prev,
      [dayType]: { ...prev[dayType], [field]: hhmm },
    }));
  };

  const handleConfirm = () => {
    onChange(draft);
    onClose();
  };

  const handleCancel = () => {
    onChangeDayTypeOverride(initialDayTypeOverride.current);
    onClose();
  };

  const handleAutoToggle = (checked: boolean) => {
    setIsAuto(checked);
    if (checked) {
      onChangeDayTypeOverride(null);
    } else {
      onChangeDayTypeOverride(detectedDayType);
    }
  };

  const handleDayTypeOverride = (v: DayType) => {
    onChangeDayTypeOverride(v);
  };

  const togglePicker = (dayType: DayType, field: keyof TimeRange) => {
    setActivePicker(prev =>
      prev?.dayType === dayType && prev?.field === field ? null : { dayType, field }
    );
  };

  const ClockIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  );

  const renderTimeBox = (dayType: DayType, field: keyof TimeRange, label: string) => {
    const range = draft[dayType];
    const value = range[field];
    const [h, m] = value.split(":");
    const isActive = activePicker?.dayType === dayType && activePicker?.field === field;

    return (
      <div className="time-box-container">
        <span className="time-block-label">{label}</span>
        <div
          className={`time-display-box ${isActive ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            togglePicker(dayType, field);
          }}
        >
          <span className="time-text">{value}</span>
          <span className="clock-icon"><ClockIcon /></span>
        </div>

        {isActive && (
          <div
            className="time-dropdown-wheels"
            onClick={(e) => e.stopPropagation()} // Prevent close when scrolling wheels
          >
            <Wheel
              options={hourOptions}
              value={h}
              onChange={(newH) => updateRange(dayType, field, `${newH}:${m}`)}
            />
            <span className="wheel-colon">:</span>
            <Wheel
              options={minuteOptions}
              value={m}
              onChange={(newM) => updateRange(dayType, field, `${h}:${newM}`)}
            />
          </div>
        )}
      </div>
    );
  };

  const effectiveOverride = dayTypeOverride ?? detectedDayType;

  const renderTimeRangeRows = (dayType: DayType) => {
    return (
      <div className="time-range-compact">
        {renderTimeBox(dayType, "start", "시작")}
        <div className="time-range-divider">~</div>
        {renderTimeBox(dayType, "end", "종료")}
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-container" onClick={(e) => {
        e.stopPropagation();
        setActivePicker(null);
      }}>
        <div className="modal-header">
          <h2 className="modal-title">자동 재생 시간대 설정</h2>
          <button className="btn-close-x" onClick={handleCancel}>&times;</button>
        </div>

        <div className="settings-panel">
          {/* 시간대 제한 on/off */}
          <div className="manual-override-row">
            <span className="settings-label">시간대 제한 사용</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={timeRangeEnabled}
                onChange={(e) => setDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* 요일 감지/설정 섹션 */}
          {timeRangeEnabled && <div className="day-type-section">
            <div className="manual-override-row">
              <span className="settings-label">자동 설정</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={isAuto}
                  onChange={(e) => handleAutoToggle(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
            {isAuto ? (
              <div className="detected-day-type">
                <span className="detected-label">감지된 요일 유형</span>
                <span className="detected-value">
                  {detectedDayType === "weekday" ? "평일" : "주말·공휴일"}
                </span>
              </div>
            ) : (
              <div className="day-type-buttons">
                <button
                  className={`day-type-btn ${effectiveOverride === "weekday" ? "active" : ""}`}
                  onClick={() => handleDayTypeOverride("weekday")}
                >
                  평일
                </button>
                <button
                  className={`day-type-btn ${effectiveOverride === "holiday" ? "active" : ""}`}
                  onClick={() => handleDayTypeOverride("holiday")}
                >
                  주말·공휴일
                </button>
              </div>
            )}
          </div>}

          {/* 시간대 섹션 */}
          {timeRangeEnabled && <div>
            {isAuto ? (
              <>
                <div>
                  <p className="section-title">평일 시간대</p>
                  {renderTimeRangeRows("weekday")}
                </div>
                <div style={{ marginTop: "24px" }}>
                  <p className="section-title">주말·공휴일 시간대</p>
                  {renderTimeRangeRows("holiday")}
                </div>
              </>
            ) : (
              <div>
                <p className="section-title">
                  {effectiveOverride === "weekday" ? "평일 시간대" : "주말·공휴일 시간대"}
                </p>
                {renderTimeRangeRows(effectiveOverride)}
              </div>
            )}
          </div>}
        </div>

        <div className="modal-footer">
          <div className="settings-actions">
            <button className="btn-cancel" onClick={handleCancel}>취소</button>
            <button className="btn-confirm" onClick={handleConfirm}>확인</button>
          </div>
        </div>
      </div>
    </div>
  );
}
