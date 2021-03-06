import * as React from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
import { WithLibraryProps } from '../containers/withLibrary';
import { WithPreferencesProps } from '../containers/withPreferences';
import { Paths } from '../Paths';
import { SearchQuery } from '../store/search';
import { easterEgg, joinLibraryRoute } from '../Util';
import { GameOrder, IGameOrderChangeEvent } from './GameOrder';
import { OpenIcon } from './OpenIcon';

interface OwnProps {
  searchQuery: SearchQuery;
  order: IGameOrderChangeEvent;
  onSearch: (text: string, redirect: boolean) => void;
  onOrderChange?: (event: IGameOrderChangeEvent) => void;
  onToggleLeftSidebarClick?: () => void;
  onToggleRightSidebarClick?: () => void;
}

export type IHeaderProps = OwnProps & RouteComponentProps & WithPreferencesProps & WithLibraryProps;

export interface IHeaderState {
  searchText: string;
}

export class Header extends React.Component<IHeaderProps, IHeaderState> {
  private searchInputRef: React.RefObject<HTMLInputElement> = React.createRef();

  constructor(props: IHeaderProps) {
    super(props);
    this.state = {
      searchText: this.props.searchQuery.text,
    };
  }

  componentDidMount() {
    window.addEventListener('keypress', this.onKeypress);
  }

  componentWillUnmount() {
    window.removeEventListener('keypress', this.onKeypress);
  }

  render() {
    const {
      preferencesData: { browsePageShowLeftSidebar, browsePageShowRightSidebar, showDeveloperTab },
      libraryData: { libraries },
      onOrderChange, onToggleLeftSidebarClick, onToggleRightSidebarClick
    } = this.props;
    const { searchText } = this.state;
    return (
      <div className='header'>
        {/* Header Menu */}
        <div className='header__wrap'>
          <ul className='header__menu'>
            <MenuItem title='Home' link={Paths.HOME}/>
            { libraries.length > 0 ? (
              libraries.map(item => (
                <MenuItem title={item.title} link={joinLibraryRoute(item.route)}
                          key={item.route}/>
              )) 
            ) : (
              <MenuItem title='Browse' link={Paths.BROWSE}/>
            ) }
            <MenuItem title='Logs' link={Paths.LOGS}/>
            <MenuItem title='Config' link={Paths.CONFIG}/>
            <MenuItem title='About' link={Paths.ABOUT}/>
            { showDeveloperTab ? (
              <MenuItem title='Developer' link={Paths.DEVELOPER}/>
            ) : undefined }
          </ul>
        </div>
        {/* Header Search */}
        <div className='header__wrap header__wrap--width-restricted header__search__wrap'>
          <div>
            <div className='header__search'>
              <div className='header__search__left'>
                <input className='header__search__input' ref={this.searchInputRef}
                       value={searchText} placeholder='Search...'
                       onChange={this.onSearchChange} onKeyDown={this.onSearchKeyDown} />                
              </div>
              <div className='header__search__right'
                   onClick={ searchText ? this.onClearClick : undefined }>
                <div className='header__search__right__inner'>
                  <OpenIcon className='header__search__icon' icon={ searchText ? 'circle-x' : 'magnifying-glass' } />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Header Drop-downs */}
        <div className='header__wrap'>
          <div>
            <GameOrder onChange={onOrderChange}
                       orderBy={this.props.order.orderBy}
                       orderReverse={this.props.order.orderReverse}/>
          </div>
        </div>
        {/* Right-most portion */}
        <div className='header__wrap header__right'>
          <div>
            {/* Toggle Right Sidebar */}
            <div className='header__toggle-sidebar'
                 title={browsePageShowRightSidebar ? 'Hide right sidebar' : 'Show right sidebar'}
                 onClick={onToggleRightSidebarClick}>
              <OpenIcon icon={browsePageShowRightSidebar ? 'collapse-right' : 'expand-right'} />
            </div>
            {/* Toggle Left Sidebar */}
            <div className='header__toggle-sidebar'
                 title={browsePageShowLeftSidebar ? 'Hide left sidebar' : 'Show left sidebar'}
                 onClick={onToggleLeftSidebarClick}>
              <OpenIcon icon={browsePageShowLeftSidebar ? 'collapse-left' : 'expand-left'} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  private onSearchChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value;
    this.setState({ searchText: value });
    // "Clear" the search when the search field gets empty
    if (value === '') { this.props.onSearch('', false); }
  }

  private onSearchKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Enter') {
      const value = this.state.searchText;
      this.props.onSearch(value, true);
      easterEgg(value);
    }
  }

  private onKeypress = (event: KeyboardEvent): void => {
    if (event.ctrlKey && event.code === 'KeyF') {
      const element = this.searchInputRef.current;
      if (element) {
        element.select();
        event.preventDefault();
      }
    }
  }

  private onClearClick = (): void => {
    this.setState({ searchText: '' });
    this.props.onSearch('', false);
  }
}

function MenuItem({ title, link }: { title: string, link: string }) {
  return (
    <li className='header__menu__item'>
      <Link to={link} className='header__menu__item__link'>{title}</Link>
    </li>
  );
}
