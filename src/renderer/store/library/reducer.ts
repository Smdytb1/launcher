import { Reducer } from 'redux';
import { ActionType, getType } from 'typesafe-actions';
import { createDefaultGameLibrary } from '../../../shared/library/GameLibrary';
import { deepCopy } from '../../../shared/Util';
import * as actions from './actions';
import { ILibraryState } from './types';

const initialState: ILibraryState = {
  data: deepCopy(createDefaultGameLibrary()),
}

export type ReducerAction = ActionType<typeof actions>;

const reducer: Reducer<ILibraryState, ReducerAction> = (state = initialState, action) => {
  switch (action.type) {
    case getType(actions.updateLibrary): {
      return { ...state, data: { ...state.data, ...action.payload } };
    }
    default: {
      return state;
    }
  }
}

export { reducer as libraryReducer };
