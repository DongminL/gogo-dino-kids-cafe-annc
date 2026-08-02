import { escapeXml, isValidRegion, buildSsml, synthesize } from "@/electron/tts";

describe("escapeXml", () => {
  it("SSML에 위험한 문자를 이스케이프한다", () => {
    expect(escapeXml("<b>\"Tom\" & 'Jerry'</b>")).toBe(
      "&lt;b&gt;&quot;Tom&quot; &amp; &apos;Jerry&apos;&lt;/b&gt;"
    );
  });

  it("일반 텍스트는 그대로 반환한다", () => {
    expect(escapeXml("안녕하세요")).toBe("안녕하세요");
  });
});

describe("isValidRegion", () => {
  it("영숫자/하이픈 리전을 허용한다", () => {
    expect(isValidRegion("koreacentral")).toBe(true);
    expect(isValidRegion("east-us-2")).toBe(true);
  });

  it("URL 조립을 깨뜨릴 수 있는 값을 거부한다", () => {
    expect(isValidRegion("korea/../evil.com")).toBe(false);
    expect(isValidRegion("korea.com")).toBe(false);
    expect(isValidRegion("")).toBe(false);
    expect(isValidRegion("a".repeat(33))).toBe(false);
  });
});

describe("buildSsml", () => {
  it("사용자 입력의 XML 특수문자를 이스케이프해 포함한다", () => {
    const ssml = buildSsml("<script>", "ko-KR-SunHiNeural");
    expect(ssml).toContain("&lt;script&gt;");
    expect(ssml).not.toContain("<script>");
    expect(ssml).toContain('name="ko-KR-SunHiNeural"');
  });
});

describe("synthesize", () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it("잘못된 리전이면 fetch 없이 에러를 던진다", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(synthesize({ key: "k", region: "bad/region", text: "t" })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("응답이 실패(non-2xx)면 상태 코드를 포함한 에러를 던진다", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;
    await expect(synthesize({ key: "k", region: "koreacentral", text: "t" })).rejects.toThrow("401");
  });

  it("성공하면 응답 바디를 Buffer로 반환한다", async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => bytes }) as unknown as typeof fetch;
    const result = await synthesize({ key: "k", region: "koreacentral", text: "t" });
    expect(Buffer.compare(result, Buffer.from([1, 2, 3]))).toBe(0);
  });
});
