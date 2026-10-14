using System;
using System.IO;
using System.Diagnostics;
using System.Threading;
using System.Windows.Forms;
using System.Net;
using System.Drawing;
class StayHub : ApplicationContext {
 string root=AppDomain.CurrentDomain.BaseDirectory;
 string data=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"StayHub","data");
 Process server; NotifyIcon tray; string access,admin; bool closing=false;
 [STAThread] static void Main(string[] args) {
  if(args.Length>0&&args[0]=="--make-icon"){using(var b=new Bitmap(256,256))using(var g=Graphics.FromImage(b)){g.Clear(Color.FromArgb(16,43,70));using(var f=new Font("Arial",130,FontStyle.Bold)){g.DrawString("H",f,Brushes.White,new PointF(20,20));}using(var ico=Icon.FromHandle(b.GetHicon()))using(var s=File.Create(args[1]))ico.Save(s);}return;}
  Application.EnableVisualStyles();try{Application.Run(new StayHub());}catch(Exception e){MessageBox.Show(e.Message,"StayHub",MessageBoxButtons.OK,MessageBoxIcon.Error);}
 }
 bool Ping(){try{var req=WebRequest.Create("http://127.0.0.1:8787/api/setup/ping?admin="+admin);req.Timeout=600;using(var r=req.GetResponse())return true;}catch{return false;}}
 public StayHub(){
  Directory.CreateDirectory(data);string adminFile=Path.Combine(data,"setup-key");if(File.Exists(adminFile))admin=File.ReadAllText(adminFile).Trim();
  if(!Ping()){
   var p=new ProcessStartInfo(Path.Combine(root,"runtime","node.exe"),"\""+Path.Combine(root,"app","server.js")+"\"");p.WorkingDirectory=Path.Combine(root,"app");p.UseShellExecute=false;p.CreateNoWindow=true;p.EnvironmentVariables["STAYHUB_DATA_DIR"]=data;
   server=Process.Start(p);
   for(int i=0;i<60;i++){Thread.Sleep(150);if(server.HasExited)throw new Exception("ไม่สามารถเปิดเซิร์ฟเวอร์ StayHub ได้ อาจมีโปรแกรมอื่นใช้พอร์ต 8787 อยู่ กรุณาปิดโปรแกรมนั้นแล้วเปิด StayHub ใหม่");if(File.Exists(adminFile)){admin=File.ReadAllText(adminFile).Trim();if(Ping())break;}}
   if(!Ping())throw new Exception("StayHub ยังไม่พร้อม กรุณาลองเปิดอีกครั้ง");
  }
  access=File.ReadAllText(Path.Combine(data,"access-token")).Trim();
  if(server==null){Open(!File.Exists(Path.Combine(data,"settings.json")));ExitThread();return;}
  tray=new NotifyIcon();tray.Icon=new Icon(Path.Combine(root,"StayHub.ico"));tray.Text="StayHub · running";
  var menu=new ContextMenuStrip();menu.Items.Add("Open StayHub",null,(s,e)=>Open(false));menu.Items.Add("Settings",null,(s,e)=>Open(true));menu.Items.Add("Data folder",null,(s,e)=>Process.Start("explorer.exe",data));menu.Items.Add("Exit StayHub",null,(s,e)=>ExitThread());tray.ContextMenuStrip=menu;tray.DoubleClick+=(s,e)=>Open(false);tray.Visible=true;Open(!File.Exists(Path.Combine(data,"settings.json")));
 }
 void Open(bool setup){string url="http://127.0.0.1:8787/"+(setup?"setup?admin="+admin:"?key="+access);Process.Start(new ProcessStartInfo(url){UseShellExecute=true});}
 protected override void ExitThreadCore(){if(closing)return;closing=true;if(tray!=null){tray.Visible=false;tray.Dispose();}if(server!=null){try{Process.Start(new ProcessStartInfo("taskkill.exe","/PID "+server.Id+" /T /F"){UseShellExecute=false,CreateNoWindow=true}).WaitForExit();}catch{}}base.ExitThreadCore();}
}
