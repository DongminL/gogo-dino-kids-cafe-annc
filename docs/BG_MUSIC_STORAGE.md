# 배경 음악 저장 구조 및 용량 관리

## 개요

배경 음악 파일은 사용자의 로컬 기기에 영구적으로 저장된다. 앱이 종료되었다가 다시 실행되어도 이전에 추가한 음악이 그대로 유지되며, 외부 서버나 네트워크에 의존하지 않는다.

---

## 저장 위치

### 음악 파일 (Blob) — IndexedDB

음악 파일의 실제 바이너리 데이터(Blob)는 브라우저의 **IndexedDB**에 저장된다.

| 항목 | 값 |
|------|-----|
| DB 이름 | `gogo-dino-bgmusic` |
| 버전 | `1` |
| Object Store | `tracks` |
| Key | 트랙 ID (`track-{timestamp}-{random}`) |
| Value | `{ id: string, blob: Blob }` |

구현 파일: `src/db/trackStorage.ts`

```
IndexedDB
└── gogo-dino-bgmusic (DB)
    └── tracks (Object Store)
        ├── { id: "track-1710000000000-abc123", blob: Blob }
        ├── { id: "track-1710000000001-def456", blob: Blob }
        └── ...
```

### 메타데이터 및 설정 — localStorage

음악 이름, 플레이리스트 구성, 재생 설정 등 **파일 자체를 제외한 모든 설정**은 `localStorage`에 JSON 형태로 저장된다.

| 항목 | 값 |
|------|-----|
| 키 | `bg-music-settings` |

저장되는 데이터 구조:

```json
{
  "playlists": [
    {
      "id": "playlist-1710000000000",
      "name": "카페 BGM",
      "trackIds": ["track-...", "track-..."],
      "loop": true
    }
  ],
  "trackMeta": [
    { "id": "track-...", "name": "노래 제목" }
  ],
  "currentPlaylistId": "playlist-1710000000000",
  "currentTrackIndex": 0,
  "autoplay": true,
  "volume": 0.7
}
```

### 정리

| 저장소 | 저장 대상 | 특징 |
|--------|----------|------|
| IndexedDB | 음악 파일 (Blob) | 대용량 바이너리 저장에 적합 |
| localStorage | 메타데이터, 설정값 | 소용량 JSON, 동기 접근 |

---

## 용량 제한

IndexedDB는 브라우저가 허용하는 디스크 쿼터(quota) 안에서만 데이터를 저장할 수 있다. 이 쿼터는 운영체제의 남은 디스크 공간과 무관하게 **브라우저가 독립적으로 관리**한다.

### Electron 환경 (해당 앱)

이 앱은 Electron 위에서 실행되므로 Chromium 엔진의 쿼터 정책이 적용된다.

- 기본 쿼터: 디스크 남은 공간의 **최대 60%** (temporary storage 기준)
- `navigator.storage.persist()`로 **persistent storage** 권한을 획득하면 브라우저가 임의로 데이터를 삭제하지 않는다.

### 일반 브라우저 환경 참고

| 브라우저 | 쿼터 기준 |
|---------|----------|
| Chrome / Edge | 남은 디스크 공간의 최대 60% |
| Firefox | 남은 디스크 공간의 최대 50% |
| Safari | 초과 시 사용자 허가 필요, 엄격하게 제한 |

### 현재 용량 확인 방법 (개발자 도구)

```javascript
const estimate = await navigator.storage.estimate();
console.log(`사용: ${(estimate.usage / 1024 / 1024).toFixed(1)} MB`);
console.log(`쿼터: ${(estimate.quota / 1024 / 1024 / 1024).toFixed(1)} GB`);
```

---

## 발생 가능한 문제

### 1. QuotaExceededError

**원인**: 브라우저 쿼터를 초과한 상태에서 새 음악 파일을 저장하려 할 때 발생한다.

**발생 지점**: `saveTrackBlob()` 내부의 IndexedDB 트랜잭션 오류 핸들러

```
DOMException: QuotaExceededError
  at IDBTransaction.onerror (trackStorage.ts)
```

**사용자에게 표시되는 메시지**:
> 저장 공간이 부족합니다. 불필요한 음악을 삭제한 후 다시 시도해 주세요.

**해결 방법**: 사용하지 않는 트랙을 삭제하거나, 디스크 전체 여유 공간을 확보한다.

---

### 2. 데이터 임의 삭제 (Storage Eviction)

**원인**: 브라우저는 디스크 공간이 부족해지면 오래되거나 용량이 큰 origin의 임시(temporary) 저장소 데이터를 경고 없이 삭제할 수 있다.

**방지 방법**: 앱 시작 시 `navigator.storage.persist()`를 호출해 persistent storage 권한을 요청한다. 권한이 부여된 이후에는 브라우저가 임의로 데이터를 삭제하지 않는다.

구현 위치: `useBgMusic.ts` — 마운트 시 `requestPersistentStorage()` 호출

```typescript
// useBgMusic.ts
useEffect(() => {
  requestPersistentStorage();
}, []);
```

**확인 방법**:

```javascript
const persisted = await navigator.storage.persisted();
console.log(persisted); // true면 보호됨
```

---

### 3. 메타데이터와 실제 파일의 불일치

**원인**: localStorage에는 트랙 메타데이터가 기록되어 있지만, IndexedDB에서 해당 Blob이 삭제된 경우 재생 시 `null`을 반환한다.

**발생 시나리오**:
- Storage Eviction으로 IndexedDB 데이터만 삭제된 경우
- 앱 외부에서 IndexedDB를 직접 초기화한 경우

**동작**: `getTrackBlob(id)`가 `null`을 반환하면 `playAtIndex()`가 조용히 종료된다 (`if (!blob ...) return`). 재생은 중단되지만 앱이 크래시하지는 않는다.

---

### 4. localStorage 용량 초과

**원인**: localStorage는 origin당 **5~10 MB** 제한이 있다. 트랙 수가 매우 많아지면 메타데이터 JSON이 이 한도를 넘을 수 있다.

**실질적 위험도**: 낮음. 트랙 메타데이터는 `{ id, name }` 구조로 매우 작다. 수만 곡이 아니라면 문제가 되지 않는다.

---

## 데이터 흐름 요약

```
사용자가 파일 선택
        │
        ▼
BgMusicPanel.handleFileChange()
        │
        ▼
useBgMusic.addTrack(file)
        │
        ├─► saveTrackBlob(id, file)  ──► IndexedDB에 Blob 저장
        │         │
        │         └─ QuotaExceededError 발생 시 throw
        │                   │
        │                   ▼
        │           BgMusicPanel에서 catch → 에러 메시지 표시
        │
        └─► setSettings(...)  ──► localStorage에 메타데이터 저장

재생 시
        │
        ▼
useBgMusic.playAtIndex(index)
        │
        ▼
getTrackBlob(trackId)  ──► IndexedDB에서 Blob 읽기
        │
        ▼
URL.createObjectURL(blob)  ──► Audio 엘리먼트에 연결 → 재생
```

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/db/trackStorage.ts` | IndexedDB CRUD + persistent storage 요청 |
| `src/hooks/useBgMusic.ts` | 상태 관리, 재생 로직, 저장 호출 |
| `src/components/BgMusicPanel/BgMusicPanel.tsx` | UI, 파일 추가 에러 처리 |
| `src/types/bgMusic.ts` | `Track`, `Playlist` 타입 정의 |
