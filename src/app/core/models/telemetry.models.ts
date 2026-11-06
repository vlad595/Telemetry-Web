export interface MetricBase {
  instanceId: string;
  timestamp: string;
  environment: string;
}

export interface CoreLoad {
  coreId: string;
  load: number;
}

export interface MachineMetrics extends MetricBase {
  cpuName: string;
  cpuLoad: number;
  cpuCoreLoads: CoreLoad[];
  ramLoad: number;
  totalRam: number;
  wifiTx: number;
  wifiRx: number;
  openSockets: number;
  freeDiskSpace: number;
  writingSpeed: number;
  readingSpeed: number;
}

export interface ApiMetrics extends MetricBase {
  rps: number;
  latency: number;
  clientErrorCount: number;
  serverErrorCount: number;
  connectionCount: number;
}

export interface DbMetrics extends MetricBase {
  connectionsCount: number;
  slowQueriesCount: number;
  queryLatency: number;
  deadlocksCount: number;
}

export type TelemetryMetric = MachineMetrics | ApiMetrics | DbMetrics;

export function parseTelemetryMetric(payload: unknown): TelemetryMetric | null {
  try {
    const value = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!value || typeof value !== 'object') return null;

    const source = value as Record<string, unknown>;
    const fields = Object.fromEntries(
      Object.entries(source).map(([key, fieldValue]) => [key.toLowerCase(), fieldValue]),
    );

    const instanceId = fields['instanceid'];
    if (typeof instanceId !== 'string') return null;

    const base: MetricBase = {
      instanceId,
      timestamp: String(fields['timestamp'] ?? new Date().toISOString()),
      environment: String(fields['environment'] ?? 'Unknown'),
    };

    if ('cpuload' in fields) {
      const cores = Array.isArray(fields['cpucoreloads']) ? fields['cpucoreloads'] : [];
      return {
        ...base,
        cpuName: String(fields['cpuname'] ?? 'Unknown CPU'),
        cpuLoad: numberValue(fields['cpuload']),
        cpuCoreLoads: cores.map((item) => {
          const core = item as Record<string, unknown>;
          const normalized = Object.fromEntries(
            Object.entries(core).map(([key, fieldValue]) => [key.toLowerCase(), fieldValue]),
          );
          return {
            coreId: String(normalized['coreid'] ?? ''),
            load: numberValue(normalized['load']),
          };
        }),
        ramLoad: numberValue(fields['ramload']),
        totalRam: numberValue(fields['totalram']),
        wifiTx: numberValue(fields['wifitx']),
        wifiRx: numberValue(fields['wifirx']),
        openSockets: numberValue(fields['opensockets']),
        freeDiskSpace: numberValue(fields['freediskspace']),
        writingSpeed: numberValue(fields['writingspeed']),
        readingSpeed: numberValue(fields['readingspeed']),
      };
    }

    if ('rps' in fields) {
      return {
        ...base,
        rps: numberValue(fields['rps']),
        latency: numberValue(fields['latency']),
        clientErrorCount: numberValue(fields['clienterrorcount']),
        serverErrorCount: numberValue(fields['servererrorcount']),
        connectionCount: numberValue(fields['connectioncount']),
      };
    }

    if ('connectionscount' in fields) {
      return {
        ...base,
        connectionsCount: numberValue(fields['connectionscount']),
        slowQueriesCount: numberValue(fields['slowqueriescount']),
        queryLatency: numberValue(fields['querylatency']),
        deadlocksCount: numberValue(fields['deadlockscount']),
      };
    }

    return null;
  } catch {
    return null;
  }
}

function numberValue(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}
