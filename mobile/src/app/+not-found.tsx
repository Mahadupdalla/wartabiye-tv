import React from 'react';
import { View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSettings } from '../lib/settings';
import { Notice } from '../components/ui';

export default function NotFound() {
  const { colors, t } = useSettings();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Wartabiye TV' }} />
      <Notice tone="warn" text={t('notFound')} action={t('home')} onAction={() => router.replace('/')} />
    </View>
  );
}
