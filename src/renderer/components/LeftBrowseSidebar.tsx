import * as React from 'react';
import { ICentralState } from '../interfaces';
import { PlaylistItem } from './PlaylistItem';
import { OpenIcon } from './OpenIcon';
import { IGamePlaylist } from '../playlist/interfaces';
import { gameIdDataType } from '../Util';
import { WithPreferencesProps } from '../containers/withPreferences';
import { IGameLibraryFileItem } from '../../shared/library/interfaces';

interface OwnProps {
  central: ICentralState;
  currentLibrary?: IGameLibraryFileItem;
  /** ID of the playlist that is selected (empty string if none) */
  selectedPlaylistID: string;
  onSelectPlaylist?: (playlist: IGamePlaylist) => void;
  onDeselectPlaylist?: () => void;
  onPlaylistChanged?: (playlist: IGamePlaylist) => void;
  onShowAllClick?: () => void;
}

export type ILeftBrowseSidebarProps = OwnProps & WithPreferencesProps;

export interface ILeftBrowseSidebarState {
  isEditing: boolean;
}

/** Sidebar on the left side of BrowsePage */
export class LeftBrowseSidebar extends React.Component<ILeftBrowseSidebarProps, ILeftBrowseSidebarState> {
  constructor(props: ILeftBrowseSidebarProps) {
    super(props);
    this.state = {
      isEditing: false,
    };
  }
  
  private filterAndSortPlaylists(): IGamePlaylist[] {
    const { central, currentLibrary } = this.props;
    let playlists = central.playlists.playlists.slice();
    if (currentLibrary) { // (Filter out all playlists that "belong" to other libraries than the current one)
      const route = currentLibrary.route;
      if (currentLibrary.default) {
        playlists = playlists.filter(playlist => !playlist.library || playlist.library === route);
      } else if (route) {
        playlists = playlists.filter(playlist => playlist.library === route);
      }
    }
    playlists.sort((a, b) => a.title.localeCompare(b.title));
    return playlists;
  }

  render() {
    const { central, onShowAllClick, preferencesData, selectedPlaylistID } = this.props;
    const { isEditing } = this.state;
    const editingDisabled = !preferencesData.enableEditing;
    const playlists = this.filterAndSortPlaylists();
    return (
      <div className='browse-left-sidebar'>
          {central.playlistsDoneLoading ? (
            !central.playlistsFailedLoading ? (
              <div className='playlist-list'>
                {/* All games */}
                <div className='playlist-list-fake-item' onClick={onShowAllClick}>
                  <div className='playlist-list-fake-item__inner'>
                    <OpenIcon icon='eye' />
                  </div>
                  <div className='playlist-list-fake-item__inner'>
                    <p className='playlist-list-fake-item__inner__title'>All Games</p>
                  </div>
                </div>
                {/* List all playlists */}
                {playlists.map((playlist) => {
                  const isSelected = playlist.id === selectedPlaylistID;
                  return (
                    <PlaylistItem key={playlist.id} 
                                  playlist={playlist}
                                  expanded={isSelected}
                                  editingDisabled={editingDisabled}
                                  editing={isSelected && isEditing}
                                  central={central}
                                  onHeadClick={this.onPlaylistItemHeadClick}
                                  onEditClick={this.onPlaylistItemEditClick}
                                  onDeleteClick={this.onPlaylistItemDeleteClick}
                                  onSaveClick={this.onPlaylistItemSaveClick}
                                  onDrop={this.onPlaylistItemDrop}
                                  onDragOver={this.onPlaylistItemDragOver} />
                  );
                })}
                {/* Create New Playlist */}
                { editingDisabled ? undefined : (
                  <div className='playlist-list-fake-item' onClick={this.onCreatePlaylistClick}>
                    <div className='playlist-list-fake-item__inner'>
                      <OpenIcon icon='plus' />
                    </div>
                    <div className='playlist-list-fake-item__inner'>
                      <p className='playlist-list-fake-item__inner__title'>New Playlist</p>
                    </div>
                  </div>                  
                ) }
              </div>
            ) : ( // Failed to load
              <div className='playlist-list__message'>
                <h2>Failed to load playlist folder.</h2>
                <p>Check the log for more information.</p>
              </div>
            )
          ) : ( // Loading
            <div className='playlist-list__message'>
              <p>Loading Playlists...</p>
            </div>
          ) }
      </div>
    );
  }

  private onPlaylistItemHeadClick = (playlist: IGamePlaylist): void => {
    if (this.props.selectedPlaylistID === playlist.id) {
      this.props.onDeselectPlaylist && this.props.onDeselectPlaylist();
    } else {
      this.props.onSelectPlaylist && this.props.onSelectPlaylist(playlist);
    }
    this.setState({ isEditing: false });
  }

  private onPlaylistItemEditClick = (playlist: IGamePlaylist): void => {
    if (this.props.selectedPlaylistID === playlist.id) {
      this.setState({ isEditing: !this.state.isEditing });
    }
  }

  private onPlaylistItemDeleteClick = (playlist: IGamePlaylist): void => {
    if (this.props.central.playlistsDoneLoading) {
      // Delete playlist
      this.props.central.playlists.delete(playlist.id);
      this.props.central.playlists.remove(playlist.id);
      // Deselect playlist
      if (this.props.onDeselectPlaylist) { this.props.onDeselectPlaylist(); }
    }
  }

  private onPlaylistItemSaveClick = (playlist: IGamePlaylist, edit: IGamePlaylist): void => {
    // Overwrite the playlist with the new one
    const arr = this.props.central.playlists.playlists;
    arr.splice(arr.indexOf(playlist), 1, edit);
    // Save playlist
    this.props.central.playlists.save(edit);
    // Stop editing
    this.setState({ isEditing: false });
  }

  private onPlaylistItemDrop = (event: React.DragEvent, playlist: IGamePlaylist): void => {
    if (this.props.onPlaylistChanged) {
      this.props.onPlaylistChanged(playlist);
    }
  }

  private onPlaylistItemDragOver = (event: React.DragEvent, playlist: IGamePlaylist): void => {
    if (this.props.preferencesData.enableEditing) {
      const types = event.dataTransfer.types;
      if (types.length === 1 && types[0] === gameIdDataType) {
        // Show the "You can drop here" cursor while dragging something droppable over this element
        event.dataTransfer.dropEffect = 'copy';
        event.preventDefault();
      }
    }
  }

  private onCreatePlaylistClick = (): void => {
    const { central, currentLibrary, onSelectPlaylist } = this.props;
    if (central.playlistsDoneLoading) {
      // Create and save a new playlist
      const playlist = central.playlists.create();
      if (currentLibrary) { playlist.library = currentLibrary.route; }
      central.playlists.save(playlist);
      // Select the new playlist
      this.forceUpdate();
      setTimeout(() => { // (Give the playlist list item some time to be created before selecting it)
        onSelectPlaylist && onSelectPlaylist(playlist);
        this.setState({ isEditing: false });
      }, 1);
    }
  }
}
