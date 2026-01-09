import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { polariNode } from '@models/polariNode';

export const PolariActions = createActionGroup({
  source: 'Polari',
  events: {
    // Connection actions
    'Connect': props<{ ip: string; port: string }>(),
    'Connect Success': props<{ connectionData: polariNode }>(),
    'Connect Failure': props<{ error: string }>(),
    'Disconnect': emptyProps(),
    'Disconnect Success': emptyProps(),

    // Connection state updates
    'Set Connection Pending': props<{ pending: boolean }>(),
    'Set Connection Success': props<{ success: boolean }>(),
    'Set Connection Failure': props<{ failure: boolean }>(),

    // User input updates
    'Update IP': props<{ ip: string }>(),
    'Update Port': props<{ port: string }>(),

    // Server data updates
    'Load Connection Data': emptyProps(),
    'Load Connection Data Success': props<{ data: polariNode }>(),
    'Load Connection Data Failure': props<{ error: string }>(),
  },
});
