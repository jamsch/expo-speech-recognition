import { Platform, StyleSheet, Text, type TextProps } from "react-native";

export function MonoText(
  props: {
    children: React.ReactNode;
  } & TextProps,
) {
  const { style, ...rest } = props;
  return <Text style={[styles.text, style]} {...rest} />;
}

const styles = StyleSheet.create({
  text: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
});
