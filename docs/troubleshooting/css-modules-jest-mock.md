# CSS Modules + Jest 테스트 설정

## 문제 상황

`.scss` 파일을 `.module.scss`로 전환한 후 Jest 단위 테스트가 실패했다.

**에러 1**: CSS 파싱 에러

```
SyntaxError: Unexpected token '.'
```

**에러 2**: 클래스 셀렉터로 요소를 찾지 못함

```
TestingLibraryElementError: Unable to find an element with the class: bgMusicTrackItem
```

`styles.bgMusicTrackItem` 등 CSS Modules 클래스 접근이 모두 `undefined`를 반환하여
DOM에 class가 붙지 않는 상태였다.

---

## 원인 분석

### 원인 1: Jest는 CSS를 파싱하지 못함

Jest는 브라우저 환경이 아니기 때문에 `.module.scss`를 import하면 CSS 문법을 해석하지 못하고
SyntaxError를 낸다. `moduleNameMapper` 등 별도 처리가 없으면 테스트 자체가 실행되지 않는다.

### 원인 2: `fileMock.ts`가 빈 문자열을 반환

기존에 일반 `.scss`용으로 사용하던 `fileMock.ts`는 `export default ""`를 반환한다.
`.module.scss`도 동일하게 매핑되면 `styles = ""` 이므로 `styles.bgMusicTrackItem` → `undefined`.

> 모든 scss 파일을 `.module.scss`로 전환한 후에는 `fileMock.ts` 자체가 불필요하다.

### 원인 3: ts-jest의 `__esModule` interop 처리

ts-jest는 `import styles from "...module.scss"`를 CommonJS로 변환할 때 아래처럼 처리한다.

```js
const _styles = require("./Component.module.scss");
const styles = _styles.__esModule ? _styles.default : _styles;
```

mock 객체(Proxy)에서 `__esModule` 키에 truthy 값이 반환되면 ts-jest가 이를 ES 모듈로 오인한다.
Proxy는 `"default"` 문자열을 반환하므로 `styles = "default"`가 되어
이후 모든 클래스 접근이 `undefined`가 된다.

### 원인 4: `identity-obj-proxy`도 동일한 문제 발생

`identity-obj-proxy`는 `__esModule` 키를 별도로 처리하지 않아
`proxy.__esModule` → `"__esModule"` (truthy 문자열)을 반환한다.
원인 3과 동일한 경로로 진입하여 `styles = "default"`가 된다.

---

## 해결 방법

### 1. `moduleNameMapper`에서 `.module.scss`만 커스텀 mock으로 매핑

모든 scss 파일이 `.module.scss`로 전환된 경우, `fileMock.ts`는 불필요하다.

```js
// jest.config.cjs
moduleNameMapper: {
  "\\.module\\.(css|scss)$": "<rootDir>/src/__mocks__/cssModuleMock.ts",
},
```

### 2. `__esModule`을 명시적으로 `false`로 처리하는 커스텀 mock

```ts
// src/__mocks__/cssModuleMock.ts
export default new Proxy(
  {} as Record<string | symbol, unknown>,
  {
    get(_target, key) {
      if (key === "__esModule") return false; // ts-jest interop 오작동 방지
      if (typeof key !== "string") return undefined;
      return key; // styles.bgMusicTrackItem → "bgMusicTrackItem"
    },
  }
);
```

`__esModule`을 `false`로 고정하여 ts-jest가 Proxy 객체 자체를 `styles`로 사용하게 한다.
이후 `styles.bgMusicTrackItem` → `"bgMusicTrackItem"`, `styles['bg-music-track-item--playing']` → `"bg-music-track-item--playing"`이 반환되어 DOM에 class가 정상적으로 붙는다.

### 3. 테스트 셀렉터를 컴포넌트 코드와 일치시킴

mock이 키를 그대로 반환하므로 테스트 셀렉터는 컴포넌트의 접근 방식을 따른다.

| 컴포넌트 코드 | mock 반환값 | 테스트 셀렉터 |
|---|---|---|
| `styles.bgMusicTrackItem` | `"bgMusicTrackItem"` | `.bgMusicTrackItem` |
| `styles.uploadProgressFill` | `"uploadProgressFill"` | `.uploadProgressFill` |
| `styles['bg-music-track-item--playing']` | `"bg-music-track-item--playing"` | `.bg-music-track-item--playing` |

BEM 수식자(`--`, `__`)는 camelCase 변환이 모호하므로 컴포넌트에서 bracket notation으로 접근하고,
테스트에서도 그대로 kebab-case 문자열로 사용한다.

---

## 결과

- `BgMusicPanel.test.tsx` 21개, `AnnouncementCard.test.tsx` 10개 전체 통과
- 프로덕션 코드의 camelCase 일관성 유지
- 외부 패키지(`identity-obj-proxy`) 의존 없이 커스텀 mock으로 해결
- 프로젝트 전체가 `.module.scss`로 전환되면 `fileMock.ts` 및 관련 `moduleNameMapper` 항목 제거 가능
