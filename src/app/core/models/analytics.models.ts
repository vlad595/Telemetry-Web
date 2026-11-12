export enum MetricAggregation {
  Avg = 0,
  Max = 1,
  Sum = 3,
  P95 = 4,
}

export enum AnalyticsGroupingInterval {
  Min = 0,
  FiveMinutes = 1,
  Hour = 2,
  Day = 3,
}

export interface CustomMetricRule {
  metricName: string;
  aggregation: MetricAggregation;
  alias: string;
}

export interface DynamicAnalyticsRequest {
  agentId: string;
  hoursAgo: number;
  groupingInterval: AnalyticsGroupingInterval;
  rules: CustomMetricRule[];
}

export interface DailyPeakDto {
  period: string;
  p95Cpu: number;
  p95Memory: number;
}

export interface NetworkTrendDto {
  period: string;
  totalRxMegabytes: number;
  totalTxMegabytes: number;
}

export interface MetricTimelinePoint {
  period: string;
  cpuUsage: number;
  memoryUsage: number;
  networkRxMegabytes: number;
  networkTxMegabytes: number;
}

export interface MetricSnapshot {
  timestamp: string;
  cpuUsage: number;
  memoryUsage: number;
  diskSpace: number;
  networkRxBytes: number;
  networkTxBytes: number;
}

export interface MetricTimeRange {
  startTimestamp: string;
  endTimestamp: string;
}

export interface AnomalyDto {
  exactTime: string;
  cpuUsage: number;
  memoryUsage: number;
}

export interface DiskConsumptionDto {
  startDiskSpace: number;
  endDiskSpace: number;
  consumedDifference: number;
}

export interface HealthScoreDto {
  totalMeasurements: number;
  overloadedMeasurements: number;
  healthPercentage: number;
}

export interface CustomAnalyticsPoint {
  period: string;
  values: Record<string, number>;
}
