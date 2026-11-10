import React from 'react';
import { View } from 'react-native';

export function VideoPlayer({ videoId, title }: { videoId: string; title: string }) {
  return (
    <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }}>
      {React.createElement('iframe', {
        src: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`,
        title, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowFullScreen: true,
        style: { border: 0, width: '100%', height: '100%' },
      })}
    </View>
  );
}
