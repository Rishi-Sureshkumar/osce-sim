import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "source/**", "playwright-report/**", "test-results/**", ".data/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // An effect's return value is treated as its cleanup. `useEffect(() => el.scrollIntoView())` returns
      // whatever the call returns; in some hosts (the claude.ai artifact frame) that is not a function and
      // React crashes the whole tree. Use a block body unless you are returning a cleanup function.
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name=/^use(Layout|Insertion)?Effect$/] > ArrowFunctionExpression:matches([body.type='CallExpression'], [body.type='ChainExpression'], [body.type='AwaitExpression'])",
          message: "Effects must not return a call's result (React treats it as cleanup). Use a block body: () => { doThing(); }",
        },
      ],
    },
  },
];

export default config;
