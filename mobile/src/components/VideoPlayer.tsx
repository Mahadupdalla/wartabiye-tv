import React from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

// Publisher videos are only EMBEDDED with YouTube's own player (the publisher allows embedding; nothing is downloaded or
// re-uploaded), the same as on the website. Privacy-enhanced youtube-nocookie.com domain.
export function VideoPlayer({ videoId, title }: { videoId: string; title: string }) {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#000;height:100%}iframe{border:0;width:100%;height:100%}</style></head><body><iframe src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="${title.replace(/"/g, '&quot;')}"></iframe></body></html>`;
  return (
    <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }}>
      <WebView source={{ html, baseUrl: 'https://www.wartabiyetv.com/' }} allowsFullscreenVideo allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} style={{ flex: 1, backgroundColor: '#000' }} />
    </View>
  );
}
