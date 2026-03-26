# 고고 다이노 안내 방송

> 고고 다이노 키즈 카페 전용 안내 방송 자동 재생 데스크톱 앱

![메인 화면](https://github.com/user-attachments/assets/c7237960-91fd-4cbd-ae07-c227362f012e)

---

## 소개

Windows 환경에서 실행되는 Electron 기반 데스크톱 앱으로, 키즈 카페 운영에 필요한 안내 방송을 자동으로 재생합니다. 정해진 시간에 방송이 자동 재생되며, 배경 음악 재생도 함께 지원합니다.

## 주요 기능

### 안내 방송 자동 재생

| 카테고리 | 방송 항목 | 기본 재생 시각 |
|---|---|---|
| 어트랙션 운영 | 댄스트램폴린 | 매 짝수 시각 58분 (예: 14:58, 16:58) |
| 어트랙션 운영 | 짚라인 | 매 홀수 시각 58분 (예: 13:58, 15:58) |
| 어트랙션 운영 | 포토타임 | 수동 재생 |
| 마감 안내 | 식사주문 마감 | 18:15 |
| 마감 안내 | 카페음료 마감 | 18:50 |
| 마감 안내 | 워터플레이존 마감 | 19:10 |
| 마감 안내 | 퇴장 | 19:50 |
| 식사 테이블 | 테이블 양보 방송 | 수동 재생 |

### 스케줄 설정

각 방송마다 재생 방식을 개별 설정할 수 있습니다.

- **특정 시각 1회**: 지정한 시각에 1회 재생
- **매 홀수/짝수 시각 정각**: 홀수 또는 짝수 시각마다 반복 재생
- **반복 간격**: 지정한 분 단위로 반복 재생
- 방송별 활성화/비활성화 토글

![스케줄 설정](https://github.com/user-attachments/assets/a55930c4-192b-472f-bb87-925c2069da3e)

### 오디오 플레이어

- 재생 / 정지
- 재생 위치 이동 (seek)
- 안내 방송 볼륨 조절

![안내 방송 카드](https://github.com/user-attachments/assets/626633bb-92ca-4ea7-9d91-52f1f9c02ab9)

### 배경 음악

- 로컬 음악 파일 추가 (IndexedDB에 저장)
- 플레이리스트 생성 / 삭제
- 플레이리스트 내 트랙 순서 변경
- 플레이리스트 반복 재생 설정
- 트랙 제거
- 앱 실행 시 배경 음악 자동 재생 설정
- 안내 방송 재생 시 배경 음악 자동 페이드아웃 → 방송 종료 후 페이드인 복구

![배경 음악](https://github.com/user-attachments/assets/04d47369-bbc8-4851-9ffa-666e1e7229ec)

### 기타

- 한국 시간 기준 실시간 시계 표시
- 창을 닫아도 백그라운드에서 계속 실행 
- 트레이 아이콘 클릭 시 창 복원
- 자동 업데이트 알림 (GitHub Releases 연동)

---

## 기술 스택

| 구분 | 기술 |
|---|---|
| 언어 | TypeScript |
| 프레임워크 | Electron |
| UI | React, SCSS |
| 빌드 | Vite |
| 테스트 | Jest |
| 패키징 | electron-builder (NSIS) |

## 실행 환경

- Windows 10 이상

---

## 개발 환경 설정

### 요구 사항

- Node.js 20 이상
- npm

### 설치

```bash
npm install
```

### 개발 서버 실행 (Electron)

```bash
npm run electron
```

### 웹 전용 실행 (브라우저)

```bash
npm start
```

### 빌드

```bash
npm run build
```

### 설치 파일 생성 (.exe)

```bash
npm run dist
```

빌드 결과물: `dist/gogo-dino-annc-setup-{version}.exe`

### 테스트

```bash
npm test
```

---

## 프로젝트 구조

```
src/
├── features/
│   ├── announcement/      # 안내 방송 관련 컴포넌트, 훅, 타입
│   └── bg-music/          # 배경 음악 관련 컴포넌트, 훅, 타입
├── components/            # 공통 컴포넌트
├── hooks/                 # 공통 훅
├── constants.ts           # 방송 정의 및 카테고리 상수
├── utils.ts               # 유틸리티 함수
└── App.tsx                # 루트 컴포넌트
public/
├── electron.js            # Electron 메인 프로세스
├── preload.js             # Electron preload 스크립트
└── logo.png               # 앱 로고
```
