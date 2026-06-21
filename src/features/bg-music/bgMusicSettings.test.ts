import { loadSettings, defaultSettings } from "@/features/bg-music/bgMusicSettings";

describe("loadSettings", () => {
  beforeEach(() => { localStorage.clear(); });

  it("localStorage 비어있으면 기본값 반환", () => {
    expect(loadSettings()).toEqual(defaultSettings());
  });

  it("일부 키 누락된 구버전 JSON → 저장된 값은 유지하고 누락 키는 기본값으로 채움", () => {
    localStorage.setItem("bg-music-settings", JSON.stringify({ volume: 0.5 }));
    const result = loadSettings();
    expect(result.volume).toBe(0.5);
    expect(result.autoplay).toBe(defaultSettings().autoplay);
    expect(result.playlists).toEqual([]);
    expect(result.trackMeta).toEqual([]);
  });

  it("손상된 JSON → 기본값 반환", () => {
    localStorage.setItem("bg-music-settings", "{ invalid json }");
    expect(loadSettings()).toEqual(defaultSettings());
  });
});
