import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AudioControls } from "./AudioControls";

describe("AudioControls", () => {
  it("현재/전체 시간을 올바르게 표시한다", () => {
    render(<AudioControls current={65} duration={130} onSeek={jest.fn()} />);
    expect(screen.getByText("1:05")).toBeInTheDocument();
    expect(screen.getByText("2:10")).toBeInTheDocument();
  });

  it("duration=0이면 '0:00'을 표시한다", () => {
    render(<AudioControls current={0} duration={0} onSeek={jest.fn()} />);
    const zeros = screen.getAllByText("0:00");
    expect(zeros).toHaveLength(2);
  });

  it("seek 슬라이더 변경 시 onSeek 콜백 호출", () => {
    const onSeek = jest.fn();
    render(<AudioControls current={10} duration={100} onSeek={onSeek} />);
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "50" } });
    expect(onSeek).toHaveBeenCalledWith(50);
  });
});
