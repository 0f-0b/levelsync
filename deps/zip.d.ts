import type { Awaitable } from "../async.ts";

type Merge<T, U> = Omit<T, keyof U> & U;

export interface DeflateOptions {
  level?: number;
  chunkSize?: number;
}

export interface InflateOptions {
  chunkSize?: number;
}

export interface SyncCodec {
  append(data: Uint8Array): Uint8Array;
  flush(): Uint8Array | undefined;
}

export interface EventBasedCodec {
  push(data: Uint8Array, finalChunk?: boolean): unknown;
}

export interface Configuration {
  baseURL?: string;
  chunkSize?: number;
  maxWorkers?: number;
  terminateWorkerTimeout?: number;
  useWebWorkers?: boolean;
  useCompressionStream?: boolean;
  Deflate?: new (options: DeflateOptions) => SyncCodec;
  Inflate?: new (options: InflateOptions) => SyncCodec;
  CompressionStream?: new (
    format: string,
    options: DeflateOptions,
  ) => CompressionStream;
  DecompressionStream?: new (
    format: string,
    options: InflateOptions,
  ) => DecompressionStream;
  workerScripts?: {
    deflate?: string[];
    inflate?: string[];
  };
}

export function configure(configuration: Configuration): undefined;
export function initShimAsyncCodec<T extends EventBasedCodec, DO, IO>(
  library: {
    Deflate: new (options: Merge<DO, DeflateOptions>) => T;
    Inflate: new (options: Merge<IO, InflateOptions>) => T;
  },
  options: {
    deflate?: DO;
    inflate?: IO;
  } | undefined,
  registerDataHandler: (
    codec: T,
    handler: (data: ArrayLike<number>) => undefined,
  ) => unknown,
): {
  Deflate: new (options?: DeflateOptions) => SyncCodec;
  Inflate: new (options?: InflateOptions) => SyncCodec;
};
export function terminateWorkers(): undefined;
export function getMimeType(filename: string): string;

export interface ReadableByteStream extends ReadableStream<Uint8Array> {
  size?: number;
}

export interface ReadableReader {
  readonly readable: ReadableByteStream;
  size?: number;
  chunkSize?: number;
  initialized?: boolean;
  init?(): unknown;
}

export type ReadableReaderLike =
  | ReadableReader
  | ReadableByteStream
  | readonly Reader[];

export interface SeekableReadableByteStream extends ReadableByteStream {
  diskNumberStart?: number;
  offset?: number;
}

export interface SeekableReadableReader extends ReadableReader {
  readonly readable: SeekableReadableByteStream;
  lastDiskNumber?: number;
  size: number;
  readUint8Array(
    index: number,
    length: number,
    diskNumber?: number,
  ): Awaitable<Uint8Array>;
}

export interface WritableByteStream extends WritableStream<Uint8Array> {
  size?: number;
}

export interface WritableWriter {
  readonly writable: WritableByteStream;
  diskNumber?: number;
  diskOffset?: number;
  availableSize?: number;
  maxSize?: number;
  initialized?: boolean;
  init?(sizeHint?: number): unknown;
  getData?(): unknown;
}

export type WritableWriterLike =
  | WritableWriter
  | WritableByteStream
  | DiskWriterIterator;

declare class Stream {
  size: number;
  initialized?: boolean;
  init(): Awaitable<undefined>;
}

export abstract class Reader extends Stream implements SeekableReadableReader {
  chunkSize?: number;
  readonly readable: SeekableReadableByteStream;
  abstract readUint8Array(
    index: number,
    length: number,
    diskNumber?: number,
  ): Awaitable<Uint8Array>;
}

export class TextReader extends Reader implements SeekableReadableReader {
  constructor(text: string);
  override init(): undefined;
  override readUint8Array(index: number, length: number): Promise<Uint8Array>;
}

export class BlobReader extends Reader implements SeekableReadableReader {
  constructor(blob: Blob);
  override init(): undefined;
  override readUint8Array(index: number, length: number): Promise<Uint8Array>;
}

export class Data64URIReader extends Reader implements SeekableReadableReader {
  constructor(dataURI: string);
  override init(): undefined;
  override readUint8Array(index: number, length: number): Uint8Array;
}

export class Uint8ArrayReader extends Reader implements SeekableReadableReader {
  constructor(array: Uint8Array);
  override init(): undefined;
  override readUint8Array(index: number, length: number): Uint8Array;
}

export interface HttpOptions extends HttpRangeOptions {
  useRangeHeader?: boolean;
}

export class HttpReader extends Reader implements SeekableReadableReader {
  constructor(url: string, options?: HttpOptions);
  override init(): Promise<undefined>;
  override readUint8Array(index: number, length: number): Promise<Uint8Array>;
}

export interface HttpRangeOptions
  extends Omit<RequestInit, "headers" | "body" | "method"> {
  preventHeadRequest?: boolean;
  forceRangeRequests?: boolean;
  useXHR?: boolean;
  headers?: Iterable<[string, string]> | Record<string, string>;
}

export class HttpRangeReader extends Reader implements SeekableReadableReader {
  constructor(url: string, options?: HttpRangeOptions);
  override init(): Promise<undefined>;
  override readUint8Array(index: number, length: number): Promise<Uint8Array>;
}

export class SplitDataReader extends Reader implements SeekableReadableReader {
  lastDiskNumber?: number;
  constructor(readers: readonly Reader[]);
  override init(): Promise<undefined>;
  override readUint8Array(
    index: number,
    length: number,
    diskNumber?: number,
  ): Promise<Uint8Array>;
}

/** @deprecated */
export const SplitZipReader: typeof SplitDataReader;
/** @deprecated */
export type SplitZipReader = SplitDataReader;

export abstract class Writer extends Stream implements WritableWriter {
  readonly writable: WritableByteStream;
  writeUint8Array(array: Uint8Array): Awaitable<undefined>;
}

export class TextWriter extends Writer implements WritableWriter {
  constructor(encoding?: string);
  override init(): undefined;
  override writeUint8Array(array: Uint8Array): undefined;
  getData(): Promise<string>;
}

export class BlobWriter extends Stream implements WritableWriter {
  readonly writable: WritableByteStream;
  constructor(contentType?: string);
  override init(): undefined;
  getData(): Promise<Blob>;
}

export class Data64URIWriter extends Writer implements WritableWriter {
  constructor(contentType?: string);
  override init(): undefined;
  override writeUint8Array(array: Uint8Array): undefined;
  getData(): string;
}

export class Uint8ArrayWriter extends Writer implements WritableWriter {
  override init(sizeHint?: number): undefined;
  override writeUint8Array(array: Uint8Array): undefined;
  getData(): Uint8Array;
}

export interface DiskWriter {
  readonly writable: WritableByteStream;
  size?: number;
  maxSize?: number;
  initialized?: boolean;
  init?(): unknown;
}

export interface DiskWriterIterator {
  next(): Awaitable<IteratorResult<DiskWriter, DiskWriter | undefined>>;
}

export class SplitDataWriter extends Stream implements WritableWriter {
  diskNumber: number;
  diskOffset: number;
  availableSize: number;
  maxSize: number;
  readonly writable: WritableByteStream;
  constructor(writers: DiskWriterIterator, splitAt?: number);
  override init(): undefined;
}

/** @deprecated */
export const SplitZipWriter: typeof SplitDataWriter;
/** @deprecated */
export type SplitZipWriter = SplitDataWriter;

export interface BitFlag {
  level: number;
  dataDescriptor: boolean;
  languageEncodingFlag: boolean;
}

export interface ExtraField {
  type: number;
  data: Uint8Array;
}

export interface ExtraFieldZip64 extends ExtraField {
  values: number[];
  diskNumberStart?: number;
  offset?: number;
  compressedSize?: number;
  uncompressedSize?: number;
}

export interface ExtraFieldUnicode extends ExtraField {
  version: number;
  signature: number;
  valid: boolean;
}

export interface ExtraFieldUnicodePath extends ExtraFieldUnicode {
  filename: string;
}

export interface ExtraFieldUnicodeComment extends ExtraFieldUnicode {
  comment: string;
}

export interface ExtraFieldAES extends ExtraField {
  vendorVersion: number;
  vendorId: number;
  strength: number;
  originalCompressionMethod: number;
  compressionMethod: number;
}

export interface ExtraFieldNTFS extends ExtraField {
  lastModDate: Date;
  rawLastModDate: bigint;
  lastAccessDate: Date;
  rawLastAccessDate: bigint;
  creationDate: Date;
  rawCreationDate: bigint;
}

export interface ExtraFieldExtendedTimestamp extends ExtraField {
  lastModDate?: Date;
  rawLastModDate?: number;
  lastAccessDate?: Date;
  rawLastAccessDate?: number;
  creationDate?: Date;
  rawCreationDate?: number;
}

export interface Entry {
  diskNumberStart: number;
  offset: number;
  filename: string;
  rawFilename: Uint8Array;
  filenameUTF8: boolean;
  directory: boolean;
  encrypted: boolean;
  compressedSize: number;
  uncompressedSize: number;
  lastModDate: Date;
  rawLastModDate: number;
  lastAccessDate?: Date;
  creationDate?: Date;
  comment: string;
  rawComment: Uint8Array;
  commentUTF8: boolean;
  extraField?: Map<number, ExtraField>;
  extraFieldZip64?: ExtraFieldZip64;
  extraFieldUnicodePath?: ExtraFieldUnicodePath;
  extraFieldUnicodeComment?: ExtraFieldUnicodeComment;
  extraFieldAES?: ExtraFieldAES;
  extraFieldNTFS?: ExtraFieldNTFS;
  extraFieldExtendedTimestamp?: ExtraFieldExtendedTimestamp;
  rawExtraField: Uint8Array;
  signature?: number;
  zip64?: boolean;
  compressionMethod: number;
  bitFlag?: BitFlag;
  version: number;
  versionMadeBy: number;
  msDosCompatible: boolean;
  internalFileAttribute: number;
  externalFileAttribute: number;
}

export interface ReadOptions {
  checkPasswordOnly?: boolean;
  checkSignature?: boolean;
  password?: string;
  useWebWorkers?: boolean;
  useCompressionStream?: boolean;
  signal?: AbortSignal;
  preventClose?: boolean;
  transferStreams?: boolean;
}

export interface EntryDataProgressEventHandler {
  onstart?: (total: number) => unknown;
  onprogress?: (progress: number, total: number) => unknown;
  onend?: (computedSize: number) => unknown;
}

type WritableWriterFrom<
  T extends WritableWriterLike,
> = T extends DiskWriterIterator ? SplitDataWriter
  : T extends WritableStream<never> ? { writable: T }
  : T;
type GetData<
  T extends WritableWriter,
> = T["getData"] extends () => infer R ? Awaited<R>
  : T["writable"];

export interface ReadableEntry extends Entry {
  getData<T extends WritableWriterLike | null>(
    writer: T,
    options?: EntryDataProgressEventHandler & ReadOptions,
  ): Promise<
    T extends WritableWriterLike ? GetData<WritableWriterFrom<T>> : undefined
  >;
}

export interface GetEntriesOptions {
  filenameEncoding?: string;
  commentEncoding?: string;
  extractPrependedData?: boolean;
  extractAppendedData?: boolean;
}

export interface EntryProgressEventHandler {
  onprogress?: (progress: number, total: number, entry: Entry) => unknown;
}

export class ZipReader {
  readonly comment?: Uint8Array;
  readonly prependedData?: Uint8Array;
  readonly appendedData?: Uint8Array;
  constructor(
    reader: ReadableReaderLike,
    options?: ReadOptions & GetEntriesOptions,
  );
  getEntriesGenerator(
    options?: EntryProgressEventHandler & GetEntriesOptions,
  ): AsyncGenerator<ReadableEntry, boolean>;
  getEntries(
    options?: EntryProgressEventHandler & GetEntriesOptions,
  ): Promise<ReadableEntry[]>;
  close(): Promise<undefined>;
}

export interface WriteOptions {
  zip64?: boolean;
  level?: number;
  bufferedWrite?: boolean;
  keepOrder?: boolean;
  version?: number;
  versionMadeBy?: number;
  password?: string;
  encryptionStrength?: number;
  zipCrypto?: boolean;
  useWebWorkers?: boolean;
  dataDescriptor?: boolean;
  dataDescriptorSignature?: boolean;
  signal?: AbortSignal;
  lastModDate?: Date;
  lastAccessDate?: Date;
  creationDate?: Date;
  extendedTimestamp?: boolean;
  msDosCompatible?: boolean;
  internalFileAttribute?: number;
  externalFileAttribute?: number;
  useCompressionStream?: boolean;
  supportZip64SplitFile?: boolean;
}

export interface AddEntryOptions {
  directory?: boolean;
  comment?: string;
  extraField?: Map<number, Uint8Array>;
}

export interface CloseOptions {
  zip64?: boolean;
  supportZip64SplitFile?: boolean;
  preventClose?: boolean;
}

export class ZipWriter<T extends WritableWriterLike> {
  readonly hasCorruptedEntries?: boolean;
  constructor(writer: T, options?: WriteOptions & CloseOptions);
  add(
    name: string,
    reader: ReadableReaderLike | null,
    options?: EntryDataProgressEventHandler & WriteOptions & AddEntryOptions,
  ): Promise<Entry>;
  close(
    comment?: Uint8Array,
    options?: EntryProgressEventHandler & CloseOptions,
  ): Promise<GetData<WritableWriterFrom<T>>>;
}

export const ERR_HTTP_RANGE: string;
export const ERR_BAD_FORMAT: string;
export const ERR_EOCDR_NOT_FOUND: string;
export const ERR_EOCDR_ZIP64_NOT_FOUND: string;
export const ERR_EOCDR_LOCATOR_ZIP64_NOT_FOUND: string;
export const ERR_CENTRAL_DIRECTORY_NOT_FOUND: string;
export const ERR_LOCAL_FILE_HEADER_NOT_FOUND: string;
export const ERR_EXTRAFIELD_ZIP64_NOT_FOUND: string;
export const ERR_ENCRYPTED: string;
export const ERR_UNSUPPORTED_ENCRYPTION: string;
export const ERR_UNSUPPORTED_COMPRESSION: string;
export const ERR_INVALID_SIGNATURE: string;
export const ERR_INVALID_PASSWORD: string;
export const ERR_DUPLICATED_NAME: string;
export const ERR_INVALID_COMMENT: string;
export const ERR_INVALID_ENTRY_NAME: string;
export const ERR_INVALID_ENTRY_COMMENT: string;
export const ERR_INVALID_VERSION: string;
export const ERR_INVALID_EXTRAFIELD_TYPE: string;
export const ERR_INVALID_EXTRAFIELD_DATA: string;
export const ERR_INVALID_ENCRYPTION_STRENGTH: string;
export const ERR_UNSUPPORTED_FORMAT: string;
export const ERR_SPLIT_ZIP_FILE: string;
export const ERR_ITERATOR_COMPLETED_TOO_SOON: string;
