import * as React from 'react';
import { IDefaultProps, ICentralState } from '../../interfaces';
import { GameList } from '../GameList';
import { IGameOrderChangeEvent } from '../GameOrder';
import { IGameInfo, IAdditionalApplicationInfo } from '../../../shared/game/interfaces';
import { gameScaleSpan, gameIdDataType } from '../../Util';
import { GameGrid } from '../GameGrid';
import { BrowsePageLayout } from '../../../shared/BrowsePageLayout';
import { orderGames, IOrderGamesArgs } from '../../../shared/game/GameFilter';
import { GameCollection } from '../../../shared/game/GameCollection';
import { GameLauncher } from '../../GameLauncher';
import { IGamePlaylist, IGamePlaylistEntry } from '../../../renderer/playlist/interfaces';
import { GameInfo } from '../../../shared/game/GameInfo';
import { AdditionalApplicationInfo } from '../../../shared/game/AdditionalApplicationInfo';
import GameManagerPlatform from '../../game/GameManagerPlatform';
import { GameParser, generateGameOrderTitle } from '../../../shared/game/GameParser';
import { uuid } from '../../uuid';
import { formatDate, removeFileExtension } from '../../../shared/Util';
import { SearchQuery } from '../../store/search';
import { WithPreferencesProps } from '../../containers/withPreferences';
import { ConnectedLeftBrowseSidebar } from '../../containers/ConnectedLeftBrowseSidebar';
import { ConnectedRightBrowseSidebar } from '../../containers/ConnectedRightBrowseSidebar';
import { IResizableSidebar, IResizeEvent } from '../IResizableSidebar';
import { GamePropSuggestions, getSuggestions } from '../../util/suggestions';
import { WithLibraryProps } from '../../containers/withLibrary';
import { IGameLibraryFileItem } from '../../../shared/library/interfaces';

type Pick<T, K extends keyof T> = { [P in K]: T[P]; };
type StateCallback0 = Pick<IBrowsePageState, 'orderedGames'|'orderedGamesArgs'>;
type StateCallback1 = Pick<IBrowsePageState, 'currentGame'|'currentAddApps'|'isEditing'|'isNewGame'>;
type StateCallback2 = Pick<IBrowsePageState, 'currentGame'|'currentAddApps'|'isNewGame'>;

interface OwnProps {
  central: ICentralState;
  search: SearchQuery;
  order?: IGameOrderChangeEvent;
  /** Scale of the games */
  gameScale: number;
  /** Layout of the games */
  gameLayout: BrowsePageLayout;
  /** Currently selected game (if any) */
  selectedGame?: IGameInfo;
  /** Currently selected playlist (if any) */
  selectedPlaylist?: IGamePlaylist;
  onSelectGame?: (game?: IGameInfo) => void;
  onSelectPlaylist?: (playlist?: IGamePlaylist) => void;
  clearSearch: () => void;
  wasNewGameClicked: boolean;
  /** "Route" of the currently selected library (empty string means no library) */
  gameLibraryRoute: string;
}

export type IBrowsePageProps = OwnProps & IDefaultProps & WithPreferencesProps & WithLibraryProps;

export interface IBrowsePageState {
  /** Current quick search string (used to jump to a game in the list, not to filter the list) */
  quickSearch: string;
  /** Ordered games using the most recent props, configs and preferences */
  orderedGames: IGameInfo[];
  /** Arguments used to order the "orderedGames" array in this state */
  orderedGamesArgs?: IOrderGamesArgs;
  /** Currently dragged game (if any) */
  draggedGame?: IGameInfo;
  /** Buffer for the selected game (all changes are made to the game until saved) */
  currentGame?: IGameInfo;
  /** Buffer for the selected games additional applications (all changes are made to this until saved) */
  currentAddApps?: IAdditionalApplicationInfo[];
  /** If the "edit mode" is currently enabled */
  isEditing: boolean;
  /** If the selected game is a new game being created */
  isNewGame: boolean;
  /** ... */
  suggestions?: Partial<GamePropSuggestions>;
}

export class BrowsePage extends React.Component<IBrowsePageProps, IBrowsePageState> {
  /** A timestamp of the previous the the quick search string was updated */
  private _prevQuickSearchUpdate: number = 0;
  private gameBrowserRef: React.RefObject<HTMLDivElement> = React.createRef();
  private boundSetState = this.setState.bind(this);

  private static readonly quickSearchTimeout: number = 1500;

  constructor(props: IBrowsePageProps) {
    super(props);
    // Set initial state (this is set up to remove all "setState" calls)
    const initialState: IBrowsePageState = {
      quickSearch: '',
      orderedGames: [],
      isEditing: false,
      isNewGame: false
    };
    const assignToState = <T extends keyof IBrowsePageState>(state: Pick<IBrowsePageState, T>) => { Object.assign(initialState, state); };
    this.orderGames(true, assignToState);
    this.updateCurrentGameAndAddApps(assignToState);
    this.createNewGameIfClicked(false, assignToState);
    this.state = initialState;
  }

  componentDidMount() {
    this.props.central.games.on('change', this.onGamesCollectionChange);
  }

  componentWillUnmount() {
    this.props.central.games.removeListener('change', this.onGamesCollectionChange);
  }

  componentDidUpdate(prevProps: IBrowsePageProps, prevState: IBrowsePageState) {
    const { central, gameLibraryRoute, onSelectGame, selectedGame, selectedPlaylist } = this.props;
    const { isEditing, orderedGames, quickSearch } = this.state;
    this.orderGames();
    // Check if it ended editing
    if (!isEditing && prevState.isEditing) {
      this.updateCurrentGameAndAddApps();
      this.setState({ suggestions: undefined });
    }
    // Check if it started editing
    if (isEditing && !prevState.isEditing) {
      this.updateCurrentGameAndAddApps();
      this.setState({ suggestions: getSuggestions(central.games.collection) });
    }
    // Update current game and add-apps if the selected game changes
    if (selectedGame && selectedGame !== prevProps.selectedGame) {
      this.updateCurrentGameAndAddApps();
      this.setState({ isEditing: false });
    }
    // Update current game and add-apps if the selected game changes
    if (gameLibraryRoute === prevProps.gameLibraryRoute &&
        selectedPlaylist !== prevProps.selectedPlaylist) {
      this.setState({
        currentGame: undefined,
        currentAddApps: undefined,
        isNewGame: false,
        isEditing: false
      });
    }
    // Check if quick search string changed, and if it isn't empty
    if (prevState.quickSearch !== quickSearch && quickSearch !== '') {
      const games: IGameInfo[] = orderedGames;
      for (let index = 0; index < games.length; index++) {
        const game: IGameInfo = games[index];
        if (game.title.toLowerCase().startsWith(quickSearch)) {
          if (onSelectGame) { onSelectGame(game); }
          break;
        }
      }
    }
    // Create a new game if the "New Game" button is pushed
    this.createNewGameIfClicked(prevProps.wasNewGameClicked);
    // Check the library selection changed (and no game is selected)
    if (!selectedGame && gameLibraryRoute !== prevProps.gameLibraryRoute) {
      this.setState({
        currentGame: undefined,
        currentAddApps: undefined,
        isNewGame: false,
        isEditing: false
      });
    }
  }

  render() {
    const { selectedGame, selectedPlaylist } = this.props;
    const { draggedGame, orderedGames } = this.state;
    const currentLibrary = this.getCurrentLibrary();
    const order = this.props.order || BrowsePage.defaultOrder;
    const showSidebars: boolean = this.props.central.gamesDoneLoading;
    // Find the selected game in the selected playlist (if both are selected)
    let gamePlaylistEntry: IGamePlaylistEntry|undefined;
    if (selectedPlaylist && selectedGame) {
      for (let gameEntry of selectedPlaylist.games) {
        if (gameEntry.id === selectedGame.id) {
          gamePlaylistEntry = gameEntry;
          break;
        }
      }
    }
    // Render
    return (
      <div className='game-browser' ref={this.gameBrowserRef}>
        <IResizableSidebar none={!!selectedGame}
                           hide={this.props.preferencesData.browsePageShowLeftSidebar && showSidebars}
                           divider='after'
                           width={this.props.preferencesData.browsePageLeftSidebarWidth}
                           onResize={this.onLeftSidebarResize}>
          <ConnectedLeftBrowseSidebar central={this.props.central}
                                      currentLibrary={currentLibrary}
                                      selectedPlaylistID={selectedPlaylist ? selectedPlaylist.id : ''}
                                      onSelectPlaylist={this.onLeftSidebarSelectPlaylist}
                                      onDeselectPlaylist={this.onLeftSidebarDeselectPlaylist}
                                      onPlaylistChanged={this.onLeftSidebarPlaylistChanged}
                                      onShowAllClick={this.onLeftSidebarShowAllClick} />
        </IResizableSidebar>
        <div className='game-browser__center' onKeyDown={this.onCenterKeyDown}>
          {(() => {
            if (this.props.gameLayout === BrowsePageLayout.grid) {
              // (These are kind of "magic numbers" and the CSS styles are designed to fit with them)
              const height: number = calcScale(350, this.props.gameScale);
              const width: number = (height * 0.666) | 0;
              return (
                <GameGrid games={orderedGames}
                          selectedGame={selectedGame}
                          draggedGame={draggedGame}
                          gameImages={this.props.central.gameImages}
                          noRowsRenderer={this.noRowsRenderer}
                          onGameSelect={this.onGameSelect}
                          onGameLaunch={this.onGameLaunch}
                          onGameDragStart={this.onGameDragStart}
                          onGameDragEnd={this.onGameDragEnd}
                          orderBy={order.orderBy}
                          orderReverse={order.orderReverse}
                          cellWidth={width}
                          cellHeight={height}/>
              );
            } else {
              const height: number = calcScale(120, this.props.gameScale);
              return (
                <GameList games={orderedGames}
                          selectedGame={selectedGame}
                          draggedGame={draggedGame}
                          gameImages={this.props.central.gameImages}
                          noRowsRenderer={this.noRowsRenderer}
                          onGameSelect={this.onGameSelect}
                          onGameLaunch={this.onGameLaunch}
                          onGameDragStart={this.onGameDragStart}
                          onGameDragEnd={this.onGameDragEnd}
                          orderBy={order.orderBy}
                          orderReverse={order.orderReverse}
                          rowHeight={height} />
              );
            }
          })()}
        </div>
        <IResizableSidebar none={!!this.state.currentGame}
                           hide={this.props.preferencesData.browsePageShowRightSidebar && showSidebars}
                           divider='before'
                           width={this.props.preferencesData.browsePageRightSidebarWidth}
                           onResize={this.onRightSidebarResize}>
          <ConnectedRightBrowseSidebar currentGame={this.state.currentGame}
                                       currentAddApps={this.state.currentAddApps}
                                       currentLibrary={currentLibrary}
                                       gameImages={this.props.central.gameImages}
                                       games={this.props.central.games}
                                       onDeleteSelectedGame={this.onDeleteSelectedGame}
                                       onRemoveSelectedGameFromPlaylist={this.onRemoveSelectedGameFromPlaylist}
                                       onEditPlaylistNotes={this.onEditPlaylistNotes}
                                       gamePlaylistEntry={gamePlaylistEntry}
                                       isEditing={this.state.isEditing}
                                       isNewGame={this.state.isNewGame}
                                       onEditClick={this.onStartEditClick}
                                       onDiscardClick={this.onDiscardEditClick}
                                       onSaveGame={this.onSaveEditClick}
                                       suggestions={this.state.suggestions} />
        </IResizableSidebar>
      </div>
    );
  }

  private noRowsRenderer = (): JSX.Element => {
    return (
      <div className='game-list__no-games'>
        { this.props.central.gamesDoneLoading ? (
          this.props.selectedPlaylist ? (
            /* Empty Playlist */
            <>
              <h2 className='game-list__no-games__title'>Empty Playlist</h2>
              <br/>
              <p>Drop a game on this playlist in the <i>left sidebar</i> to add it.</p>
            </>
          ) : (
            /* No games found */
            <>
              <h1 className='game-list__no-games__title'>No Games Found!</h1>
              <br/>
              {(this.props.central.gamesFailedLoading) ? (
                <>
                  Have you set the path to the <b>Flashpoint path</b> at the <i>Config</i> page?<br/>
                  <br/>
                  Note: You have to press <b>"Save & Restart"</b> for the change to take effect.
                </>
              ) : (
                (this.props.central.games.collection.games.length > 0) ? (
                  <>
                    No game title matched your search.<br/>
                    Try searching for something less restrictive.
                  </>
                ) : (
                  <>
                    There are no games.
                  </>
                )
              )}
            </>
          )
        ) : (
          <p>
            Loading Games...
          </p>
        ) }
      </div>
    );
  }

  private onLeftSidebarSelectPlaylist = (playlist: IGamePlaylist): void => {
    const { clearSearch, onSelectPlaylist } = this.props;
    if (clearSearch)      { clearSearch();              }
    if (onSelectPlaylist) { onSelectPlaylist(playlist); }
  }

  private onLeftSidebarDeselectPlaylist = (): void => {
    const { clearSearch, onSelectPlaylist } = this.props;
    if (clearSearch)      { clearSearch();               }
    if (onSelectPlaylist) { onSelectPlaylist(undefined); }
  }

  private onLeftSidebarPlaylistChanged = (): void => {
    this.forceUpdate();
  }

  private onLeftSidebarShowAllClick = (): void => {
    const { clearSearch, onSelectPlaylist } = this.props;
    if (clearSearch)      { clearSearch();               }
    if (onSelectPlaylist) { onSelectPlaylist(undefined); }
    this.setState({
      isEditing: false,
      isNewGame: false,
      currentGame: undefined,
      currentAddApps: undefined
    });
  }

  private onLeftSidebarResize = (event: IResizeEvent): void => {
    const maxWidth = this.getGameBrowserDivWidth() - this.props.preferencesData.browsePageRightSidebarWidth;
    const targetWidth = event.startWidth + event.event.clientX - event.startX;
    this.props.updatePreferences({
      browsePageLeftSidebarWidth: Math.min(targetWidth, maxWidth)
    });
  }

  private onRightSidebarResize = (event: IResizeEvent): void => {
    const maxWidth = this.getGameBrowserDivWidth() - this.props.preferencesData.browsePageLeftSidebarWidth;
    const targetWidth = event.startWidth + event.startX - event.event.clientX;
    this.props.updatePreferences({
      browsePageRightSidebarWidth: Math.min(targetWidth, maxWidth)
    });
  }
  
  private getGameBrowserDivWidth(): number {
    if (!document.defaultView) { throw new Error('"document.defaultView" missing.'); }
    if (!this.gameBrowserRef.current) { throw new Error('"game-browser" div is missing.'); }
    return parseInt(document.defaultView.getComputedStyle(this.gameBrowserRef.current).width || '', 10);
  }

  private onGameSelect = (game?: IGameInfo): void => {
    if (this.props.selectedGame !== game) {
      if (this.props.onSelectGame) { this.props.onSelectGame(game); }
    }
  }

  private onGameLaunch = (game: IGameInfo): void => {
    const addApps = GameCollection.findAdditionalApplicationsByGameId(this.props.central.games.collection, game.id);
    GameLauncher.launchGame(game, addApps);
  }

  private onCenterKeyDown = (event: React.KeyboardEvent): void => {
    const key: string = event.key.toLowerCase();
    if (!event.ctrlKey && !event.altKey) { // (Don't add CTRL or ALT modified key presses)
      if (key === 'backspace') { // (Backspace - Remove a character)
        const timedOut = updateTime.call(this);
        let newString: string = (timedOut ? '' : this.state.quickSearch);
        newString = newString.substr(0, newString.length - 1);
        this.setState({ quickSearch: newString });
      } else if (key.length === 1) { // (Single character - add it to the search string)
        const timedOut = updateTime.call(this);
        let newString: string = (timedOut ? '' : this.state.quickSearch) + key;
        this.setState({ quickSearch: newString });
      }
    }

    function updateTime(this: BrowsePage): boolean {
      const now: number = Date.now();
      const timedOut: boolean = (now - this._prevQuickSearchUpdate > BrowsePage.quickSearchTimeout);
      this._prevQuickSearchUpdate = now;
      return timedOut;
    }
  }

  private onGameDragStart = (event: React.DragEvent, game: IGameInfo, index: number): void => {
    this.setState({ draggedGame: game });
    event.dataTransfer.setData(gameIdDataType, game.id);
  }

  private onGameDragEnd = (event: React.DragEvent, game: IGameInfo, index: number): void => {
    this.setState({ draggedGame: undefined });
    event.dataTransfer.clearData(gameIdDataType);
  }

  private onDeleteSelectedGame = (): void => {
    if (this.props.onSelectGame) { this.props.onSelectGame(undefined); }
  }

  private onRemoveSelectedGameFromPlaylist = (): void => {
    const playlist = this.props.selectedPlaylist;
    const game = this.props.selectedGame;
    if (!playlist) { throw new Error('Unable to remove game from selected playlist - No playlist is selected'); }
    if (!game)     { throw new Error('Unable to remove game from selected playlist - No game is selected'); }
    // Find the game entry (of the selected game) in the playlist
    const gameId = game.id;
    let index: number = -1;
    playlist.games.every((gameEntry, i) => {
      if (gameEntry.id === gameId) {
        index = i;
        return false;
      }
      return true;
    });
    if (index === -1) { throw new Error('Unable to remove game from selected playlist - Game is not in playlist'); }
    // Remove game from playlist, save the playlist and update the interface
    playlist.games.splice(index, 1); // Remove game entry
    this.props.central.playlists.save(playlist);
    this.orderGames(true);
    if (this.props.onSelectGame) { this.props.onSelectGame(undefined); }
  }

  private onEditPlaylistNotes = (text: string): void => {
    const playlist = this.props.selectedPlaylist;
    const game = this.props.selectedGame;
    if (!playlist) { throw new Error('Unable to remove game from selected playlist - No playlist is selected'); }
    if (!game)     { throw new Error('Unable to remove game from selected playlist - No game is selected'); }
    // Find the game entry (of the selected game) in the playlist
    const gameId = game.id;
    let index: number = -1;
    playlist.games.every((gameEntry, i) => {
      if (gameEntry.id === gameId) {
        index = i;
        return false;
      }
      return true;
    });
    if (index === -1) { throw new Error('Unable to remove game from selected playlist - Game is not in playlist'); }
    // Set game specific playlist notes
    playlist.games[index].notes = text;
    this.props.central.playlists.save(playlist);
    this.forceUpdate();
  }

  /** Replace the "current game" with the selected game (in the appropriate circumstances) */
  private updateCurrentGameAndAddApps(cb: (state: StateCallback2) => void = this.boundSetState): void {
    const { central, selectedGame } = this.props;
    if (selectedGame) { // (If the selected game changes, discard the current game and use that instead)
      // Find additional applications for the selected game (if any)
      let addApps = GameCollection.findAdditionalApplicationsByGameId(central.games.collection, selectedGame.id);
      // Update State
      cb({
        currentGame: selectedGame && GameInfo.duplicate(selectedGame),
        currentAddApps: addApps && addApps.map(AdditionalApplicationInfo.duplicate),
        isNewGame: false,
      });
    }
  }

  private onStartEditClick = (): void => {
    this.setState({ isEditing: true });
  }

  private onDiscardEditClick = (): void => {
    const { currentAddApps, currentGame, isNewGame } = this.state;
    this.setState({
      isEditing: false,
      isNewGame: false,
      currentGame:    isNewGame ? undefined : currentGame,
      currentAddApps: isNewGame ? undefined : currentAddApps,
    });
  }

  private onSaveEditClick = (): void => {
    this.saveGameAndAddApps();
    this.setState({
      isEditing: false,
      isNewGame: false
    });
  }
  
  private saveGameAndAddApps(): void {
    console.time('save');
    const game = this.state.currentGame;
    if (!game) { console.error(`Can't save game. "currentGame" is missing.`); return; }
    //
    const currentLibrary = this.getCurrentLibrary();
    let platformPrefix = '';
    if (currentLibrary && currentLibrary.prefix) {
      platformPrefix = currentLibrary.prefix;
    }
    // Find the platform the game is in (or should be in, if it is not in one already)
    const games = this.props.central.games;
    let platform = games.getPlatformByName(removeFileExtension(game.filename)) ||
                   games.getPlatformOfGameId(game.id) ||
                   (game.platform && games.getPlatformByName(platformPrefix+game.platform)) ||
                   games.getPlatformByName(platformPrefix+'Unknown Platform');
    if (!platform) {
      platform = new GameManagerPlatform(platformPrefix+'Unknown Platform.xml');
      platform.collection = new GameCollection();
      platform.data = { LaunchBox: {} };
      games.addPlatform(platform);
    }
    // Update game's order title
    game.orderTitle = generateGameOrderTitle(game.title);
    // Update game's filename property
    game.filename = platform.filename;
    // Overwrite the game and additional applications with the changes made
    platform.addOrUpdateGame(game);
    // Override the additional applications
    const addApps = GameCollection.findAdditionalApplicationsByGameId(games.collection, game.id);
    updateAddApps.call(this, addApps, platform);
    // Refresh games collection
    games.refreshCollection();
    // If a new game was created, select the new game
    if ((this.props.selectedGame && this.props.selectedGame.id) !== game.id) {
      if (!platform.collection) { throw new Error('Platform collection is missing.'); }
      if (this.props.onSelectGame) { this.props.onSelectGame(platform.collection.findGame(game.id)); }
    }
    // Save changes to file
    platform.saveToFile().then(() => { console.timeEnd('save'); });

    // -- Functions --
    function updateAddApps(this:  BrowsePage, selectedApps: IAdditionalApplicationInfo[], platform: GameManagerPlatform): void {
      if (!platform.collection) { throw new Error('Platform does not have a collection.'); }
      // 1. Save the changes made to add-apps
      // 2. Save any new add-apps
      // 3. Delete any removed add-apps
      const editApps = this.state.currentAddApps;
      if (!editApps) { throw new Error('editAddApps is missing'); }
      if (!selectedApps) { throw new Error('selectedAddApps is missing'); }
      // -- Categorize add-apps --
      // Put all new add-apps in an array
      const newAddApps: IAdditionalApplicationInfo[] = [];
      for (let i = editApps.length - 1; i >= 0; i--) {
        const editApp = editApps[i];
        let found = false;
        for (let j = selectedApps.length - 1; j >= 0; j--) {
          const selApp = selectedApps[j];
          if (editApp.id === selApp.id) {
            found = true;
            break;
          }
        }
        if (!found) { newAddApps.push(editApp); }
      }
      // Put all changed add-apps in an array
      const changedAddApps: IAdditionalApplicationInfo[] = [];
      for (let i = editApps.length - 1; i >= 0; i--) {
        const editApp = editApps[i];
        for (let j = selectedApps.length - 1; j >= 0; j--) {
          const selApp = selectedApps[j];
          if (editApp.id === selApp.id) {
            changedAddApps.push(editApp);
            break;
          }
        }
      }
      // Put all removes add-apps in an array
      const removedAddApps: IAdditionalApplicationInfo[] = [];
      for (let i = selectedApps.length - 1; i >= 0; i--) {
        const selApp = selectedApps[i];
        let found = false;
        for (let j = editApps.length - 1; j >= 0; j--) {
          const editApp = editApps[j];
          if (editApp.id === selApp.id) {
            found = true;
            break;
          }
        }
        if (!found) { removedAddApps.push(selApp); }
      }
      // -- Update --
      // Delete removed add-apps
      for (let i = removedAddApps.length - 1; i >= 0; i--) {
        const addApp = removedAddApps[i];
        platform.removeAdditionalApplication(addApp.id);
      }
      // Update changed add-apps
      for (let i = changedAddApps.length - 1; i >= 0; i--) {
        const addApp = changedAddApps[i];
        const oldAddApp = platform.collection.findAdditionalApplication(addApp.id);
        if (!oldAddApp) { throw new Error('???'); }
        const rawAddApp = platform.findRawAdditionalApplication(addApp.id);
        if (!rawAddApp) { throw new Error('???'); }
        Object.assign(oldAddApp, addApp);
        Object.assign(rawAddApp, GameParser.reverseParseAdditionalApplication(oldAddApp));
      }
      // Add new add-apps
      for (let i = newAddApps.length - 1; i >= 0; i--) {
        const addApp = newAddApps[i];
        platform.addAdditionalApplication(addApp);
        const newRawAddApp = Object.assign({}, GameParser.emptyRawAdditionalApplication, 
                                          GameParser.reverseParseAdditionalApplication(addApp));
        platform.addRawAdditionalApplication(newRawAddApp);
      }
    }
  }

  private getCurrentLibrary(): IGameLibraryFileItem|undefined {
    if (this.props.libraryData) {
      const route = this.props.gameLibraryRoute;
      return this.props.libraryData.libraries.find(item => item.route === route);
    }
    return undefined;
  }

  /** Find all the games for the current library - undefined if no library is selected */
  private getCurrentLibraryGames(): IGameInfo[]|undefined {
    const currentLibrary = this.getCurrentLibrary();
    if (currentLibrary) {
      let games: IGameInfo[] = [];
      const allPlatforms = this.props.central.games.listPlatforms();
      if (currentLibrary.default) {
        // Find all platforms "used" by other libraries
        const usedPlatforms: GameManagerPlatform[] = [];
        this.props.libraryData.libraries.forEach(library => {
          if (library === currentLibrary) { return; }
          if (library.prefix) {
            const prefix = library.prefix;
            allPlatforms.forEach(platform => {
              if (platform.filename.startsWith(prefix)) { usedPlatforms.push(platform); }
            });
          }
        });
        // Get all games from all platforms that are not "used" by other libraries
        const unusedPlatforms = allPlatforms.filter(platform => usedPlatforms.indexOf(platform) === -1);
        unusedPlatforms.forEach(platform => {
          if (platform.collection) {
            Array.prototype.push.apply(games, platform.collection.games);
          }
        });
      } else if (currentLibrary.prefix) {
        const prefix = currentLibrary.prefix;
        const platforms = allPlatforms.filter(platform => platform.filename.startsWith(prefix));
        platforms.forEach(platform => {
          if (platform.collection) {
            Array.prototype.push.apply(games, platform.collection.games);
          }
        })
      }
      return games;
    }
    return undefined;
  }
  
  /**
   * Update the ordered games array if the related props, configs or preferences has been changed
   * @param force If checking for changes in the arguments should be skipped (it always re-orders the games)
   */
  private orderGames(force: boolean = false, cb: (state: StateCallback0) => void = this.boundSetState): void {
    const args = {
      games: this.getCurrentLibraryGames() || this.props.central.games.collection.games,
      search: this.props.search ? this.props.search.text : '',
      extreme: !window.External.config.data.disableExtremeGames &&
               this.props.preferencesData.browsePageShowExtreme,
      broken: window.External.config.data.showBrokenGames,
      playlist: this.props.selectedPlaylist,
      platforms: undefined,
      order: this.props.order || BrowsePage.defaultOrder,
    };
    if (force || !checkOrderGamesArgsEqual(args, this.state.orderedGamesArgs)) {
      cb({
        orderedGames: orderGames(args),
        orderedGamesArgs: args,
      });
    }
  }

  private onGamesCollectionChange = (): void => {
    this.orderGames(true);
  }

  /** Create a new game if the "New Game" button was clicked */
  private createNewGameIfClicked(prevWasNewGameClicked: boolean, cb: (state: StateCallback1) => void = this.boundSetState): void {
    const { wasNewGameClicked } = this.props;
    // Create a new game if the "New Game" button is pushed
    if (wasNewGameClicked && !prevWasNewGameClicked) {
      const newGame = GameInfo.create();
      newGame.id = uuid();
      newGame.dateAdded = formatDate(new Date());
      cb({
        currentGame: newGame,
        currentAddApps: [],
        isEditing: true,
        isNewGame: true,
      });
    }
  }

  private static defaultOrder: Readonly<IGameOrderChangeEvent> = {
    orderBy: 'title',
    orderReverse: 'ascending',
  }
}

function calcScale(defHeight: number, scale: number): number {
  return (defHeight + (scale - 0.5) * 2 * defHeight * gameScaleSpan) | 0;
}

/**
 * Check if two sets of "order games arguments" will produce the same games in the same order
 * (This is not an exhaustive test, as it does not check the contents of the games array)
 */
function checkOrderGamesArgsEqual(args1: IOrderGamesArgs, args2?: IOrderGamesArgs): boolean {
  if (!args2)                            { return false; }
  if (args1.search   !== args2.search)   { return false; }
  if (args1.extreme  !== args2.extreme)  { return false; }
  if (args1.broken   !== args2.broken)   { return false; }
  if (args1.playlist !== args2.playlist) { return false; }
  if (args1.order    !== args2.order)    { return false; }
  if (!checkIfArraysAreEqual(args1.platforms, args2.platforms)) { return false; }
  if (!checkIfArraysAreEqual(args1.games, args2.games)) { return false; }
  return true;
}

/** Check if two arrays are of equal length and contains the exact same items in the same order */
function checkIfArraysAreEqual(a: any[]|undefined, b: any[]|undefined): boolean {
  if (a === b) { return true; }
  if (!a || !b) { return false; }
  if (a.length !== b.length) { return false; }
  for (let i = a.length; i >= 0; i--) {
    if (a[i] !== b[i]) { return false; }
  }
  return true;
}
