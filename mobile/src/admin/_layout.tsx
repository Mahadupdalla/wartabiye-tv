// Wartabiye TV Admin: a separate iPhone app for the owner only (built with WTV_APP=admin, see app.config.js and
// scripts/iphone-admin-install.sh). It has its own routes (this folder), so none of this code is in the public app.
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { PublicSans_400Regular } from '@expo-google-fonts/public-sans/400Regular';
import { PublicSans_500Medium } from '@expo-google-fonts/public-sans/500Medium';
import { PublicSans_700Bold } from '@expo-google-fonts/public-sans/700Bold';
import { SettingsProvider } from '../lib/settings';
import { useOtaUpdates } from '../lib/ota';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Updates() {
  useOtaUpdates();
  return null;
}

export default function AdminLayout() {
  const [fontsLoaded] = useFonts({ 'ArchivoCond-700': require('../../assets/fonts/ArchivoCond-700.ttf'), 'ArchivoCond-800': require('../../assets/fonts/ArchivoCond-800.ttf'), 'ArchivoCond-900': require('../../assets/fonts/ArchivoCond-900.ttf'), PublicSans_400Regular, PublicSans_500Medium, PublicSans_700Bold });
  useEffect(() => { if (fontsLoaded) SplashScreen.hideAsync().catch(() => undefined); }, [fontsLoaded]);
  if (!fontsLoaded && Platform.OS !== 'web') return null;
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <StatusBar style="light" />
        <Updates />
        <Slot />
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
