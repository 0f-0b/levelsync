// probably very incorrect but at least usable
import type { Awaitable } from "../async.ts";

export interface Codec {
  append(data: Uint8Array): Awaitable<Uint8Array>;
  flush(): Awaitable<Uint8Array>;
}

export interface Configuration {
  baseURL?: string;
  chunkSize?: number;
  maxWorkers?: number;
  terminateWorkerTimeout?: number;
  useWebWorkers?: boolean;
  useCompressionStream?: boolean;
  Deflate?: Codec;
  Inflate?: Codec;
  workerScripts?: {
    deflate?: string[];
    inflate?: string[];
  };
}

export function configure(configuration: Configuration): undefined;
export function initShimAsyncCodec<
  CodecType extends { push(data: Uint8Array, finalChunk: boolean): unknown },
  CodecOptions,
>(
  library: {
    Deflate: new (options?: CodecOptions) => CodecType;
    Inflate: new (options?: CodecOptions) => CodecType;
  },
  options: {
    deflate?: CodecOptions;
    inflate?: CodecOptions;
  } | undefined,
  registerDataHandler: (
    codec: CodecType,
    handler: (data: ArrayLike<number>) => undefined,
  ) => unknown,
): {
  Deflate: new (options?: CodecOptions) => Codec;
  Inflate: new (options?: CodecOptions) => Codec;
};
export function terminateWorkers(): undefined;
export function getMimeType(filename: string): string;

interface ReadableByteStream extends ReadableStream<Uint8Array> {
  size?: () => number;
}

interface SeekableReadableByteStream extends ReadableByteStream {
  offset?: number;
}

interface ReadableReader {
  readonly readable: ReadableByteStream;
  size?: number;
  chunkSize?: number;
  initialized?: boolean;
  init?(): unknown;
}

interface SeekableReadableReader extends ReadableReader {
  readonly readable: SeekableReadableByteStream;
  size: number;
  init(): unknown;
  readUint8Array(index: number, length: number): Awaitable<Uint8Array>;
}

type WritableByteStream = WritableStream<Uint8Array>;

interface WritableWriter {
  readonly writable: WritableByteStream;
  preventClose?: boolean;
  size?: number;
  initialized?: boolean;
  init?(): unknown;
  getData?(): unknown;
}

type GetData<T extends WritableWriter> = T["getData"] extends () => infer R
  ? Awaited<R>
  : WritableByteStream;

declare class Stream {
  size: number;
  initialized?: boolean;
  init(): Awaitable<undefined>;
}

export abstract class Reader extends Stream implements SeekableReadableReader {
  chunkSize?: number;
  readonly readable: SeekableReadableByteStream;
  abstract readUint8Array(index: number, length: number): Awaitable<Uint8Array>;
}

export class TextReader extends Reader {
  constructor(text: string);
  init(): undefined;
  readUint8Array(index: number, length: number): Promise<Uint8Array>;
}

export class BlobReader extends Reader {
  constructor(blob: Blob);
  init(): undefined;
  readUint8Array(index: number, length: number): Promise<Uint8Array>;
}

export class Data64URIReader extends Reader {
  constructor(dataURI: string);
  init(): undefined;
  readUint8Array(index: number, length: number): Uint8Array;
}

export class Uint8ArrayReader extends Reader {
  constructor(array: Uint8Array);
  init(): undefined;
  readUint8Array(index: number, length: number): Uint8Array;
}

export interface HttpOptions extends HttpRangeOptions {
  useRangeHeader?: boolean;
}

export class HttpReader extends Reader {
  constructor(url: string, options?: HttpOptions);
  init(): Promise<undefined>;
  readUint8Array(index: number, length: number): Promise<Uint8Array>;
}

export interface HttpRangeOptions
  extends Omit<RequestInit, "headers" | "body" | "method"> {
  preventHeadRequest?: boolean;
  forceRangeRequests?: boolean;
  useXHR?: boolean;
  headers?: Iterable<[string, string]> | Record<string, string>;
}

export class HttpRangeReader extends Reader {
  constructor(url: string, options?: HttpRangeOptions);
  init(): Promise<undefined>;
  readUint8Array(index: number, length: number): Promise<Uint8Array>;
}

export class ReadableStreamReader extends Stream implements ReadableReader {
  constructor(readable: ReadableByteStream);
  readonly readable: ReadableByteStream;
  init(): undefined;
}

export abstract class Writer extends Stream implements WritableWriter {
  readonly writable: WritableByteStream;
  writeUint8Array(array: Uint8Array): Awaitable<undefined>;
}

export class TextWriter extends Writer {
  constructor(encoding?: string);
  init(): undefined;
  writeUint8Array(array: Uint8Array): undefined;
  getData(): Promise<string>;
}

export class BlobWriter extends Writer {
  constructor(contentType?: string);
  init(): undefined;
  writeUint8Array(array: Uint8Array): undefined;
  getData(): Blob;
}

export class Data64URIWriter extends Writer {
  constructor(contentType?: string);
  init(): undefined;
  writeUint8Array(array: Uint8Array): undefined;
  getData(): string;
}

export class Uint8ArrayWriter extends Writer {
  init(): undefined;
  writeUint8Array(array: Uint8Array): undefined;
  getData(): Uint8Array;
}

export interface WritableStreamOptions {
  preventClose?: boolean;
}

export class WritableStreamWriter extends Writer {
  constructor(writable: WritableByteStream, options?: WritableStreamOptions);
  init(): undefined;
  writeUint8Array(array: Uint8Array): Promise<undefined>;
}

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
  checkSignature?: boolean;
  password?: string;
  useWebWorkers?: boolean;
  useCompressionStream?: boolean;
  signal?: AbortSignal;
}

export interface EntryDataProgressEventHandler {
  onstart?: (total: number) => unknown;
  onprogress?: (progress: number, total: number) => unknown;
  onend?: (computedSize: number) => unknown;
}

export interface ReadableEntry extends Entry {
  getData<T extends WritableWriter>(
    writer: T,
    options?: EntryDataProgressEventHandler & ReadOptions,
  ): Promise<GetData<T>>;
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
    reader: SeekableReadableReader,
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
}

export interface AddEntryOptions {
  directory?: boolean;
  comment?: string;
  extraField?: Map<number, Uint8Array>;
}

export interface CloseOptions {
  zip64?: boolean;
  preventClose?: boolean;
}

export class ZipWriter<T extends WritableWriter> {
  readonly hasCorruptedEntries?: boolean;
  constructor(writer: T, options?: WriteOptions);
  add(
    name: string,
    reader: ReadableReader | null,
    options?: EntryDataProgressEventHandler & AddEntryOptions & WriteOptions,
  ): Promise<Entry>;
  close(
    comment?: Uint8Array,
    options?: EntryProgressEventHandler & CloseOptions,
  ): Promise<GetData<T>>;
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
export const ERR_ABORT: string;
export const ERR_NOT_SEEKABLE_READER: string;
