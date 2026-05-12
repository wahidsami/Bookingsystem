import AsyncStorage from '@react-native-async-storage/async-storage';

const RUNTIME_LOGS_KEY = 'rifah_staff_runtime_logs';
const MAX_LOG_ENTRIES = 120;

type RuntimeLogEntry = {
  timestamp: string;
  level: 'info' | 'error';
  event: string;
  data?: Record<string, unknown>;
};

function toSerializable(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return { note: 'non_serializable_object' };
    }
  }
  return value as unknown;
}

async function writeLog(entry: RuntimeLogEntry): Promise<void> {
  try {
    const current = await AsyncStorage.getItem(RUNTIME_LOGS_KEY);
    const parsed: RuntimeLogEntry[] = current ? JSON.parse(current) : [];
    const next = [...parsed, entry].slice(-MAX_LOG_ENTRIES);
    await AsyncStorage.setItem(RUNTIME_LOGS_KEY, JSON.stringify(next));
  } catch {
    // Avoid crashing the app while trying to persist debug logs.
  }
}

export async function logRuntimeInfo(event: string, data?: Record<string, unknown>): Promise<void> {
  await writeLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    event,
    data: data ? (toSerializable(data) as Record<string, unknown>) : undefined,
  });
}

export async function logRuntimeError(event: string, error: unknown, data?: Record<string, unknown>): Promise<void> {
  await writeLog({
    timestamp: new Date().toISOString(),
    level: 'error',
    event,
    data: {
      ...(data || {}),
      error: toSerializable(error),
    },
  });
}

export async function getRuntimeLogs(): Promise<RuntimeLogEntry[]> {
  try {
    const current = await AsyncStorage.getItem(RUNTIME_LOGS_KEY);
    return current ? (JSON.parse(current) as RuntimeLogEntry[]) : [];
  } catch {
    return [];
  }
}

export async function clearRuntimeLogs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RUNTIME_LOGS_KEY);
  } catch {
    // Ignore cleanup failures.
  }
}
