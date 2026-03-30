import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getApiUrl } from './src/config/env';
import { fetchApiHealth } from './src/lib/api';

export default function App() {
  const apiUrl = getApiUrl();
  const [loading, setLoading] = useState(false);
  const [healthMessage, setHealthMessage] = useState<string | null>(null);

  const pingApi = useCallback(async () => {
    setLoading(true);
    setHealthMessage(null);
    try {
      const r = await fetchApiHealth();
      if (r.ok && r.data?.message) setHealthMessage(String(r.data.message));
      else if (r.data?.message) setHealthMessage(String(r.data.message));
      else if (r.error) setHealthMessage(`Error: ${r.error}`);
      else setHealthMessage('Connected (unexpected response)');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.logo}>رفاه</Text>
        <Text style={styles.title}>Rifah Staff</Text>
        <Text style={styles.subtitle}>Salon & spa team app</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>API base</Text>
        <Text style={styles.mono} selectable>
          {apiUrl}
        </Text>
        <Text style={styles.hint}>
          Set EXPO_PUBLIC_API_URL in .env (use your production API URL or your computer LAN IP
          for device testing).
        </Text>

        <Pressable style={styles.button} onPress={pingApi} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Ping API</Text>
          )}
        </Pressable>

        {healthMessage ? (
          <Text style={styles.result} selectable>
            {healthMessage}
          </Text>
        ) : null}

        <View style={styles.spacer} />

        <Text style={styles.footer}>
          Staff login and schedules will connect here once the backend exposes staff authentication.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#4c1d95',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  logo: {
    fontSize: 36,
    fontWeight: '700',
    color: '#f5f3ff',
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#ddd6fe',
    textAlign: 'center',
    marginTop:4,
  },
  card: {
    flex: 1,
    backgroundColor: '#fafafa',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#111',
    marginTop: 8,
    lineHeight: 20,
  },
  hint: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 12,
    lineHeight: 20,
  },
  button: {
    marginTop: 24,
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  result: {
    marginTop: 16,
    fontSize: 14,
    color: '#065f46',
    backgroundColor: '#d1fae5',
    padding: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  spacer: {
    flex: 1,
    minHeight: 16,
  },
  footer: {
    paddingTop: 8,
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 18,
  },
});
