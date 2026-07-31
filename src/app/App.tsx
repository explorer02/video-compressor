import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '../ui';
import { FlowProvider } from './flow/FlowProvider';
import { FlowRouter } from './FlowRouter';

export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <FlowProvider>
          <StatusBar style="dark" />
          <FlowRouter />
        </FlowProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
