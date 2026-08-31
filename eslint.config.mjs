import next from "eslint-config-next";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...next,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      // Vendored, minified or generated - not ours to lint.
      "reference/**",
      "public/**",
      "src/lib/renderer/generated/**",
      "src/lib/fonts/font-files.generated.json",
    ],
  },
];

export default config;
