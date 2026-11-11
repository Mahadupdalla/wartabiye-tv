import React from 'react';
import { View } from 'react-native';
import { useSettings } from '../lib/settings';

// Web app (on wartabiyetv.com/app/): the website's page in a frame of the same site
export function SiteWebView({ url, onLoaded }: { url: string; external?: boolean; onTitle?: (t: string) => void; onLoaded?: () => void }) {
  const { colors } = useSettings();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {React.createElement('iframe', { src: url, title: 'Wartabiye TV', onLoad: onLoaded, style: { border: 0, width: '100%', height: '100%', flex: 1, background: colors.bg } })}
    </View>
  );
}
