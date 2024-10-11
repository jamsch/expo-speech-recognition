import { useSpeechRecognitionEvent } from "expo-speech-recognition";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  withSpring,
  withSequence,
} from "react-native-reanimated";
const avatar = require("../assets/avatar.png");

const MIN_SCALE = 1;
const MAX_SCALE = 1.5;

/**
 * This is an example component that uses the `volumechange` event to animate the volume metering of a user's voice.
 */
export function VolumeMeteringAvatar() {
  const haloScale = useSharedValue(MIN_SCALE);
  const pulseScale = useSharedValue(MIN_SCALE);
  const pulseOpacity = useSharedValue(0);

  const reset = () => {
    haloScale.value = MIN_SCALE;
    pulseScale.value = MIN_SCALE;
    pulseOpacity.value = 0;
  };

  useSpeechRecognitionEvent("start", reset);
  useSpeechRecognitionEvent("end", reset);

  useSpeechRecognitionEvent("volumechange", (event) => {
    // Don't animate anything if the volume is too low
    if (event.value <= 1) {
      return;
    }

    const newScale = interpolate(
      event.value,
      [-2, 10], // The value range is between -2 and 10
      [MIN_SCALE, MAX_SCALE],
      Extrapolation.CLAMP,
    );

    // Animate the halo scaling
    haloScale.value = withSequence(
      withSpring(newScale, {
        damping: 15,
        stiffness: 150,
      }),
      withTiming(MIN_SCALE, {
        duration: 500,
        easing: Easing.linear,
      }),
    );

    // Animate the pulse (scale and fade out)
    if (pulseOpacity.value <= 0) {
      pulseScale.value = MIN_SCALE;
      pulseOpacity.value = 1;
      pulseScale.value = withTiming(MAX_SCALE, {
        duration: 1000,
        easing: Easing.out(Easing.quad),
      });
      pulseOpacity.value = withTiming(0, { duration: 1000 });
    }
  });

  const haloAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloScale.value }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.pulseContainer}>
        <Animated.View style={[styles.halo, haloAnimatedStyle]} />
      </View>
      <View style={styles.pulseContainer}>
        <Animated.View style={[styles.pulse, pulseAnimatedStyle]} />
      </View>
      <View style={[styles.centered]}>
        <Image source={avatar} style={styles.avatar} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    marginVertical: 20,
  },
  pulseContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  pulse: {
    borderWidth: 1,
    borderColor: "#539bf5",
    width: 96,
    height: 96,
    borderRadius: 96,
  },
  halo: {
    backgroundColor: "#6b7280",
    width: 96,
    height: 96,
    borderRadius: 96,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 96,
    overflow: "hidden",
  },
});
