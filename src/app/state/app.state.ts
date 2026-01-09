import { ActionReducerMap } from '@ngrx/store';

import { PolariState, polariReducer } from './reducers/polari.reducer';

export interface AppState {
  polari: PolariState;
}

export const rootReducers: ActionReducerMap<AppState> = {
  polari: polariReducer,
};
