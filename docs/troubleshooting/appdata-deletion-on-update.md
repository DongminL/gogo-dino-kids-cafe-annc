# 업데이트 시 AppData 삭제 문구가 표시되는 문제

## 문제 상황

- 앱을 새 버전으로 업데이트했을 때 "앱 데이터를 삭제하시겠습니까?" 메시지 박스가 표시된다.
- 언인스톨이 아닌 업데이트임에도 불구하고 삭제 여부를 묻는 문구가 나타난다.

## 원인 분석

### NSIS 업데이트 방식

electron-builder의 NSIS 인스톨러는 업데이트 시 다음 순서로 동작한다.

1. 새 버전 인스톨러 실행
2. 기존 버전이 감지되면 **기존 uninstaller를 `/S` (silent) 플래그 없이 실행**하여 이전 버전 제거
3. 새 버전 설치

이 과정에서 `customUnInstall` 매크로가 호출된다.

### `customUnInstallBeforeInstall` 미지원

초기 시도로 electron-builder의 `customUnInstallBeforeInstall` 매크로를 정의하여 업데이트 시 분기하려 했으나, 해당 매크로는 실제로 지원되지 않아 효과가 없었다.

## 해결 방법

업데이트 시 electron-builder는 uninstaller를 `/S` (silent) 모드로 실행한다. NSIS의 `IfSilent` 명령어로 silent 모드 여부를 감지하여 AppData 삭제 로직을 건너뛰도록 수정한다.

`installer/uninstaller.nsh`:

```nsh
!macro customUnInstall
  ; silent 모드(업데이트)이면 AppData 삭제 없이 종료
  IfSilent done
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders" "AppData"
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "앱 데이터(설정, 음악 파일 등)도 함께 삭제하시겠습니까?$\n$\n위치: $0\gogo-dino-annc$\n$\n'아니오'를 선택하면 앱 데이터는 보존됩니다." \
    IDNO done
    RMDir /r "$0\gogo-dino-annc"
  done:
!macroend
```

### 동작 흐름

| 실행 컨텍스트 | Silent 여부 | 결과 |
|---|---|---|
| 업데이트 (인스톨러가 호출) | `/S` → silent | `IfSilent done` → AppData 삭제 안 함 |
| 순수 언인스톨 (제어판에서 삭제) | non-silent | 메시지 박스 표시 → 사용자 선택에 따라 삭제 |
