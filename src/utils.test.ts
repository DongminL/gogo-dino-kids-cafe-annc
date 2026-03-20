import { formatTime, formatDuration, getScheduleLabel, loadSettings } from "./utils";
import type { Schedule } from "./types/schedule";
import { ANNOUNCEMENT_DEFS } from "./constants";

describe("formatTime", () => {
  it("시, 분, 초를 HH:MM:SS 형식으로 반환한다", () => {
    const date = new Date(2024, 0, 1, 9, 5, 3);
    expect(formatTime(date)).toBe("09:05:03");
  });

  it("자정(00:00:00)을 올바르게 포맷한다", () => {
    const date = new Date(2024, 0, 1, 0, 0, 0);
    expect(formatTime(date)).toBe("00:00:00");
  });

  it("23:59:59를 올바르게 포맷한다", () => {
    const date = new Date(2024, 0, 1, 23, 59, 59);
    expect(formatTime(date)).toBe("23:59:59");
  });
});

describe("formatDuration", () => {
  it("초를 M:SS 형식으로 반환한다", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3600)).toBe("60:00");
  });

  it("0초는 '0:00'으로 반환한다", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("NaN은 '0:00'으로 반환한다", () => {
    expect(formatDuration(NaN)).toBe("0:00");
  });

  it("Infinity는 '0:00'으로 반환한다", () => {
    expect(formatDuration(Infinity)).toBe("0:00");
  });

  it("59초는 '0:59'로 반환한다", () => {
    expect(formatDuration(59)).toBe("0:59");
  });
});

describe("getScheduleLabel", () => {
  const base: Schedule = { type: "none", time: "00:00", intervalMinutes: 30, enabled: true };

  it("enabled=false이면 '자동 재생 꺼짐' 반환", () => {
    expect(getScheduleLabel({ ...base, enabled: false, type: "once" })).toBe("자동 재생 꺼짐");
  });

  it("type='none'이면 '자동 재생 꺼짐' 반환", () => {
    expect(getScheduleLabel({ ...base, type: "none" })).toBe("자동 재생 꺼짐");
  });

  it("type='once'이면 시각 포함 라벨 반환", () => {
    expect(getScheduleLabel({ ...base, type: "once", time: "18:15" })).toBe("18:15 자동 재생");
  });

  it("type='odd-hour'이면 홀수 시각 라벨 반환", () => {
    expect(getScheduleLabel({ ...base, type: "odd-hour" })).toBe("홀수 시각 정각 자동 재생");
  });

  it("type='even-hour'이면 짝수 시각 라벨 반환", () => {
    expect(getScheduleLabel({ ...base, type: "even-hour" })).toBe("짝수 시각 정각 자동 재생");
  });

  it("type='interval'이면 분 포함 라벨 반환", () => {
    expect(getScheduleLabel({ ...base, type: "interval", intervalMinutes: 15 })).toBe(
      "15분마다 자동 재생"
    );
  });
});

describe("loadSettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("저장된 데이터가 없으면 기본값 반환", () => {
    const settings = loadSettings();
    ANNOUNCEMENT_DEFS.forEach((def) => {
      expect(settings[def.id]).toEqual(def.defaultSchedule);
    });
  });

  it("저장된 데이터가 있으면 해당 값 반환", () => {
    const saved: Record<string, Schedule> = {
      "dance-trampoline": { type: "once", time: "10:00", intervalMinutes: 30, enabled: false },
    };
    localStorage.setItem("annc-schedules", JSON.stringify(saved));
    expect(loadSettings()).toEqual(saved);
  });

  it("localStorage에 잘못된 JSON이 있으면 기본값 반환", () => {
    localStorage.setItem("annc-schedules", "invalid-json{{{");
    const settings = loadSettings();
    ANNOUNCEMENT_DEFS.forEach((def) => {
      expect(settings[def.id]).toEqual(def.defaultSchedule);
    });
  });
});
