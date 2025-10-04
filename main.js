const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { exec, spawn } = require("child_process");
const os = require("os");

let mainWindow;

// Helper to run shell commands
function runShell(command) {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(stdout || stderr);
    });
  });
}

// ✅ Corrected: Handles proper icon path for packaged apps
function createWindow() {
  const iconPath = path.join(process.resourcesPath, "assets", "icon.ico");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: app.isPackaged ? iconPath : path.join(__dirname, "assets/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer/index.html"));
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// -------------------- IPC Handlers --------------------

ipcMain.handle("run-adb", async (_, command) => runShell(`adb ${command}`));

ipcMain.handle("adb-pair", async (_, ipport, code) => {
  return new Promise((resolve, reject) => {
    try {
      const adb = spawn("adb", ["pair", ipport], { shell: true });

      let output = "";
      adb.stdout.on("data", (data) => { output += data.toString(); });
      adb.stderr.on("data", (data) => { output += data.toString(); });

      adb.stdin.write(code + "\n");

      adb.on("close", (codeExit) => {
        resolve(output || `adb pair exited with code ${codeExit}`);
      });
    } catch (err) {
      reject(err);
    }
  });
});

ipcMain.handle("open-file", async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "APK Files", extensions: ["apk"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });
  if (res.canceled) return null;
  return res.filePaths[0];
});

// ADB helpers
ipcMain.handle("adb-install-apk", async (_, apkPath) => runShell(`adb install "${apkPath}"`));
ipcMain.handle("adb-uninstall-pkg", async (_, pkg) => runShell(`adb shell pm uninstall --user 0 ${pkg}`));
ipcMain.handle("adb-start-server", async () => runShell("adb start-server"));
ipcMain.handle("adb-kill-server", async () => runShell("adb kill-server"));
ipcMain.handle("adb-connect", async (_, ipport) => runShell(`adb connect ${ipport}`));
ipcMain.handle("adb-devices", async () => runShell("adb devices -l"));
ipcMain.handle("adb-disconnect", async (_, target) => runShell(`adb disconnect ${target}`));
ipcMain.handle("adb-reboot", async () => runShell("adb reboot"));
ipcMain.handle("adb-rotate", async (_, mode) => runShell(`adb shell settings put system accelerometer_rotation 0 && adb shell settings put system user_rotation ${mode}`));

ipcMain.handle("adb-remove-packages", async (_, packages) => {
  const results = {};
  for (const pkg of packages) {
    try { results[pkg] = await runShell(`adb shell pm uninstall --user 0 ${pkg}`); }
    catch (e) { results[pkg] = `ERROR: ${String(e)}`; }
  }
  return results;
});

// Optional: full pair+connect flow
ipcMain.handle("adb-pair-connect", async (_, ipport, code) => {
  try {
    const pairCmd = os.platform() === "win32" ? `cmd /c "echo ${code} | adb pair ${ipport}"` : `echo ${code} | adb pair ${ipport}`;
    const pairOut = await runShell(pairCmd);

    const re = /((?:\d{1,3}\.){3}\d{1,3}:\d{1,5})/g;
    let match, connectTarget = null;
    while ((match = re.exec(pairOut)) !== null) connectTarget = match[1];

    if (!connectTarget) {
      const ipOnly = ipport.split(":")[0];
      try { await runShell(`adb connect ${ipOnly}`); } catch {}
    } else {
      await runShell(`adb connect ${connectTarget}`);
    }

    const devicesTxt = await runShell("adb devices -l");
    const ipPrefix = ipport.split(":")[0];
    const devRe = new RegExp(`((?:${ipPrefix.replace(/\./g,"\\.")}:\\d{1,5}))`,"g");
    let found = null;
    while ((match = devRe.exec(devicesTxt)) !== null) found = match[1];

    const lines = devicesTxt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const disconnected = [];
    for (const line of lines.slice(1)) {
      const token = line.split(/\s+/)[0];
      if (token && token.startsWith("adb-") && (!found || !token.includes(found.split(":")[1]))) {
        try { await runShell(`adb disconnect "${token}"`); disconnected.push(token); } catch {}
      }
    }

    const finalDevices = await runShell("adb devices -l");
    return { ok: true, pairOut, connectTarget: connectTarget || found || null, disconnected, devices: finalDevices };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle("run-cmd", async (_, command) => {
  try {
    return await runShell(os.platform() === "win32" ? `cmd /c "${command.replace(/"/g,'\\"')}"` : command);
  } catch (e) {
    return `ERROR: ${String(e)}`;
  }
});
