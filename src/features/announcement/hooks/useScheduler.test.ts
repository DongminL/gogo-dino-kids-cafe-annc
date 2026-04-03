import { shouldFire, getDayType, isInTimeRange } from "./useScheduler";
import type { Schedule } from "../types/schedule";

const base: Schedule = { type: "once", time: "00:00", intervalMinutes: 30, enabled: true };

describe("shouldFire", () => {
  describe("enabled=false이면 항상 false", () => {
    it("enabled=false", () => {
      expect(shouldFire({ ...base, enabled: false, type: "once", time: "10:00" }, 10, 0)).toBe(false);
    });
  });

  describe("once", () => {
    const schedule: Schedule = { ...base, type: "once", time: "18:15" };

    it("정확한 시각에 true 반환", () => {
      expect(shouldFire(schedule, 18, 15)).toBe(true);
    });

    it("다른 시각에 false 반환", () => {
      expect(shouldFire(schedule, 18, 14)).toBe(false);
      expect(shouldFire(schedule, 17, 15)).toBe(false);
    });
  });

  describe("odd-hour", () => {
    const schedule: Schedule = { ...base, type: "odd-hour" };

    it("홀수 시 정각(mm=0)에 true 반환", () => {
      expect(shouldFire(schedule, 1, 0)).toBe(true);
      expect(shouldFire(schedule, 9, 0)).toBe(true);
      expect(shouldFire(schedule, 23, 0)).toBe(true);
    });

    it("짝수 시 정각에 false 반환", () => {
      expect(shouldFire(schedule, 2, 0)).toBe(false);
      expect(shouldFire(schedule, 10, 0)).toBe(false);
    });

    it("정각이 아니면 false 반환", () => {
      expect(shouldFire(schedule, 1, 30)).toBe(false);
    });
  });

  describe("even-hour", () => {
    const schedule: Schedule = { ...base, type: "even-hour" };

    it("짝수 시 정각(mm=0)에 true 반환", () => {
      expect(shouldFire(schedule, 0, 0)).toBe(true);
      expect(shouldFire(schedule, 2, 0)).toBe(true);
      expect(shouldFire(schedule, 12, 0)).toBe(true);
    });

    it("홀수 시 정각에 false 반환", () => {
      expect(shouldFire(schedule, 1, 0)).toBe(false);
      expect(shouldFire(schedule, 11, 0)).toBe(false);
    });
  });

  describe("interval", () => {
    const schedule: Schedule = { ...base, type: "interval", intervalMinutes: 30 };

    it("totalMins이 intervalMinutes의 배수이면 true 반환", () => {
      expect(shouldFire(schedule, 0, 30)).toBe(true); // 30분
      expect(shouldFire(schedule, 1, 0)).toBe(true);  // 60분
      expect(shouldFire(schedule, 1, 30)).toBe(true); // 90분
    });

    it("totalMins=0(자정)에는 false 반환 (하루 첫 실행 방지)", () => {
      expect(shouldFire(schedule, 0, 0)).toBe(false);
    });

    it("배수가 아니면 false 반환", () => {
      expect(shouldFire(schedule, 0, 15)).toBe(false);
      expect(shouldFire(schedule, 1, 15)).toBe(false);
    });

    it("intervalMinutes=0이면 false 반환", () => {
      expect(shouldFire({ ...schedule, intervalMinutes: 0 }, 1, 0)).toBe(false);
    });
  });
});

describe("getDayType", () => {
  it("월요일(1) → weekday", () => {
    const date = new Date(2024, 0, 1); // 2024-01-01 is Monday
    expect(getDayType(date)).toBe("weekday");
  });

  it("금요일(5) → weekday", () => {
    const date = new Date(2024, 0, 5); // 2024-01-05 is Friday
    expect(getDayType(date)).toBe("weekday");
  });

  it("일요일(0) → holiday", () => {
    const date = new Date(2024, 0, 7); // 2024-01-07 is Sunday
    expect(getDayType(date)).toBe("holiday");
  });

  it("토요일(6) → holiday", () => {
    const date = new Date(2024, 0, 6); // 2024-01-06 is Saturday
    expect(getDayType(date)).toBe("holiday");
  });
});

describe("isInTimeRange", () => {
  it("범위 내 시각 true", () => {
    expect(isInTimeRange("13:00", "19:55", 15, 0)).toBe(true);
  });

  it("시작 경계 true", () => {
    expect(isInTimeRange("13:00", "19:55", 13, 0)).toBe(true);
  });

  it("종료 경계 true", () => {
    expect(isInTimeRange("13:00", "19:55", 19, 55)).toBe(true);
  });

  it("시작 전 false", () => {
    expect(isInTimeRange("13:00", "19:55", 12, 59)).toBe(false);
  });

  it("종료 후 false", () => {
    expect(isInTimeRange("13:00", "19:55", 20, 0)).toBe(false);
  });

  it("주말 시작 경계 true", () => {
    expect(isInTimeRange("10:00", "19:55", 10, 0)).toBe(true);
  });

  it("주말 시작 전 false", () => {
    expect(isInTimeRange("10:00", "19:55", 9, 59)).toBe(false);
  });
});
