import { renderHook } from "@testing-library/react";
import { useBgMusicStopTime } from "@/features/bg-music/hooks/useBgMusicStopTime";
import type { AnnouncementTimeRangeSettings } from "@/features/announcement/types/schedule";

const baseSettings: AnnouncementTimeRangeSettings = {
  enabled: true,
  weekday: { start: "13:00", end: "19:55" },
  holiday: { start: "10:00", end: "19:55" },
  bgMusicStopEnabled: true,
  bgMusicStopTime: "20:00",
};

function timeAt(hh: number, mm: number): Date {
  const d = new Date(2026, 0, 1);
  d.setHours(hh, mm, 0, 0);
  return d;
}

describe("useBgMusicStopTime", () => {
  it("정지 시각과 일치 + 재생 중이면 pause 호출", () => {
    const pause = jest.fn();
    renderHook(() =>
      useBgMusicStopTime(timeAt(20, 0), baseSettings, true, pause)
    );

    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("정지 시각과 다르면 pause 호출 안 함", () => {
    const pause = jest.fn();
    renderHook(() =>
      useBgMusicStopTime(timeAt(15, 0), baseSettings, true, pause)
    );

    expect(pause).not.toHaveBeenCalled();
  });

  it("재생 중이 아니면 정지 시각이어도 pause 호출 안 함", () => {
    const pause = jest.fn();
    renderHook(() =>
      useBgMusicStopTime(timeAt(20, 0), baseSettings, false, pause)
    );

    expect(pause).not.toHaveBeenCalled();
  });

  it("bgMusicStopEnabled=false면 정지 시각이어도 pause 호출 안 함", () => {
    const pause = jest.fn();
    const settings = { ...baseSettings, bgMusicStopEnabled: false };
    renderHook(() =>
      useBgMusicStopTime(timeAt(20, 0), settings, true, pause)
    );

    expect(pause).not.toHaveBeenCalled();
  });

  it("평일/주말 구분 없이 동일한 정지 시각에 동작 (weekday·holiday 범위와 무관)", () => {
    const pause = jest.fn();
    // 정지 시각이 weekday/holiday 범위 밖이어도 상관없이 발화되어야 함
    const settings: AnnouncementTimeRangeSettings = {
      ...baseSettings,
      enabled: false, // 시간대 제한 자체가 꺼져 있어도
      bgMusicStopTime: "03:00", // 두 범위 모두 벗어난 시각
    };
    renderHook(() =>
      useBgMusicStopTime(timeAt(3, 0), settings, true, pause)
    );

    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("pause 호출 후 isPlaying=false로 갱신되면 같은 분 안에서 재호출 안 함", () => {
    const pause = jest.fn();
    const { rerender } = renderHook(
      ({ time, isPlaying }) =>
        useBgMusicStopTime(time, baseSettings, isPlaying, pause),
      { initialProps: { time: timeAt(20, 0), isPlaying: true } }
    );
    expect(pause).toHaveBeenCalledTimes(1);

    // 정지 버튼을 누른 것처럼 isPlaying이 false로 반영된 상태에서 같은 분 안에 틱이 더 옴
    rerender({ time: timeAt(20, 0), isPlaying: false });

    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("같은 분 안에서 정지 후 사용자가 다시 재생을 눌러도 재호출 안 함", () => {
    const pause = jest.fn();
    const { rerender } = renderHook(
      ({ time, isPlaying }) =>
        useBgMusicStopTime(time, baseSettings, isPlaying, pause),
      { initialProps: { time: timeAt(20, 0), isPlaying: true } }
    );
    expect(pause).toHaveBeenCalledTimes(1);

    // 정지된 직후 같은 분(20:00) 안에서 사용자가 재생 버튼을 다시 누름
    rerender({ time: timeAt(20, 0), isPlaying: false });
    rerender({ time: timeAt(20, 0), isPlaying: true });

    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("사용자가 다시 재생해도 정지 시각이 지나면 재호출 안 함 (분이 지났으므로)", () => {
    const pause = jest.fn();
    const { rerender } = renderHook(
      ({ time, isPlaying }) =>
        useBgMusicStopTime(time, baseSettings, isPlaying, pause),
      { initialProps: { time: timeAt(20, 0), isPlaying: true } }
    );
    expect(pause).toHaveBeenCalledTimes(1);

    rerender({ time: timeAt(20, 0), isPlaying: false });
    rerender({ time: timeAt(20, 1), isPlaying: true }); // 사용자가 재생 버튼을 다시 누름

    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("다음날 같은 시각에 재생 중이면 다시 pause 호출", () => {
    const pause = jest.fn();
    const day1 = timeAt(20, 0);
    const day2 = new Date(2026, 0, 2, 20, 0, 0, 0);

    const { rerender } = renderHook(
      ({ time, isPlaying }) =>
        useBgMusicStopTime(time, baseSettings, isPlaying, pause),
      { initialProps: { time: day1, isPlaying: true } }
    );
    expect(pause).toHaveBeenCalledTimes(1);

    rerender({ time: day1, isPlaying: false });
    rerender({ time: day2, isPlaying: true });

    expect(pause).toHaveBeenCalledTimes(2);
  });
});
