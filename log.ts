import { bold, green, red, yellow } from "./deps/std/fmt/colors.ts";

export const log = {
  step: (tag: string, ...message: unknown[]) =>
    console.log(green(tag), ...message),
  warn: console.warn.bind(null, yellow("Warning")),
  error: console.error.bind(null, `${bold(red("error"))}:`),
};
