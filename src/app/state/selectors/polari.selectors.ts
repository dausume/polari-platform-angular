import { createFeatureSelector, createSelector } from '@ngrx/store';
import { PolariState } from '../reducers/polari.reducer';

// Feature key: 'polari'
export const selectPolariState = createFeatureSelector<PolariState>('polari');

// Connection data selectors
export const selectPolariAccessNode = createSelector(selectPolariState, (s) => s.polariAccessNode);
export const selectConnectionData = createSelector(selectPolariState, (s) => s.connectionData);
export const selectServerData = createSelector(selectPolariState, (s) => s.serverData);

// Connection status selectors
export const selectConnectionStatus = createSelector(selectPolariState, (s) => s.connectionStatus);
export const selectConnectionPending = createSelector(selectPolariState, (s) => s.connectionPending);
export const selectConnectionSuccess = createSelector(selectPolariState, (s) => s.connectionSuccess);
export const selectConnectionFailure = createSelector(selectPolariState, (s) => s.connectionFailure);
export const selectIsConnected = createSelector(selectPolariState, (s) => s.connectionSuccess && !s.connectionFailure);

// User input selectors
export const selectUserEntryIp = createSelector(selectPolariState, (s) => s.userEntryIp);
export const selectUserEntryPort = createSelector(selectPolariState, (s) => s.userEntryPort);
export const selectUserConnectionInput = createSelector(
  selectUserEntryIp,
  selectUserEntryPort,
  (ip, port) => ({ ip, port })
);

// Server endpoints selectors
export const selectServerAPIendpoints = createSelector(selectPolariState, (s) => s.serverAPIendpoints);
export const selectServerCRUDEendpoints = createSelector(selectPolariState, (s) => s.serverCRUDEendpoints);

// Typing data selectors
export const selectPolyTypedObjectsData = createSelector(selectPolariState, (s) => s.polyTypedObjectsData);
export const selectPolyTypedVarsData = createSelector(selectPolariState, (s) => s.polyTypedVarsData);

// Error selector
export const selectPolariError = createSelector(selectPolariState, (s) => s.error ?? null);
