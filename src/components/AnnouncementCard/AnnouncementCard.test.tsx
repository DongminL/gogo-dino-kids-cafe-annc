import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnnouncementCard } from "./AnnouncementCard";
import type { AnnouncementDef } from "../../types/announcement";
import type { Schedule } from "../../types/schedule";

const ann: AnnouncementDef = {
  id: "meal-order",
  title: "식사주문 마감",
  category: "closing",
  audioFile: "meal-order.mp3",
  defaultSchedule: { type: "once", time: "18:15", intervalMinutes: 30, enabled: true },
};

const schedule: Schedule = { type: "once", time: "18:15", intervalMinutes: 30, enabled: true };
const progress = { current: 0, duration: 0 };

function renderCard(overrides: Partial<Parameters<typeof AnnouncementCard>[0]> = {}) {
  const props = {
    ann,
    schedule,
    isPlaying: false,
    isSettingsOpen: false,
    progress,
    onPlay: jest.fn(),
    onStop: jest.fn(),
    onSeek: jest.fn(),
    onToggleSettings: jest.fn(),
    onScheduleChange: jest.fn(),
    ...overrides,
  };
  return { ...render(<AnnouncementCard {...props} />), props };
}

describe("AnnouncementCard", () => {
  it("방송 제목을 표시한다", () => {
    renderCard();
    expect(screen.getByText("식사주문 마감")).toBeInTheDocument();
  });

  it("재생 중이 아니면 '재생' 버튼을 표시한다", () => {
    renderCard();
    expect(screen.getByRole("button", { name: /재생/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /정지/ })).not.toBeInTheDocument();
  });

  it("재생 중이면 '정지' 버튼을 표시한다", () => {
    renderCard({ isPlaying: true });
    expect(screen.getByRole("button", { name: /정지/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^▶ 재생$/ })).not.toBeInTheDocument();
  });

  it("'재생' 클릭 시 onPlay 호출", async () => {
    const { props } = renderCard();
    await userEvent.click(screen.getByRole("button", { name: /재생/ }));
    expect(props.onPlay).toHaveBeenCalledTimes(1);
  });

  it("'정지' 클릭 시 onStop 호출", async () => {
    const { props } = renderCard({ isPlaying: true });
    await userEvent.click(screen.getByRole("button", { name: /정지/ }));
    expect(props.onStop).toHaveBeenCalledTimes(1);
  });

  it("재생 중이면 AudioControls를 표시한다", () => {
    renderCard({ isPlaying: true, progress: { current: 30, duration: 120 } });
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  it("재생 중이 아니면 AudioControls를 숨긴다", () => {
    renderCard({ isPlaying: false });
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("설정 버튼 클릭 시 onToggleSettings 호출", async () => {
    const { props } = renderCard();
    await userEvent.click(screen.getByTitle("스케줄 설정"));
    expect(props.onToggleSettings).toHaveBeenCalledTimes(1);
  });

  it("isSettingsOpen=true이면 설정 패널을 표시한다", () => {
    renderCard({ isSettingsOpen: true });
    expect(screen.getByText("자동 재생")).toBeInTheDocument();
  });

  it("isSettingsOpen=false이면 설정 패널을 숨긴다", () => {
    renderCard({ isSettingsOpen: false });
    expect(screen.queryByText("자동 재생")).not.toBeInTheDocument();
  });

  it("활성 스케줄이면 schedule-badge에 active 클래스를 부여한다", () => {
    renderCard();
    const badge = screen.getByText("18:15 자동 재생");
    expect(badge).toHaveClass("active");
  });

  it("비활성 스케줄이면 badge에 active 클래스가 없다", () => {
    renderCard({ schedule: { ...schedule, enabled: false } });
    const badge = screen.getByText("자동 재생 꺼짐");
    expect(badge).not.toHaveClass("active");
  });
});
