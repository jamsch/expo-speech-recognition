import { Pressable, StyleSheet, View, Text } from "react-native";

export function CheckboxButton(props: {
  title: string;
  checked: boolean;
  onPress: () => void;
  hideMark?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[
        styles.button,
        styles.checkboxButton,
        props.checked && styles.bgBlue,
        props.disabled && styles.opacity50,
      ]}
      android_ripple={{ color: "#333" }}
    >
      <View>
        {props.checked && !props.hideMark && (
          <Text style={styles.checkbox}>✓</Text>
        )}
        {!props.checked && !props.hideMark && (
          <Text style={[styles.checkbox, styles.unchecked]}>✘</Text>
        )}
        <Text style={[styles.fontBold, props.checked && styles.textWhite]}>
          {props.title}
        </Text>
      </View>
    </Pressable>
  );
}

export function OptionButton(props: {
  title: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[
        styles.button,
        { borderWidth: 2, borderColor: "transparent" },
        props.active ? styles.bgBlue : styles.borderBlue,
      ]}
      android_ripple={{ color: "#333" }}
    >
      <Text
        style={[styles.fontBold, props.active ? styles.textWhite : undefined]}
      >
        {props.title}
      </Text>
    </Pressable>
  );
}

export function BigRedButton(props: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[
        styles.button,
        { paddingHorizontal: 16, paddingVertical: 12 },
        styles.bgRed,
        props.disabled && styles.opacity50,
      ]}
      android_ripple={{ color: "#333" }}
    >
      <Text style={[styles.fontBold, styles.textWhite]}>{props.title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fontBold: { fontWeight: "bold" },
  bgBlue: { backgroundColor: "#539bf5" },
  borderBlue: { borderColor: "#539bf5" },
  bgGrey: { backgroundColor: "#eee" },
  bgRed: { backgroundColor: "#ff0000" },
  textWhite: { color: "#fff" },
  optionsContainer: { padding: 8 },
  button: {
    position: "relative",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#eee",
    margin: 2,
  },
  checkboxButton: {
    paddingLeft: 24,
  },
  checkbox: {
    position: "absolute",
    top: 0,
    left: -16,
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  unchecked: {
    color: "black",
  },
  opacity50: { opacity: 0.5 },
});
