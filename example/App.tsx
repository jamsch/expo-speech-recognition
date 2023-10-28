import { StyleSheet, Text, View } from 'react-native';

import * as ExpoSpeechRecognition from 'expo-speech-recognition';

export default function App() {
  return (
    <View style={styles.container}>
      <Text>{ExpoSpeechRecognition.hello()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
