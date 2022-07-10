delete (DOMException.prototype as never)[Symbol.for("Deno.customInspect")];

export function domException(message?: string, name?: string): DOMException {
  const error = new DOMException(message, name);
  Error.captureStackTrace?.(error, domException);
  return error;
}
