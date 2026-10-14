Unicode true
!include "MUI2.nsh"
!include "x64.nsh"
Name "StayHub"
OutFile "StayHub-Setup-1.0.0.exe"
InstallDir "$LOCALAPPDATA\Programs\StayHub"
RequestExecutionLevel user
SetCompressor /SOLID zlib
!define MUI_ICON "StayHub.ico"
!define MUI_UNICON "StayHub.ico"
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\StayHub.exe"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
Function .onInit
 ${IfNot} ${RunningX64}
  MessageBox MB_ICONSTOP "StayHub requires Windows 10/11 64-bit."
  Abort
 ${EndIf}
FunctionEnd
Section "StayHub" SEC_MAIN
 SetOutPath "$INSTDIR"
 File "StayHub.exe"
 File "StayHub.ico"
 File "LICENSE.txt"
 File "README-th.txt"
 File "Allow-Private-Network.cmd"
 File /r "runtime"
 File /r "app"
 WriteUninstaller "$INSTDIR\Uninstall.exe"
 IfSilent no_links
 CreateDirectory "$SMPROGRAMS\StayHub"
 CreateShortcut "$SMPROGRAMS\StayHub\StayHub.lnk" "$INSTDIR\StayHub.exe" "" "$INSTDIR\StayHub.ico"
 CreateShortcut "$DESKTOP\StayHub.lnk" "$INSTDIR\StayHub.exe" "" "$INSTDIR\StayHub.ico"
 CreateShortcut "$SMPROGRAMS\StayHub\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\StayHub" "DisplayName" "StayHub"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\StayHub" "DisplayVersion" "1.0.0"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\StayHub" "UninstallString" '"$INSTDIR\Uninstall.exe"'
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\StayHub" "DisplayIcon" "$INSTDIR\StayHub.ico"
 no_links:
SectionEnd
Section "Uninstall"
 IfSilent proceed
 MessageBox MB_OKCANCEL "Close StayHub from the system tray before uninstalling. Your data will be preserved." IDOK proceed
 Abort
 proceed:
 IfSilent skip_links
 Delete "$DESKTOP\StayHub.lnk"
 RMDir /r "$SMPROGRAMS\StayHub"
 DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\StayHub"
 skip_links:
 Delete "$INSTDIR\StayHub.exe"
 Delete "$INSTDIR\StayHub.ico"
 Delete "$INSTDIR\LICENSE.txt"
 Delete "$INSTDIR\README-th.txt"
 Delete "$INSTDIR\Allow-Private-Network.cmd"
 RMDir /r "$INSTDIR\runtime"
 RMDir /r "$INSTDIR\app"
 Delete "$INSTDIR\Uninstall.exe"
 RMDir "$INSTDIR"
SectionEnd
