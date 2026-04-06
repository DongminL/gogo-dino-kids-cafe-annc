import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SupportModal } from "./SupportModal";
import { GITHUB_WIKI_URL, GOOGLE_FORM_URL } from "@/support-links";

beforeEach(() => {
  Object.defineProperty(window, "electronAPI", {
    value: { openExternal: jest.fn() },
    writable: true,
  });
});

describe("SupportModal", () => {
  it("type='guide'일 때 모달 제목 '사용 가이드' 표시", () => {
    render(<SupportModal type="guide" onClose={jest.fn()} />);
    expect(screen.getByText("사용 가이드")).toBeInTheDocument();
  });

  it("type='feedback'일 때 모달 제목 '건의하기' 표시", () => {
    render(<SupportModal type="feedback" onClose={jest.fn()} />);
    expect(screen.getByText("건의하기")).toBeInTheDocument();
  });

  it("type='guide'일 때 QR SVG 요소가 DOM에 존재함", () => {
    const { container } = render(<SupportModal type="guide" onClose={jest.fn()} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("type='feedback'일 때 QR SVG 요소가 DOM에 존재함", () => {
    const { container } = render(<SupportModal type="feedback" onClose={jest.fn()} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("'브라우저에서 열기' 클릭 시 guide URL로 openExternal 호출", () => {
    render(<SupportModal type="guide" onClose={jest.fn()} />);
    fireEvent.click(screen.getByText("브라우저에서 열기"));
    expect(window.electronAPI?.openExternal).toHaveBeenCalledWith(GITHUB_WIKI_URL);
  });

  it("'브라우저에서 열기' 클릭 시 feedback URL로 openExternal 호출", () => {
    render(<SupportModal type="feedback" onClose={jest.fn()} />);
    fireEvent.click(screen.getByText("브라우저에서 열기"));
    expect(window.electronAPI?.openExternal).toHaveBeenCalledWith(GOOGLE_FORM_URL);
  });

  it("X 버튼 클릭 시 onClose 호출", () => {
    const onClose = jest.fn();
    render(<SupportModal type="guide" onClose={onClose} />);
    fireEvent.click(screen.getByText("×"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("오버레이 클릭 시 onClose 호출", () => {
    const onClose = jest.fn();
    const { container } = render(<SupportModal type="guide" onClose={onClose} />);
    // Click the overlay (first child = overlay div)
    fireEvent.click(container.firstChild!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
