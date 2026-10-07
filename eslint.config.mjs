import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const EFFECT_RETURN = {
  selector: "CallExpression[callee.name=/^use(Layout|Insertion)?Effect$/] > ArrowFunctionExpression:matches([body.type='CallExpression'], [body.type='ChainExpression'], [body.type='AwaitExpression'])",
  message: "Effects must not return a call's result (React treats it as cleanup). Use a block body: () => { doThing(); }",
};
// Dialog contract (Phase 4): every popup is src/components/ui/Overlay.tsx's <Dialog>.
const DIALOG_ONLY = "Use <Dialog> from src/components/ui/Overlay.tsx (✕, Esc, outside click, focus trap) instead of a hand-made popup.";
const RAW_DIALOGS = [
  { selector: "JSXAttribute[name.name='role'][value.value=/^(dialog|alertdialog|menu)$/]", message: DIALOG_ONLY },
  { selector: "JSXAttribute[name.name='aria-modal']", message: DIALOG_ONLY },
  { selector: "JSXAttribute[name.name='className'] Literal[value=/(^|\\s)fixed\\s+inset-0(\\s|$)/]", message: DIALOG_ONLY },
  { selector: "JSXAttribute[name.name='className'] TemplateElement[value.raw=/(^|\\s)fixed\\s+inset-0(\\s|$)/]", message: DIALOG_ONLY },
];

const config = [
  { ignores: [".next/**", "node_modules/**", "source/**", "playwright-report/**", "test-results/**", ".data/**", "next-env.d.ts", "public/lang/**", ".cache/**", "qa/screens/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // An effect's return value is treated as its cleanup. `useEffect(() => el.scrollIntoView())` returns
      // whatever the call returns; in some hosts (the claude.ai artifact frame) that is not a function and
      // React crashes the whole tree. Use a block body unless you are returning a cleanup function.
      "no-restricted-syntax": ["error", EFFECT_RETURN, ...RAW_DIALOGS],
    },
  },
  {
    files: ["src/components/ui/Overlay.tsx", "src/app/dev/**"],
    rules: { "no-restricted-syntax": ["error", EFFECT_RETURN] },
  },
];

export default config;
