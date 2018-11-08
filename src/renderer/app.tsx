import { ipcRenderer } from 'electron';
import * as React from 'react';
import { AppRouter, IAppRouterProps } from './router';
import { Redirect } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ISearchOnSearchEvent } from './components/Search';
import { TitleBar } from './components/TitleBar';
import { ICentralState } from './interfaces';
import * as AppConstants from '../shared/AppConstants';
import { IGameOrderChangeEvent } from './components/GameOrder';
import { Paths } from './Paths';
import { BrowsePageLayout } from '../shared/BrowsePageLayout';
import { GameImageCollection } from './image/GameImageCollection';
import { GamePlaylistManager } from './playlist/GamePlaylistManager';
import GameManager from './game/GameManager';
import { IGameInfo } from 'src/shared/game/interfaces';
import { IGamePlaylist } from './playlist/interfaces';

export interface IAppProps {
  history?: any;
}
export interface IAppState {
  central: ICentralState;
  search?: ISearchOnSearchEvent;
  order?: IGameOrderChangeEvent;
  logData: string;
  /** Scale of games at the browse page */
  gameScale: number;
  /** Layout of the browse page */
  gameLayout: BrowsePageLayout;
  /** Currently selected game (if any) */
  selectedGame?: IGameInfo;
  /** Currently selected playlist (if any) */
  selectedPlaylist?: IGamePlaylist;
  /** If the "New Game" button was clicked (silly way of passing the event from the footer the the browse page) */
  wasNewGameClicked: boolean;
}

export class App extends React.Component<IAppProps, IAppState> {
  private _onSearch: boolean = false;

  constructor(props: IAppProps) {
    super(props);
    // Normal constructor stuff
    const preferences = window.External.preferences;
    const config = window.External.config;
    this.state = {
      central: {
        games: new GameManager(),
        gameImages: new GameImageCollection(config.fullFlashpointPath),
        playlists: new GamePlaylistManager(),
        gamesDoneLoading: false,
        gamesFailedLoading: false,
        playlistsDoneLoading: false,
        playlistsFailedLoading: false,
      },
      logData: '',
      gameScale: preferences.data.browsePageGameScale,
      gameLayout: preferences.data.browsePageLayout,
      wasNewGameClicked: false,
    };
    this.onSearch = this.onSearch.bind(this);
    this.onOrderChange = this.onOrderChange.bind(this);
    this.onScaleSliderChange = this.onScaleSliderChange.bind(this);
    this.onLayoutSelectorChange = this.onLayoutSelectorChange.bind(this);
    this.onNewGameClick = this.onNewGameClick.bind(this);
    this.onLogDataUpdate = this.onLogDataUpdate.bind(this);
    this.onToggleLeftSidebarClick = this.onToggleLeftSidebarClick.bind(this);
    this.onToggleRightSidebarClick = this.onToggleRightSidebarClick.bind(this);
    this.onSelectGame = this.onSelectGame.bind(this);
    this.onSelectPlaylist = this.onSelectPlaylist.bind(this);
    // Initialize app
    this.init();
  }

  init() {
    // Listen for the window to move or resize (and update the preferences when it does)
    ipcRenderer.on('window-move', function(sender: any, x: number, y: number) {
      const mw = window.External.preferences.data.mainWindow;
      mw.x = x | 0;
      mw.y = y | 0;
    });
    ipcRenderer.on('window-resize', function(sender: any, width: number, height: number) {
      const mw = window.External.preferences.data.mainWindow;
      mw.width  = width  | 0;
      mw.height = height | 0;
    });
    // Load Playlists
    this.state.central.playlists.load()
    .catch((err) => {
      this.setState({
        central: Object.assign({}, this.state.central, {
          playlistsDoneLoading: true,
          playlistsFailedLoading: true,
        })
      });
      window.External.appendLogData(err.toString());
      throw err;
    })
    .then(() => {
      this.setState({
        central: Object.assign({}, this.state.central, {
          playlistsDoneLoading: true,
        })
      });
    });
    // Fetch LaunchBox game data from the xml
    this.state.central.games.findPlatforms()
    .then((filenames) => {
      // Prepare images
      const platforms: string[] = filenames.map((platform) => platform.split('.')[0]); // ('Flash.xml' => 'Flash')
      this.state.central.gameImages.addPlatforms(platforms);
      // Load and parse platform XMLs
      this.state.central.games.loadPlatforms()
      .then(() => {
        this.setState({
          central: Object.assign({}, this.state.central, {
            gamesDoneLoading: true,
          })
        });
      })
      .catch((error) => {
        console.error(error);
        this.setState({
          central: Object.assign({}, this.state.central, {
            gamesDoneLoading: true,
            gamesFailedLoading: true,
          })
        });
      });
    })
    .catch((error) => {
      console.error(error);
      this.setState({
        central: Object.assign({}, this.state.central, {
          gamesDoneLoading: true,
          gamesFailedLoading: true,
        })
      });
    });
  }

  componentDidMount() {
    ipcRenderer.on('log-data-update', this.onLogDataUpdate);

    // Ask main to send us our first log-data-update msg.
    window.External.resendLogDataUpdate();
  }

  componentWillUnmount() {
    ipcRenderer.removeListener('log-data-update', this.onLogDataUpdate);
  }

  componentDidUpdate(prevProps: IAppProps, prevState: IAppState) {
    if (prevState.wasNewGameClicked) {
      this.setState({ wasNewGameClicked: false });
    }
  }

  private onLogDataUpdate(event: any, fullLog: string) {
    this.setState({
      logData: fullLog,
    });
  }

  render() {
    // Check if a search was made - if so redirect to the browse page (this is a bit ghetto)
    let redirect = null;
    if (this._onSearch) {
      this._onSearch = false;
      redirect = <Redirect to={Paths.browse} push={true} />;
    }
    // Get game count (or undefined if no games are yet found)
    let gameCount: number|undefined;
    if (this.state.central.gamesDoneLoading) {
      gameCount = this.state.central.games.collection.games.length;
    }
    // Props to set to the router
    const routerProps: IAppRouterProps = {
      central: this.state.central,
      search: this.state.search,
      order: this.state.order,
      logData: this.state.logData,
      gameScale: this.state.gameScale,
      gameLayout: this.state.gameLayout,
      selectedGame: this.state.selectedGame,
      selectedPlaylist: this.state.selectedPlaylist,
      onSelectGame: this.onSelectGame,
      onSelectPlaylist: this.onSelectPlaylist,
      wasNewGameClicked: this.state.wasNewGameClicked,
    };
    // Render
    return (
      <>
        {/* Redirect */}
        { redirect }
        {/* "TitleBar" stuff */}
        { window.External.config.data.useCustomTitlebar ? (
          <TitleBar title={`${AppConstants.appTitle} (${AppConstants.appVersionString})`} />
        ) : undefined }
        {/* "Header" stuff */}
        <Header onSearch={this.onSearch} onOrderChange={this.onOrderChange}
                onToggleLeftSidebarClick={this.onToggleLeftSidebarClick}
                onToggleRightSidebarClick={this.onToggleRightSidebarClick} />
        {/* "Main" / "Content" stuff */}
        <div className='main'>
          <AppRouter {...routerProps} />
          <noscript className='nojs'>
            <div style={{textAlign:'center'}}>
              This website requires JavaScript to be enabled.
            </div>
          </noscript>
        </div>
        {/* "Footer" stuff */}
        <Footer gameCount={gameCount}
                onScaleSliderChange={this.onScaleSliderChange} scaleSliderValue={this.state.gameScale}
                onLayoutChange={this.onLayoutSelectorChange} layout={this.state.gameLayout}
                onNewGameClick={this.onNewGameClick} />
      </>
    );
  }

  private onSearch(event: ISearchOnSearchEvent): void {
    if (event.input || event.tags.length > 0) {
      this._onSearch = true;
    }
    this.setState({
      search: event,
    });
  }

  private onOrderChange(event: IGameOrderChangeEvent): void {
    this.setState({
      order: event,
    });
  }

  private onScaleSliderChange(value: number): void {
    this.setState({ gameScale: value });
    // Update Preferences Data (this is to make it get saved on disk)
    window.External.preferences.data.browsePageGameScale = value;
  }

  private onLayoutSelectorChange(value: BrowsePageLayout): void {
    this.setState({ gameLayout: value });
    // Update Preferences Data (this is to make it get saved on disk)
    window.External.preferences.data.browsePageLayout = value;
  }

  private onNewGameClick(): void {
    this.setState({
      wasNewGameClicked: true,
      selectedGame: undefined
    });
  }

  private onToggleLeftSidebarClick(): void {
    const pref = window.External.preferences.data;
    pref.browsePageShowLeftSidebar = !pref.browsePageShowLeftSidebar;
    this.forceUpdate();
  }

  private onToggleRightSidebarClick(): void {
    const pref = window.External.preferences.data;
    pref.browsePageShowRightSidebar = !pref.browsePageShowRightSidebar;
    this.forceUpdate();
  }

  private onSelectGame(game?: IGameInfo): void {
    this.setState({ selectedGame: game });
  }

  private onSelectPlaylist(playlist?: IGamePlaylist): void {
    this.setState({
      selectedPlaylist: playlist,
      selectedGame: undefined,
    });
  }
}
