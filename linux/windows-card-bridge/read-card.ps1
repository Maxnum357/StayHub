$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class ThaiCard {
 [DllImport("winscard.dll")] static extern int SCardEstablishContext(uint scope,IntPtr a,IntPtr b,out IntPtr ctx);
 [DllImport("winscard.dll",CharSet=CharSet.Unicode)] static extern int SCardListReaders(IntPtr ctx,string groups,byte[] readers,ref uint length);
 [DllImport("winscard.dll",CharSet=CharSet.Unicode)] static extern int SCardConnect(IntPtr ctx,string reader,uint share,uint protocols,out IntPtr card,out uint protocol);
 [DllImport("winscard.dll")] static extern int SCardDisconnect(IntPtr card,uint disposition);
 [DllImport("winscard.dll")] static extern int SCardReleaseContext(IntPtr ctx);
 [StructLayout(LayoutKind.Sequential)] struct PCI {public uint protocol;public uint length;}
 [DllImport("winscard.dll")] static extern int SCardTransmit(IntPtr card,ref PCI pci,byte[] send,uint length,IntPtr receivePCI,byte[] receive,ref uint receiveLength);
 static void Check(int result) {if(result!=0)throw new Exception("PCSC:"+unchecked((uint)result).ToString("X8"));}
 static byte[] Send(IntPtr card,uint protocol,byte[] command){
  PCI pci=new PCI{protocol=protocol,length=8};byte[] buffer=new byte[512];uint size=512;
  Check(SCardTransmit(card,ref pci,command,(uint)command.Length,IntPtr.Zero,buffer,ref size));
  if(size<2)throw new Exception("INVALID_RESPONSE");Array.Resize(ref buffer,(int)size);return buffer;
 }
 static byte[] Bytes(IntPtr card,uint protocol,int offset,int length){
  byte[] r=Send(card,protocol,new byte[]{0x80,0xB0,(byte)(offset>>8),(byte)offset,2,0,(byte)length});
  if(r[r.Length-2]==0x61){r=Send(card,protocol,new byte[]{0,0xC0,0,0,r[r.Length-1]});
   if(r[r.Length-2]!=0x90)r=Send(card,protocol,new byte[]{0,0xC0,0,1,(byte)length});}
  if(r[r.Length-2]!=0x90 || r[r.Length-1]!=0)throw new Exception("CARD_STATUS:"+BitConverter.ToString(r,r.Length-2));
  Array.Resize(ref r,r.Length-2);return r;
 }
 static string Field(IntPtr card,uint protocol,int offset,int length){return Encoding.GetEncoding(874).GetString(Bytes(card,protocol,offset,length)).Replace('#',' ').Trim();}
 static string Photo(IntPtr card,uint protocol){
  var bytes=new System.Collections.Generic.List<byte>();
  for(int i=0;i<20;i++){
   bytes.AddRange(Bytes(card,protocol,0x17B+i*255,255));
   for(int j=1;j<bytes.Count;j++)if(bytes[j-1]==0xFF&&bytes[j]==0xD9){
    byte[] image=bytes.GetRange(0,j+1).ToArray();if(image.Length<4||image[0]!=0xFF||image[1]!=0xD8)return "";return "data:image/jpeg;base64,"+Convert.ToBase64String(image);
   }
  }return "";
 }
 public static string[] Read(){
  IntPtr ctx=IntPtr.Zero,card=IntPtr.Zero;
  try{
   Check(SCardEstablishContext(0,IntPtr.Zero,IntPtr.Zero,out ctx));uint size=0;
   Check(SCardListReaders(ctx,null,null,ref size));byte[] readers=new byte[size*2];Check(SCardListReaders(ctx,null,readers,ref size));
   string[] names=Encoding.Unicode.GetString(readers).Split(new char[]{'\0'},StringSplitOptions.RemoveEmptyEntries);
   if(names.Length==0)throw new Exception("NO_READER");string name=names[0];foreach(string n in names)if(n.ToLower().Contains("feitian"))name=n;
   uint protocol;Check(SCardConnect(ctx,name,2,3,out card,out protocol));
   byte[] r=Send(card,protocol,new byte[]{0,0xA4,4,0,8,0xA0,0,0,0,0x54,0x48,0,1});
   if(r[r.Length-2]!=0x90 && r[r.Length-2]!=0x61)throw new Exception("NOT_THAI_ID");
   string[] values=new string[]{Field(card,protocol,4,13),Field(card,protocol,17,100),Field(card,protocol,0x1579,100),Field(card,protocol,0xD9,8),Field(card,protocol,0x167,8),Field(card,protocol,0x16F,8),""};
   try{values[6]=Photo(card,protocol);}catch{values[6]="";}return values;
  }finally{if(card!=IntPtr.Zero)SCardDisconnect(card,0);if(ctx!=IntPtr.Zero)SCardReleaseContext(ctx);}
 }
}
'@
function Convert-CardDate([string]$value) {
 if ($value -match '^\d{8}$') {
  $year = [int]$value.Substring(0,4) - 543
  $candidate = '{0:D4}-{1}-{2}' -f $year,$value.Substring(4,2),$value.Substring(6,2)
  $parsed = [datetime]::MinValue
  if ([datetime]::TryParseExact($candidate,'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$parsed)) {return $candidate}
 }
 return ''
}
try {
 $v=[ThaiCard]::Read()
 @{id=$v[0];name=$v[1];address=$v[2];birth=(Convert-CardDate $v[3]);issue=(Convert-CardDate $v[4]);expiry=(Convert-CardDate $v[5]);photo=$v[6]} | ConvertTo-Json -Compress
} catch {
 $detail=$_.Exception.ToString()
 $message='อ่านบัตรไม่สำเร็จ กรุณาถอดและเสียบบัตรใหม่'
 if($detail -match '8010000C|80100069'){ $message='ยังไม่มีบัตรในเครื่องอ่าน กรุณาเสียบบัตรประชาชน' }
 elseif($detail -match '8010000B'){ $message='เครื่องอ่านถูกใช้งานอยู่ กรุณาปิด SIAM-ID แล้วลองใหม่' }
 elseif($detail -match '8010002E|NO_READER'){ $message='ไม่พบเครื่องอ่านบัตร กรุณาตรวจสาย USB' }
 @{error=$message} | ConvertTo-Json -Compress
 exit 1
}
