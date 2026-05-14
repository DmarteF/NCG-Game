import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import GlobalMusicPlayer from '../src/components/GlobalMusicPlayer';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: '#050202',
          },
          animation: 'fade',
        }}
      />
      <GlobalMusicPlayer />
    </SafeAreaProvider>
  );
}
