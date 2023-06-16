delete (DOMException.prototype as unknown as Record<symbol, unknown>)[
  Symbol.for("Deno.customInspect")
];

export function domException(message?: string, name?: string): DOMException {
  const error = new DOMException(message, name);
  Error.captureStackTrace?.(error, domException);
  return error;
}
