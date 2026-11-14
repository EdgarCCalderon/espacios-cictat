/**
 * Layout raíz (Expo Router).
 * Proveedores globales: SafeArea → Paper (tema CICTAT) → Auth.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/presentation/context/AuthContext';
import { cictatColors, cictatTheme } from '@/presentation/theme/cictatTheme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider
        theme={cictatTheme}
        settings={{ icon: (props) => <MaterialCommunityIcons {...props} /> }}
      >
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: cictatColors.background },
            }}
          />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
