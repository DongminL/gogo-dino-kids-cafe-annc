import { shouldFire } from "./useScheduler";
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
