/** The artifact build always runs with AI_MOCK=true, so the SDK is never called. */
export default class Anthropic {
  messages = {
    create(): never {
      throw new Error("The Anthropic API is not available in the artifact build (AI_MOCK only).");
    },
  };
}
export function betaZodOutputFormat(): never {
  throw new Error("The Anthropic API is not available in the artifact build (AI_MOCK only).");
}
