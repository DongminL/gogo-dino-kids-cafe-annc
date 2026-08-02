import { getTtsAudioUrl, deleteTtsCache } from "@/features/announcement/ttsCache";
import { getTrackBlob, saveTrackBlob, deleteTrackBlob } from "@/db/trackStorage";

jest.mock("@/db/trackStorage");

const mockGetTrackBlob = getTrackBlob as jest.MockedFunction<typeof getTrackBlob>;
const mockSaveTrackBlob = saveTrackBlob as jest.MockedFunction<typeof saveTrackBlob>;
const mockDeleteTrackBlob = deleteTrackBlob as jest.MockedFunction<typeof deleteTrackBlob>;

describe("getTtsAudioUrl", () => {
  const synthesizeTts = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.electronAPI = {
      synthesizeTts,
      getTtsConfig: jest.fn(),
      setTtsConfig: jest.fn(),
    } as unknown as typeof window.electronAPI;
    URL.createObjectURL = jest.fn(() => "blob:mock-url");
    synthesizeTts.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockSaveTrackBlob.mockResolvedValue(undefined);
    mockDeleteTrackBlob.mockResolvedValue(undefined);
  });

  it("캐시 미스면 Azure를 호출하고 결과를 캐시에 저장한다", async () => {
    mockGetTrackBlob.mockResolvedValue(null);
    await getTtsAudioUrl("안녕하세요");
    expect(synthesizeTts).toHaveBeenCalledTimes(1);
    expect(mockSaveTrackBlob).toHaveBeenCalledTimes(1);
  });

  it("같은 텍스트를 두 번 요청해도 캐시 히트면 Azure는 1회만 호출된다", async () => {
    mockGetTrackBlob.mockResolvedValueOnce(null).mockResolvedValueOnce(new Blob());
    await getTtsAudioUrl("안녕하세요");
    await getTtsAudioUrl("안녕하세요");
    expect(synthesizeTts).toHaveBeenCalledTimes(1);
  });

  it("다른 텍스트면 각각 Azure를 호출한다", async () => {
    mockGetTrackBlob.mockResolvedValue(null);
    await getTtsAudioUrl("안녕하세요");
    await getTtsAudioUrl("환영합니다");
    expect(synthesizeTts).toHaveBeenCalledTimes(2);
  });

  it("캐시 히트면 Azure를 호출하지 않는다", async () => {
    mockGetTrackBlob.mockResolvedValue(new Blob());
    await getTtsAudioUrl("안녕하세요");
    expect(synthesizeTts).not.toHaveBeenCalled();
    expect(mockSaveTrackBlob).not.toHaveBeenCalled();
  });
});

describe("deleteTtsCache", () => {
  it("트랙 스토리지에서 캐시 항목을 삭제한다", async () => {
    mockDeleteTrackBlob.mockResolvedValue(undefined);
    await deleteTtsCache("안녕하세요");
    expect(mockDeleteTrackBlob).toHaveBeenCalledWith(expect.stringContaining("안녕하세요"));
  });
});
