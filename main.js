const { app, BrowserWindow, session } = require("electron");

function createWindow() {
  const win = new BrowserWindow({
    width: 350,
    height: 350,
    transparent: true,     // Makes the background invisible
    frame: false,          // Removes title bar and borders
    alwaysOnTop: true,     // Keeps your avatar above other windows
    hasShadow: false,      // Prevents OS drop-shadow artifacts on transparent edges
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Automatically allow microphone access without a popup prompt
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === "media") {
      callback(true);
    } else {
      callback(false);
    }
  });

  win.loadFile("index.html");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});