// Types for the in-app AI assistant (Phase 4).
// Mirrors the backend /ai/chat contract (polariApiServer/aiChatAPI.py).

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiCapability {
  area: string;
  intent: string;
}

export interface AiChatRequest {
  message: string;
  history?: ChatTurn[];
}

export interface AiProposal {
  proposal_id: string;
  operation: string;
  authority_level: number;
  authority_label: string;
  summary: string;
  request?: unknown;
  gate?: { executable: boolean; reason: string };
  dry_run?: boolean;
}

export interface AiActResult {
  ok: boolean;
  proposal_id?: string;
  result?: unknown;
  refused?: boolean;
  reason?: string;
  error?: string;
}

export interface AiChatResponse {
  provider: string;
  mode?: string;
  reply: string;
  capabilities?: AiCapability[];
  proposals?: AiProposal[];
  node_context?: {
    class_counts?: Record<string, number>;
    object_types?: number;
  };
  provider_note?: string;
  model?: string;
}

export interface ProviderStatus {
  name: string;
  description?: string;
  sdk_installed?: boolean;
  has_credential?: boolean;
  needs_base_url?: boolean;
  default_model?: string | null;
  ready: boolean;
  needs: string[];
}

export interface ProvidersStatus {
  active: string;
  active_via_env?: boolean;
  providers: ProviderStatus[];
}
