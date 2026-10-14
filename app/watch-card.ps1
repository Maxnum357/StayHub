param([int]$ServerPid)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;
public static class CardWindowTop {
 delegate bool EnumWindowCallback(IntPtr window,IntPtr parameter);
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowCallback callback,IntPtr parameter);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint processId);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr window,StringBuilder text,int count);
 [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr window,IntPtr after,int x,int y,int width,int height,uint flags);
 [DllImport("user32.dll")] static extern bool ShowWindowAsync(IntPtr window,int command);
 [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
 [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr window);
 public static int Pin(int[] processes,bool activate){
  var ids=new HashSet<int>(processes);int count=0;
  EnumWindows(delegate(IntPtr window,IntPtr parameter){
   uint pid;GetWindowThreadProcessId(window,out pid);
   if(!ids.Contains((int)pid)||!IsWindowVisible(window))return true;
   var title=new StringBuilder(512);GetWindowText(window,title,title.Capacity);
   if(title.ToString().IndexOf("Sanshine",StringComparison.OrdinalIgnoreCase)<0)return true;
   if(activate)ShowWindowAsync(window,9);
   if(SetWindowPos(window,new IntPtr(-1),0,0,0,0,0x0001|0x0002|(activate?0u:0x0010u)))count++;
   if(activate){BringWindowToTop(window);SetForegroundWindow(window);}
   return true;
  },IntPtr.Zero);return count;
 }
}
public static class CardPresence {
 [DllImport("winscard.dll")] static extern int SCardEstablishContext(uint scope,IntPtr a,IntPtr b,out IntPtr context);
 [DllImport("winscard.dll")] static extern int SCardReleaseContext(IntPtr context);
 [DllImport("winscard.dll",CharSet=CharSet.Unicode)] static extern int SCardListReaders(IntPtr context,string groups,byte[] names,ref uint length);
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct ReaderState {
  [MarshalAs(UnmanagedType.LPWStr)] public string name;
  public IntPtr user;public uint current;public uint events;public uint atrLength;
  [MarshalAs(UnmanagedType.ByValArray,SizeConst=36)] public byte[] atr;
 }
 [DllImport("winscard.dll",CharSet=CharSet.Unicode)] static extern int SCardGetStatusChange(IntPtr context,uint timeout,[In,Out] ReaderState[] states,uint count);
 // 1 = present, 0 = explicitly empty, -1 = unavailable/uncertain.
 public static int Presence(){
  IntPtr ctx=IntPtr.Zero;
  try {
   if(SCardEstablishContext(0,IntPtr.Zero,IntPtr.Zero,out ctx)!=0)return -1;
   uint size=0;if(SCardListReaders(ctx,null,null,ref size)!=0)return -1;
   byte[] bytes=new byte[size*2];if(SCardListReaders(ctx,null,bytes,ref size)!=0)return -1;
   string[] names=Encoding.Unicode.GetString(bytes).Split(new char[]{'\0'},StringSplitOptions.RemoveEmptyEntries);
   foreach(string name in names){if(name.IndexOf("feitian",StringComparison.OrdinalIgnoreCase)<0)continue;
    ReaderState[] states=new ReaderState[]{new ReaderState{name=name,atr=new byte[36]}};
    if(SCardGetStatusChange(ctx,0,states,1)!=0)return -1;
    if((states[0].events&0x20)!=0)return 1;
    if((states[0].events&0x10)!=0)return 0;
   }return -1;
  }finally{if(ctx!=IntPtr.Zero)SCardReleaseContext(ctx);}
 }
}
'@
$edgeCandidates=@(
 (Join-Path ${env:ProgramFiles(x86)} 'Microsoft/Edge/Application/msedge.exe'),
 (Join-Path $env:ProgramFiles 'Microsoft/Edge/Application/msedge.exe')
)
$edge=$edgeCandidates | Where-Object {Test-Path -LiteralPath $_} | Select-Object -First 1
$cardProfile=Join-Path $env:STAYHUB_DATA_DIR 'card-browser-profile'
$pinAttempts=0
$activateCardWindow=$false
$wasPresent=$false
$emptySamples=0
$cardWindowWasOpen=$false
function Get-CardProcessIds {
 $processes=@(Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object {$_.CommandLine -and $_.CommandLine.IndexOf($cardProfile,[StringComparison]::OrdinalIgnoreCase) -ge 0})
 return @($processes | ForEach-Object {[int]$_.ProcessId})
}
while(Get-Process -Id $ServerPid -ErrorAction SilentlyContinue){
 $windowIds=@(Get-CardProcessIds)
 $windowCount=0
 if($windowIds.Count -gt 0){$windowCount=[CardWindowTop]::Pin([int[]]$windowIds,$false)}
 if($windowCount -gt 0){$cardWindowWasOpen=$true}
 elseif($cardWindowWasOpen){
  try{
   $resetAccess=[IO.File]::ReadAllText((Join-Path $env:STAYHUB_DATA_DIR 'access-token')).Trim()
   Invoke-RestMethod -Uri 'http://localhost:8787/api/draft' -Method Delete -Headers @{'x-access-token'=$resetAccess} -TimeoutSec 3 | Out-Null
   $cardWindowWasOpen=$false
  }catch{}
 }
 $state=[CardPresence]::Presence()
 if($state -eq 0){
  $emptySamples++
  if($emptySamples -ge 3){$wasPresent=$false}
 }else{$emptySamples=0}
 if($state -eq 1 -and !$wasPresent){
  $wasPresent=$true
  $access=[IO.File]::ReadAllText((Join-Path $env:STAYHUB_DATA_DIR 'access-token')).Trim()
  # Insertion opens the form only. Google saving requires the Read Card button.
  $url='http://localhost:8787/?key='+$access+'&source=card'
  $existingIds=@(Get-CardProcessIds)
  $existingWindows=0
  if($existingIds.Count -gt 0){$existingWindows=[CardWindowTop]::Pin([int[]]$existingIds,$false)}
  # A visible or minimized app window remains reusable until it is closed.
  # The startup grace also avoids duplicate launches while Edge is loading.
  if($edge -and $existingWindows -eq 0 -and $pinAttempts -eq 0){
   $screen=[Windows.Forms.Screen]::PrimaryScreen.WorkingArea
   $width=[Math]::Min(1050,$screen.Width);$height=[Math]::Min(850,$screen.Height)
   $left=$screen.Left+[int](($screen.Width-$width)/2);$top=$screen.Top+[int](($screen.Height-$height)/2)
   Start-Process -FilePath $edge -ArgumentList @('--user-data-dir="'+$cardProfile+'"','--no-first-run','--app='+$url,'--window-size='+$width+','+$height,'--window-position='+$left+','+$top) -WindowStyle Normal
   $pinAttempts=20
   $activateCardWindow=$true
  }
 }
 if($pinAttempts -gt 0 -or $state -eq 1){
  if($pinAttempts -gt 0){$pinAttempts--}
  $cardProcessIds=@(Get-CardProcessIds)
  if($cardProcessIds.Count -gt 0){
   $pinned=[CardWindowTop]::Pin([int[]]$cardProcessIds,$activateCardWindow)
   if($pinned -gt 0){$activateCardWindow=$false}
  }
 }
 Start-Sleep -Milliseconds 700
}
