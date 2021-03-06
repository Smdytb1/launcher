import { combineReducers } from 'redux';
import { connectRouter, RouterState } from 'connected-react-router';
import { History } from 'history';
import { SearchState, searchReducer } from './search';
import { IPreferencesState, preferencesReducer } from './preferences';
import { ILibraryState, libraryReducer } from './library';

// The top-level state object
export interface ApplicationState {
  router: RouterState;
  search: SearchState;
  preferences: IPreferencesState;
  library: ILibraryState;
}

// Top-level reducer
export const createRootReducer = (history: History) => combineReducers<ApplicationState>({
  router: connectRouter(history),
  search: searchReducer,
  preferences: preferencesReducer,
  library: libraryReducer
});
