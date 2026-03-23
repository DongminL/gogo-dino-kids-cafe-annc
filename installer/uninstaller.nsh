; Uninstall 시 AppData 삭제 여부를 사용자에게 묻는 커스텀 매크로

!macro customUnInstall
  ; 관리자 권한 실행 시 $APPDATA가 잘못 해석될 수 있으므로 레지스트리에서 직접 읽어옴
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders" "AppData"
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "앱 데이터(설정, 음악 파일 등)도 함께 삭제하시겠습니까?$\n$\n위치: $0\gogo-dino-annc$\n$\n'아니오'를 선택하면 앱 데이터는 보존됩니다." \
    IDNO +2
    RMDir /r "$0\gogo-dino-annc"
!macroend
