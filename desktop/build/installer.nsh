; Érettségi felkészítő – NSIS customisation for electron-builder (electron-builder.yml → nsis.include).
; Always install for the current user only: the "all users / only for me" page is skipped even on an
; administrator account, so the silent self-update ("Frissítés most" → /S --updated) never needs
; elevation and never shows a UAC prompt.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend
