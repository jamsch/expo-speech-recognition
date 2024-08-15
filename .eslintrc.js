module.exports = {
  root: true,
  extends: ["universe/native", "universe/web"],
  ignorePatterns: ["build"],
  globals: {
    __dirname: true,
  },
  rules: {
    "import/order": "off",
    "@typescript-eslint/array-type": "off",
  },
};
