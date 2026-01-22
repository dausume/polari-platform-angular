const validStrategies = ['average', 'start-of-time-step', 'end-of-time-step', 'sum', 'count', 'none'] as const;

export type CompressionStrategy = typeof validStrategies[number];