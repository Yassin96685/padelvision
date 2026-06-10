import React from 'react';
import { View, TouchableOpacity, StatusBar, useWindowDimensions } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';

type Props = { route: { params: { uri: string; startTime?: number } }; navigation: any };

export default function VideoPlayerScreen({ route, navigation }: Props) {
  const { uri, startTime } = route.params;
  const { width, height } = useWindowDimensions();

  const player = useVideoPlayer(uri, p => {
    p.loop = false;
    if (startTime !== undefined) {
      p.currentTime = startTime;
    } else {
      p.play();
    }
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar hidden />
      <VideoView
        player={player}
        style={{ position: 'absolute', top: 0, left: 0, width, height }}
        nativeControls={true}
        contentFit="contain"
      />
      <TouchableOpacity
        onPress={() => { player.pause(); navigation.goBack(); }}
        style={{
          position: 'absolute', top: 54, right: 20,
          backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 8,
        }}
      >
        <Ionicons name="close" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
