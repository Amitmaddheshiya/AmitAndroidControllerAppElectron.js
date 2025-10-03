// renderer.js - communicates with preload's adb API and updates UI
const out = (text)=> { document.getElementById("output").textContent = text; }
const setDevicesHTML = (txt)=> { document.getElementById("devices").innerHTML = txt; }
const terminal = document.getElementById("terminal");
const terminalInput = document.getElementById("terminalInput");


async function run(cmd) {
  out("Running: adb " + cmd + "\n\nPlease wait...");
  try {
    const res = await window.adb.run(cmd);
    out(res || "(no output)");
    return res;
  } catch (e) {
    out("ERROR:\n" + String(e));
    return null;
  }
}

async function startServer(){ out("Starting adb server..."); const r=await window.adb.startServer(); out(r); }
async function killServer(){ out("Killing adb server..."); const r=await window.adb.killServer(); out(r); }

async function pair(){
  const ip = document.getElementById("ipPort").value.trim();
  const code = document.getElementById("pairCode").value.trim();
  if(!ip || !code){ out("Enter IP:PORT and pairing code first."); return; }
  out(`Pairing with ${ip} using code ${code}...`);
  try {
    const res = await window.adb.pair(ip, code);
    out(res);
  } catch(e){ out("Pair ERROR:\n"+String(e)); }
}

async function doPair() {
  const ip = document.getElementById("ip").value.trim();
  const port = document.getElementById("pairPort").value.trim();
  const code = document.getElementById("pairCode").value.trim();
  if (!ip || !port || !code) {
    out("Enter IP, Port and Pair Code!");
    return;
  }
  out(`Pairing with ${ip}:${port} ...`);
  try {
    const res = await window.adb.pair(`${ip}:${port}`, code);
    out(res);
  } catch (e) {
    out("Pair ERROR:\n" + e);
  }
}


async function connect(){
  const ip = document.getElementById("ipPort").value.trim();
  if(!ip){ out("Enter IP:PORT first."); return; }
  out("Connecting to " + ip + " ...");
  try {
    const r = await window.adb.connect(ip);
    out(r);
    await refreshDevices();
  } catch(e){ out("Connect ERROR:\n"+String(e)); }
}

async function refreshDevices(){
  out("Fetching devices...");
  try {
    const txt = await window.adb.devices();
    const lines = txt.split("\n").filter(Boolean);

    // पहली लाइन "List of devices attached" हटाओ
    const list = lines.slice(1).map(l => {
      const parts = l.trim().split(/\s+/); 
      // अगर कम से कम 2 पार्ट्स हैं तभी दिखाओ
      if(parts.length >= 2){
        return `<div style="padding:6px;border-bottom:1px solid #eef2f6">
                  <strong>${escapeHtml(parts[0] + " " + parts[1])}</strong>
                </div>`;
      }
      return ""; // वरना empty string
    }).join("");

    setDevicesHTML(list || "<div class='muted'>No devices</div>");
    out(txt);
  } catch(e){ 
    out("devices ERROR:\n"+String(e)); 
  }
}


async function disconnect(){
  const t = document.getElementById("disconnectTarget").value.trim();
  if(!t){ out("Enter target to disconnect (e.g. ip:port or long target)."); return; }
  out("Disconnecting " + t + " ...");
  try {
    const r = await window.adb.disconnect(t);
    out(r);
    await refreshDevices();
  } catch(e){ out("disconnect ERROR:\n"+String(e)); }
}

async function chooseApk(){
  const p = await window.adb.openFile();
  if(!p){ out("No file chosen."); return; }
  document.getElementById("apkPath").value = p;
  out("Selected: " + p);
}

async function installApk(){
  const p = document.getElementById("apkPath").value.trim();
  if(!p){ out("Choose an APK first."); return; }
  out("Installing APK: " + p + "\nThis may take a while...");
  try {
    const r = await window.adb.installApk(p);
    out(r);
    await refreshDevices();
  } catch(e){ out("install ERROR:\n"+String(e)); }
}

async function uninstallPkg(){
  const pkg = document.getElementById("pkg").value.trim();
  if(!pkg){ out("Enter package name to uninstall."); return; }
  out("Uninstalling: " + pkg + " ...");
  try {
    const r = await window.adb.uninstallPkg(pkg);
    out(r);
    await refreshDevices();
  } catch(e){ out("uninstall ERROR:\n"+String(e)); }
}

async function rotate(mode){
  out("Setting rotation mode: " + mode);
  try {
    const r = await window.adb.rotate(mode);
    out(r);
  } catch(e){ out("rotate ERROR:\n"+String(e)); }
}

async function reboot(){
  out("Rebooting device...");
  try {
    const r = await window.adb.reboot();
    out(r);
  } catch(e){ out("reboot ERROR:\n"+String(e)); }
}

async function removeBloat(){
  const text = document.getElementById("bloat").value.trim();
  if(!text){ out("Enter package names separated by commas."); return; }
  const packages = text.split(",").map(s=>s.trim()).filter(Boolean);
  out("Removing packages: " + packages.join(", "));
  try {
    const res = await window.adb.removePackages(packages);
    out(JSON.stringify(res, null, 2));
    await refreshDevices();
  } catch(e){ out("remove ERROR:\n"+String(e)); }
}

// small helper
function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// auto refresh on load
refreshDevices();


async function pairConnect(){
  const ip = document.getElementById("ipPort").value.trim();
  const code = document.getElementById("pairCode").value.trim();
  if(!ip || !code){ out("Enter IP:PORT and pairing code first."); return; }
  out(`Pairing+AutoConnect with ${ip} using code ${code}...`);
  try {
    const res = await window.adb.pairConnect(ip, code);
    if(!res) { out("No response from pairConnect."); return; }
    if(res.ok){
      let msg = "Pair result:\\n" + (res.pairOut || "(no pair output)") + "\\n";
      msg += "ConnectTarget: " + (res.connectTarget || "not found") + "\\n";
      if(res.disconnected && res.disconnected.length) msg += "Disconnected: " + res.disconnected.join(", ") + "\\n";
      msg += "\\nFinal devices:\\n" + (res.devices || "");
      out(msg);
      await refreshDevices();
    } else {
      out("PairConnect ERROR:\\n" + (res.error || "unknown error"));
    }
  } catch(e){ out("pairConnect ERROR:\\n"+String(e)); }
}


terminalInput.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const cmd = terminalInput.value.trim();
    if (!cmd) return;
    printToTerminal("> " + cmd);

    try {
      const res = await window.adb.runCmd(cmd);
      printToTerminal(res.stdout || res.stderr || String(res));
    } catch (err) {
      printToTerminal("ERROR: " + err.message);
    }
    terminalInput.value = "";
  }
});

function printToTerminal(text) {
  const div = document.createElement("div");
  div.textContent = text;
  terminal.appendChild(div);
  terminal.scrollTop = terminal.scrollHeight; // auto-scroll
}
// === Built-in CMD terminal functions ===
async function runCmd(){
  const cmd = document.getElementById("cmdInput").value.trim();
  if(!cmd){ out("Enter a command to run (e.g. adb devices -l)"); return; }
  out("Running command: " + cmd + "\n\nPlease wait...");
  try {
    const res = await window.adb.runCmd(cmd);
    // res may be string or object depending on main runShell
    out(String(res));
    await refreshDevices();
  } catch(e){ out("runCmd ERROR:\n"+String(e)); }
}

async function runCmdMulti(){
  const txt = document.getElementById("cmdMulti").value.trim();
  if(!txt){ out("Enter commands to run."); return; }
  out("Running multi-line commands...\n");
  try {
    // run as a single shell command (newlines will be passed to shell)
    const res = await window.adb.runCmd(txt);
    out(String(res));
    await refreshDevices();
  } catch(e){ out("runCmdMulti ERROR:\n"+String(e)); }
}
// === end terminal functions ===

