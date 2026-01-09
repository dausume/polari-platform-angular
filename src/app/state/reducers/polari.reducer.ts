import { createReducer, on } from '@ngrx/store';
import { PolariActions } from '../actions/polari.actions';
import { polariNode } from '@models/polariNode';

export const ConnectionStatuses = {
  Unknown: 'unknown',
  Connecting: 'connecting',
  Connected: 'connected',
  Disconnected: 'disconnected',
  Failed: 'failed',
} as const;

export type ConnectionStatus = typeof ConnectionStatuses[keyof typeof ConnectionStatuses];

export interface PolariState {
  // Connection data
  polariAccessNode: polariNode | null;
  connectionData: any;
  serverData: any;

  // Connection status
  connectionPending: boolean;
  connectionSuccess: boolean;
  connectionFailure: boolean;
  connectionStatus: ConnectionStatus;

  // User inputs
  userEntryIp: string;
  userEntryPort: string;

  // Server endpoints and typing data
  serverAPIendpoints: any[];
  serverCRUDEendpoints: any[];
  polyTypedObjectsData: any[];
  polyTypedVarsData: any[];

  // Error state
  error: string | null;
}

export const initialPolariState: PolariState = {
  polariAccessNode: null,
  connectionData: {},
  serverData: {},
  connectionPending: false,
  connectionSuccess: false,
  connectionFailure: false,
  connectionStatus: ConnectionStatuses.Unknown,
  userEntryIp: '',
  userEntryPort: '',
  serverAPIendpoints: [],
  serverCRUDEendpoints: [],
  polyTypedObjectsData: [],
  polyTypedVarsData: [],
  error: null,
};

export const polariReducer = createReducer(
  initialPolariState,

  // Connection actions
  on(PolariActions.connect, (state, { ip, port }) => ({
    ...state,
    userEntryIp: ip,
    userEntryPort: port,
    connectionPending: true,
    connectionStatus: ConnectionStatuses.Connecting,
    connectionFailure: false,
    error: null,
  })),

  on(PolariActions.connectSuccess, (state, { connectionData }) => ({
    ...state,
    polariAccessNode: connectionData,
    connectionPending: false,
    connectionSuccess: true,
    connectionStatus: ConnectionStatuses.Connected,
    connectionFailure: false,
    error: null,
  })),

  on(PolariActions.connectFailure, (state, { error }) => ({
    ...state,
    connectionPending: false,
    connectionSuccess: false,
    connectionStatus: ConnectionStatuses.Failed,
    connectionFailure: true,
    error,
  })),

  on(PolariActions.disconnect, (state) => ({
    ...state,
    connectionPending: false,
    connectionSuccess: false,
    connectionStatus: ConnectionStatuses.Disconnected,
  })),

  on(PolariActions.disconnectSuccess, (state) => ({
    ...initialPolariState,
    userEntryIp: state.userEntryIp,
    userEntryPort: state.userEntryPort,
    connectionStatus: ConnectionStatuses.Disconnected,
  })),

  // Connection state updates
  on(PolariActions.setConnectionPending, (state, { pending }) => ({
    ...state,
    connectionPending: pending,
  })),

  on(PolariActions.setConnectionSuccess, (state, { success }) => ({
    ...state,
    connectionSuccess: success,
  })),

  on(PolariActions.setConnectionFailure, (state, { failure }) => ({
    ...state,
    connectionFailure: failure,
  })),

  // User input updates
  on(PolariActions.updateIP, (state, { ip }) => ({
    ...state,
    userEntryIp: ip,
  })),

  on(PolariActions.updatePort, (state, { port }) => ({
    ...state,
    userEntryPort: port,
  })),

  // Server data updates
  on(PolariActions.loadConnectionData, (state) => ({
    ...state,
    connectionPending: true,
    error: null,
  })),

  on(PolariActions.loadConnectionDataSuccess, (state, { data }) => ({
    ...state,
    connectionData: data,
    connectionPending: false,
    error: null,
  })),

  on(PolariActions.loadConnectionDataFailure, (state, { error }) => ({
    ...state,
    connectionPending: false,
    error,
  }))
);
