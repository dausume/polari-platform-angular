import { ActionReducerMap } from '@ngrx/store';

import { PolariState, polariReducer } from './reducers/polari.reducer';
import { DynamicObjectsState, dynamicObjectsReducer } from './reducers/dynamic-objects.reducer';

export interface AppState {
  polari: PolariState;
  dynamicObjects: DynamicObjectsState;
}

export const rootReducers: ActionReducerMap<AppState> = {
  polari: polariReducer,
  dynamicObjects: dynamicObjectsReducer
};
