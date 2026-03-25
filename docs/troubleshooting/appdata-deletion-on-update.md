# 업데이트 시 AppData 삭제 문구가 표시되는 문제

## 문제 상황

- 앱을 새 버전으로 업데이트했을 때 "앱 데이터를 삭제하시겠습니까?" 메시지 박스가 표시된다.
- 언인스톨이 아닌 업데이트임에도 불구하고 삭제 여부를 묻는 문구가 나타난다.

## 원인 분석

### NSIS 업데이트 방식

electron-builder의 NSIS 인스톨러는 업데이트 시 다음 순서로 동작한다.

1. 새 버전 인스톨러 실행
2. 기존 버전이 감지되면 **기존 uninstaller를 `/S /KEEP_APP_DATA --updated` 플래그로 실행**하여 이전 버전 제거
3. 새 버전 설치

이 과정에서 `customUnInstall` 매크로가 호출된다.

관련 코드: `node_modules/app-builder-lib/templates/nsis/include/installUtil.nsh`

```nsis
; isDeleteAppData가 false인 경우 항상 --updated 플래그를 전달
StrCpy $0 "$0 --updated"
...
ExecWait '"$uninstallerFileNameTemp" /S /KEEP_APP_DATA $0 _?=$installationDir' $R0
```

### `IfSilent` 미작동 문제

초기 해결책으로 NSIS의 `IfSilent` 명령어를 사용하여 silent 모드 여부로 업데이트를 감지하려 했으나, NSIS가 일부 상황에서 silent mode를 올바르게 인식하지 못해 다이얼로그가 여전히 표시되는 문제가 남아 있었다.

## 해결 방법

`IfSilent` 대신 업데이트 시 **항상** 전달되는 `--updated` 플래그를 명시적으로 확인하는 방식으로 수정한다.

`installer/uninstaller.nsh`:

```nsh
!macro customUnInstall
  ; 업데이트 여부 확인 (새 버전 설치 시 항상 --updated 플래그가 전달됨)
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "--updated" $R1
  ${IfNot} ${Errors}
    Goto skipAppDataDialog
  ${EndIf}
  ; 관리자 권한 실행 시 $APPDATA가 잘못 해석될 수 있으므로 레지스트리에서 직접 읽어옴
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders" "AppData"
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "앱 데이터(설정, 음악 파일 등)도 함께 삭제하시겠습니까?$\n$\n위치: $0\gogo-dino-annc$\n$\n'아니오'를 선택하면 앱 데이터는 보존됩니다." \
    IDNO skipAppDataDialog
    RMDir /r "$0\gogo-dino-annc"
  skipAppDataDialog:
!macroend
```

### 동작 흐름

| 실행 컨텍스트 | `--updated` 여부 | 결과 |
|---|---|---|
| 업데이트 (인스톨러가 호출) | 포함 | `skipAppDataDialog`로 이동 → AppData 삭제 안 함 |
| 순수 언인스톨 (제어판에서 삭제) | 미포함 | 메시지 박스 표시 → 사용자 선택에 따라 삭제 |
