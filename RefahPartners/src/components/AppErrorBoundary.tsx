import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { getRuntimeLogs, logRuntimeError } from '../utils/runtimeLogs';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  errorMessage: string;
  errorId: string;
  recentLogs: string;
  debugStack: string;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      errorId: '',
      recentLogs: '',
      debugStack: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unknown runtime error',
      errorId: `ERR-${Date.now().toString(36).toUpperCase()}`,
    };
  }

  async componentDidCatch(error: Error, info: React.ErrorInfo) {
    await logRuntimeError('react_error_boundary', error, {
      componentStack: info?.componentStack || '',
    });
    const logs = await getRuntimeLogs();
    const recent = logs.slice(-12).map((entry) => `${entry.timestamp} [${entry.level}] ${entry.event}`);
    const stackPreview = [
      error?.stack || '',
      info?.componentStack || '',
    ]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 3000);

    this.setState({
      recentLogs: recent.join('\n'),
      debugStack: stackPreview,
    });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>App Runtime Error</Text>
        <Text style={styles.subtitle}>The app hit an unexpected error instead of continuing with a gray screen.</Text>
        <Text style={styles.errorId}>Reference: {this.state.errorId}</Text>
        <Text style={styles.message}>{this.state.errorMessage}</Text>

        <ScrollView style={styles.logBox} contentContainerStyle={styles.logBoxContent}>
          <Text style={styles.logText}>
            {this.state.recentLogs || 'No runtime logs captured yet.'}
          </Text>
          {this.state.debugStack ? (
            <Text style={styles.stackText}>
              {'\n'}--- stack ---{'\n'}
              {this.state.debugStack}
            </Text>
          ) : null}
        </ScrollView>

        <Text style={styles.footer}>Please send this screen (screenshot) to support/dev.</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: '#d1d5db',
    fontSize: 14,
    marginBottom: 12,
  },
  errorId: {
    color: '#a78bfa',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  message: {
    color: '#fca5a5',
    fontSize: 14,
    marginBottom: 14,
  },
  logBox: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 12,
  },
  logBoxContent: {
    padding: 12,
  },
  logText: {
    color: '#e5e7eb',
    fontSize: 12,
    lineHeight: 18,
  },
  stackText: {
    color: '#fca5a5',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
  },
  footer: {
    marginTop: 12,
    color: '#d1d5db',
    fontSize: 12,
  },
});
