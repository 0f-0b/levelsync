import { domException } from "./dom_exception.ts";

const controller = new AbortController();
Deno.addSignalListener("SIGINT", function abort() {
  queueMicrotask(() => {
    Deno.addSignalListener("SIGINT", () => Deno.exit(0x82));
    Deno.removeSignalListener("SIGINT", abort);
  });
  controller.abort(domException("Interrupted.", "AbortError"));
});
export const signal = controller.signal;
