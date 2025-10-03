const { contextBridge, ipcRenderer } = require("electron");


contextBridge.exposeInMainWorld("adb", {
  run: (cmd) => ipcRenderer.invoke("run-adb", cmd),
  pair: (ipport, code) => ipcRenderer.invoke("adb-pair", ipport, code),
  connect: (ipport) => ipcRenderer.invoke("adb-connect", ipport),
  runCmd: (command) => ipcRenderer.invoke("run-cmd", command),
  pairConnect: (ipport, code) => ipcRenderer.invoke("adb-pair-connect", ipport, code),
  openFile: () => ipcRenderer.invoke("open-file"),
  installApk: (path) => ipcRenderer.invoke("adb-install-apk", path),
  uninstallPkg: (pkg) => ipcRenderer.invoke("adb-uninstall-pkg", pkg),
  startServer: () => ipcRenderer.invoke("adb-start-server"),
  killServer: () => ipcRenderer.invoke("adb-kill-server"),
  connect: (ipport) => ipcRenderer.invoke("adb-connect", ipport),
  devices: () => ipcRenderer.invoke("adb-devices"),
  disconnect: (target) => ipcRenderer.invoke("adb-disconnect", target),
  reboot: () => ipcRenderer.invoke("adb-reboot"),
  rotate: (mode) => ipcRenderer.invoke("adb-rotate", mode),
  removePackages: (packages) => ipcRenderer.invoke("adb-remove-packages", packages)
});
