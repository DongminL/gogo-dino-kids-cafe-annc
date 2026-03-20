import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("현재 시각을 HH:MM:SS 형식으로 표시한다", () => {
    const date = new Date(2024, 0, 1, 14, 30, 5);
    render(<AppHeader currentTime={date} volume={0.8} onVolumeChange={jest.fn()} />);
    expect(screen.getByText("14:30:05")).toBeInTheDocument();
  });

  it("로고 이미지를 표시한다", () => {
    const date = new Date();
    render(<AppHeader currentTime={date} volume={1} onVolumeChange={jest.fn()} />);
    expect(screen.getByAltText("고고 다이노")).toBeInTheDocument();
  });

  it("볼륨 퍼센트를 표시한다", () => {
    const date = new Date();
    render(<AppHeader currentTime={date} volume={0.5} onVolumeChange={jest.fn()} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("볼륨 슬라이더 변경 시 onVolumeChange 호출", () => {
    const onVolumeChange = jest.fn();
    const date = new Date();
    render(<AppHeader currentTime={date} volume={1} onVolumeChange={onVolumeChange} />);
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "0.5" } });
    expect(onVolumeChange).toHaveBeenCalledWith(0.5);
  });
});
