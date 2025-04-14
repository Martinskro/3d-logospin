import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^(_|Shape|Vector2|ExtrudeGeometry|Mesh|TextureLoader|Group|WebGLRenderer|Scene|PerspectiveCamera|html2canvas|FFmpeg|fetchFile|toBlobURL)",
          "caughtErrorsIgnorePattern": "^_",
          "ignoreRestSiblings": true
        }
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/exhaustive-deps": [
        "warn",
        {
          "additionalHooks": "(useFrame|useThree)"
        }
      ],
      "@next/next/no-page-custom-font": "off"
    }
  },
  {
    files: ["src/app/components/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off"
    }
  }
];

export default eslintConfig;
