import { ReactNode } from 'react';
import GameManager from './game/GameManager';
import { GameImageCollection } from './image/GameImageCollection';
import { GamePlaylistManager } from './playlist/GamePlaylistManager';
import { IUpgradeData } from './upgrade/upgrade';

/** "match" object from 'react-router' and 'history' npm packages */
export interface IMatch {
  /** Key/value pairs parsed from the URL corresponding to the dynamic segments of the path */
  params: any;
  /** true if the entire URL was matched (no trailing characters) */
  isExact: boolean;
  /** The path pattern used to match. Useful for building nested <Route>s */
  path: string;
  /** The matched portion of the URL. Useful for building nested <Link>s */
  url: string;
}

export interface IDefaultProps {
  children?: ReactNode;
}

/**
 * An object that contains useful stuff and is passed throughout the react app as a prop/state
 * (This should be temporary and used for quick and dirty testing and implementation)
 * (Replace this with something more thought out and maintainable once the project has more structure)
 */
export interface ICentralState {
  /** All playlists */
  games: GameManager;
  /** Lookup table for all games images filenames */
  gameImages: GameImageCollection;
  /** All playlists */
  playlists: GamePlaylistManager;
  /** @TODO write this comment */
  upgrade: UpgradeState;
  /** If the game collection is done loading */
  gamesDoneLoading: boolean;
  /** If the game collection failed to load */
  gamesFailedLoading: boolean;
  /** If the playlist collection is done loading */
  playlistsDoneLoading: boolean;
  /** If the playlist failed to load */
  playlistsFailedLoading: boolean;
}

/**
 * State of the current search.
 */
export interface SearchState {
  input: string;
}

/** @TODO write this comment */
export interface UpgradeState {
  data?: IUpgradeData;
  techState: UpgradeStageState;
  screenshotsState: UpgradeStageState;
  /** If the "upgrade" file has been loaded and parsed (or if it failed and the default values were used instead) */
  doneLoading: boolean;
}

export interface UpgradeStageState {
  /** If the stage was already installed when the launcher started up */
  alreadyInstalled: boolean;
  /** If the checks has been performed */
  checksDone: boolean;
  /** If the stage is currently being downloaded / installed */
  isInstalling: boolean;
  /** If the stage was installed during this session (this is so it can tell the user to restart) */
  isInstallationComplete: boolean;
  /** Progress note of the installation (if its being installed) */
  installProgressNote: string;
}
