import { app, ipcMain, session, shell } from 'electron';
import * as path from 'path';
import checkSanity from '../shared/checkSanity';
import { AppConfigApi } from '../shared/config/AppConfigApi';
import { AppConfig } from '../shared/config/AppConfigFile';
import { IAppConfigApiFetchData, IAppConfigData } from '../shared/config/interfaces';
import { ILogPreEntry } from '../shared/Log/interface';
import { LogMainApi } from '../shared/Log/LogMainApi';
import BackgroundServices from './background/BackgroundServices';
import MainWindow from './MainWindow';
import { AppPreferencesMain } from './preferences/AppPreferencesMain';
import * as Util from './Util';

export class Main {
  private _mainWindow: MainWindow = new MainWindow(this);
  private _backgroundServices?: BackgroundServices;
  private _config?: IAppConfigData;
  private _preferences: AppPreferencesMain = new AppPreferencesMain();
  private _log: LogMainApi = new LogMainApi(this.sendToMainWindowRenderer.bind(this));

  public get config(): IAppConfigData {
    if (!this._config) { throw new Error('You must not try to access config before it is loaded!'); }
    return this._config;
  }

  public get preferences(): AppPreferencesMain {
    return this._preferences;
  }

  constructor() {
    // Add app event listeners
    app.once('ready', this.onAppReady.bind(this));
    app.once('window-all-closed', this.onAppWindowAllClosed.bind(this));
    app.once('will-quit', this.onAppWillQuit.bind(this));
    app.once('web-contents-created', this.onAppWebContentsCreated.bind(this));
    // Add IPC event listeners
    ipcMain.on(AppConfigApi.ipcRequestSync, this.onGetConfigSync.bind(this));
    this._log.bindListeners();
    // Connect preferences to log
    this._preferences.on('log', this.pushLogData.bind(this));
    // Load config and preferences
    this.loadConfig()
    .then(async () => { await this._preferences.load(); })
    .then(async () => {
      // Check if we are ready to launch or not.
      // @TODO Launch the setup wizard when a check failed.
      checkSanity(this.config)
      .then(console.log, console.error);
      // Start background services
      this._backgroundServices = new BackgroundServices();
      this._backgroundServices.on('output', this.pushLogData.bind(this));
      this._backgroundServices.start(this.config);
      // Create main window when ready
      this._backgroundServices.waitUntilDoneStarting()
      .then(Util.waitUntilReady)
      .then(() => { this._mainWindow.createWindow(); });
    })
    .catch(console.error);
  }

  private onAppReady(): void {
    if (!session.defaultSession) {
      throw new Error('Default session is missing!');
    }
    // Reject all permission requests since we don't need any permissions.
    session.defaultSession.setPermissionRequestHandler(
      (webContents, permission, callback) => callback(false)
    );
    // Stop non-local resources from being fetched (as long as their response has at least one header?)
    // Only allow local scripts to execute (Not sure what this allows? "file://"? "localhost"?)
    // (TypeScript type information is missing, check the link below for the type info)
    // https://github.com/electron/electron/blob/master/docs/api/web-request.md#webrequestonheadersreceivedfilter-listener
    session.defaultSession.webRequest.onHeadersReceived(
      (details: any, callback: Function) => callback({
        responseHeaders: `script-src 'self'`,
        cancel: true
      })
    );
  }

  private onAppWindowAllClosed(): void {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }

  private onAppWillQuit(): void {
    if (this._backgroundServices) {
      this._backgroundServices.stop();
    }
  }
  
  private onAppWebContentsCreated(event: Electron.Event, webContents: Electron.WebContents): void {
    // Open links to web pages in the OS-es default browser
    // (instead of navigating to it with the electron window that opened it)
    webContents.on('will-navigate', (event, navigationUrl) => {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    });
  }

  /**
   * Append the output to the internal log data object and tell the main window
   * about the updated log data. The main window will display the log data in
   * the "Logs" tab. Also print the output to stdout.
   * @param output The log entry to be added. Must end with a new line.
   */
  private pushLogData(output: ILogPreEntry): void {
    //process.stdout.write(output);
    this._log.addEntry(output);
  }

  /** Load the application config asynchronously */
  private async loadConfig(): Promise<void> {
    let error: Error|undefined;
    let data: IAppConfigData|undefined;
    const onError = (e: string) => this.pushLogData({ source: 'Config', content: e });
    try {
      data = await AppConfig.readConfigFile(onError);
    } catch(e) { error = e; }
    // Check if config data failed to load
    if (error || !data) {
      // Set the config data to the default
      data = AppConfig.createCopyOfDefaults(process.platform);
      // Create a new config file with the default configs
      AppConfig.saveConfigFile(data);
    }
    // Set config data
    this._config = data;
    console.log('Configs:', data);
  }

  /** Get the config object synchronously */
  private onGetConfigSync(event: Electron.IpcMessageEvent): void {
    const data: IAppConfigApiFetchData = {
      data: this.config,
      fullFlashpointPath: path.resolve(this.config.flashpointPath),
    };
    event.returnValue = data;
  }

  /** Send a message to the main windows renderer */
  private sendToMainWindowRenderer(channel: string , ...rest: any[]): boolean {
    if (!this._mainWindow.window) { return false;}
    this._mainWindow.window.webContents.send(channel, ...rest);
    return true;
  }
}
