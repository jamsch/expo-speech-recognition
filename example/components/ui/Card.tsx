import { ScrollView, StyleSheet, View } from "react-native";

export function Card<
  TUse extends typeof View | typeof ScrollView = typeof View,
>(
  props: {
    use?: TUse;
  } & React.ComponentPropsWithoutRef<TUse>,
) {
  const { use, style, ...rest } = props;
  const Component = use || View;

  return <Component style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#eee",
    padding: 10,
    borderRadius: 10,
    borderColor: "#ccc",
    borderWidth: 2,
    width: "100%",
  },
});
