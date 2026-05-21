const { app, BrowserWindow } = require('electron');        // imports electron core components
const path = require('path');                         // built-in module for file path manipulation
const fs = require('fs');                             // built-in module for interacting with the file system


// --- Environment Configuration ---
// When running as an EXE (packaged), we look for the .env file next to the EXE itself
const exeDir = path.dirname(process.execPath);        // gets the directory where the EXE is located
const envPath = app.isPackaged                         // checks if the app is currently packaged as an EXE
  ? path.join(exeDir, '.env')                         // joins EXE directory with .env
  : path.join(__dirname, '.env');                    // otherwise joins script directory with .env


if (fs.existsSync(envPath)) {                         // checks if the determined .env path exists
  require('dotenv').config({ path: envPath });        // loads the environment variables from the found .env
} else {
  require('dotenv').config();                         // fallback to default .env behavior
}





// Function to create the main application window
function createWindow() {
  const win = new BrowserWindow({                     // initializes a new browser window instance
    width: 1200,                                      // sets standard width
    height: 800,                                     // sets standard height
    title: 'eTicketing',                                // window title
    webPreferences: {
      nodeIntegration: false,                         // secure default: prevents node access in renderer
      contextIsolation: true,                         // secure default: isolates renderer from main process
    },
  });


  // Load the server URL from .env or fallback to localhost if not found
  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000'; 
  console.log(`🔗 Connecting to: ${serverUrl}`);     // logs the target URL for debugging


  win.loadURL(serverUrl).catch((err) => {             // attempts to load the web interface
    console.error('Failed to load URL:', err);        // logs the error if loading fails
    win.loadFile('error.html');                       // loads a local error page as a fallback
  });


  // Remove menu bar for a cleaner, modern app look
  win.setMenuBarVisibility(false);
}





// Lifecycle event: App is ready to create windows
app.whenReady().then(() => {
  createWindow();                                     // creates the initial window


  app.on('activate', () => {                          // handles MacOS specific activation behavior
    if (BrowserWindow.getAllWindows().length === 0) { // if no windows are currently open
      createWindow();                                 // create a new one
    }
  });
});





// Lifecycle event: Quit when all windows are closed (except on MacOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {                // checks if the platform is not MacOS
    app.quit();                                       // shuts down the application
  }
});

