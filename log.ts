export const log = {
  step: (tag: string, message: string) =>
    console.log("%c%s%c", "color: green", tag, "", message),
  warn: (message: string) =>
    console.warn("%cWarning%c", "color: yellow", "", message),
  error: (message: string) =>
    console.error("%cerror%c:", "color: red; font-weight: bold", "", message),
};
