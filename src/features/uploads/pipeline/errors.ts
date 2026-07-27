/** What went wrong, at the granularity the upload UI reports it: each kind gets its own
 *  message rather than a generic failure. Quota failures are not here — they come out of
 *  the UploadStore write, not the pipeline. */
export type UploadErrorKind = "unreadable" | "empty" | "removal-failed";

export class UploadError extends Error {
  kind: UploadErrorKind;

  constructor(kind: UploadErrorKind, message: string) {
    super(message);
    this.name = "UploadError";
    this.kind = kind;
  }
}

export function isUploadError(value: unknown): value is UploadError {
  return value instanceof UploadError;
}
