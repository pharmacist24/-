; Extra Start-menu shortcut: starts RxDesk with graphics acceleration off (for PCs whose graphics driver
; shows a white window). RxDesk remembers the choice on that PC.
!macro customInstall
  CreateShortCut "$SMPROGRAMS\RxDesk (safe mode).lnk" "$INSTDIR\RxDesk.exe" "--safe-graphics" "$INSTDIR\RxDesk.exe" 0
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\RxDesk (safe mode).lnk"
!macroend
