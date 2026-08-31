import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioStatus,
} from "expo-audio";
import { SmallButton } from "./ui/Buttons";

function formatSeconds(seconds: number) {
  return `${Math.max(0, seconds).toFixed(2)}s`;
}

/**
 * Plays back a persisted recording, so you can hear whether the tail of the
 * audio survived (e.g. after stopping recognition mid-sentence).
 *
 * Remount this (via `key`) when a new recording is written to the same path,
 * otherwise the native player keeps serving the previous file.
 */
export function RecordingPlayer(props: { uri: string }) {
  const player = useAudioPlayer({ uri: props.uri });
  const eventStatus = useAudioPlayerStatus(player);
  const [polledStatus, setPolledStatus] = useState<AudioStatus | null>(null);

  // A local file usually becomes ready before this component subscribes, and the
  // native player only emits periodic updates while playing — so that one "ready"
  // event is missed and the status stays stuck at the initial snapshot. Poll until
  // it reports loaded, so the duration shows up without having to press play.
  useEffect(() => {
    if (eventStatus.isLoaded) {
      return;
    }
    const interval = setInterval(() => {
      const current = player.currentStatus;
      setPolledStatus(current);
      if (current.isLoaded) {
        clearInterval(interval);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [player, eventStatus.isLoaded]);

  const status = eventStatus.isLoaded ? eventStatus : (polledStatus ?? eventStatus);

  useEffect(() => {
    // Recognition leaves the iOS audio session in record mode, which would
    // otherwise route playback to the receiver (or silence it)
    setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(
      (error) => console.warn("Failed to set audio mode", error),
    );
  }, []);

  const play = () => {
    if (status.didJustFinish || status.currentTime >= status.duration) {
      player.seekTo(0);
    }
    player.play();
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <SmallButton
          title={status.playing ? "Pause" : "Play recording"}
          onPress={() => (status.playing ? player.pause() : play())}
        />
        <SmallButton
          title="Restart"
          onPress={() => {
            player.seekTo(0);
            player.play();
          }}
        />
      </View>
      <Text style={styles.text}>
        {formatSeconds(status.currentTime)} / {formatSeconds(status.duration)} (
        {status.playbackState})
      </Text>
      {status.isLoaded && status.duration === 0 ? (
        <Text style={styles.warning}>
          Duration is 0s — the WAV was skipped or written empty.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  text: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  warning: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#b00",
  },
});
