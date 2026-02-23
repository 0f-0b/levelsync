import type { Awaitable } from "../async.ts";

export interface DeflateOptions {
  level?: number | undefined;
  chunkSize?: number | undefined;
}

export interface InflateOptions {
  chunkSize?: number | undefined;
}

export type DeflateStreamConstructor = new (
  format: "deflate-raw",
  options: DeflateOptions,
) => ReadableWritablePair<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>;
export type Deflate64StreamConstructor = new (
  format: "deflate-raw" | "deflate64-raw",
  options: DeflateOptions,
) => ReadableWritablePair<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>;
export type InflateStreamConstructor = new (
  format: "deflate-raw",
  options: InflateOptions,
) => ReadableWritablePair<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>;

export interface WorkerConfiguration {
  useWebWorkers?: boolean | undefined;
  useCompressionStream?: boolean | undefined;
}

export interface Configuration extends WorkerConfiguration {
  baseURI?: string | undefined;
  wasmURI?: string | undefined;
  workerURI?: string | undefined;
  chunkSize?: number | undefined;
  maxWorkers?: number | undefined;
  terminateWorkerTimeout?: number | undefined;
  CompressionStream?: DeflateStreamConstructor | undefined;
  DecompressionStream?: InflateStreamConstructor | undefined;
  CompressionStreamZlib?: DeflateStreamConstructor | undefined;
  DecompressionStreamZlib?: Deflate64StreamConstructor | undefined;
}

export function configure(configuration: Configuration): undefined;
export function terminateWorkers(): Promise<undefined>;
export function getMimeType(filename: string): string;

export type ReadableByteStream = ReadableStream<Uint8Array<ArrayBuffer>>;

export interface ReadableReader {
  get readable(): ReadableByteStream;
  size?: number | undefined;
  chunkSize?: number | undefined;
  initialized?: boolean | undefined;
  init?(): unknown;
}

export type ReadableReaderLike =
  | ReadableReader
  | ReadableByteStream
  | readonly Reader[];

export interface SeekableReadableByteStream extends ReadableByteStream {
  diskNumberStart?: number | undefined;
  offset?: number | undefined;
  size?: number | undefined;
}

export interface SeekableReadableReader extends ReadableReader {
  get readable(): SeekableReadableByteStream;
  lastDiskNumber?: number | undefined;
  size: number;
  readUint8Array(
    index: number,
    length: number,
    diskNumber?: number,
  ): Awaitable<Uint8Array<ArrayBuffer>>;
}

export type WritableByteStream = WritableStream<Uint8Array<ArrayBuffer>>;

export interface WritableWriter {
  get writable(): WritableByteStream;
  diskNumber?: number | undefined;
  diskOffset?: number | undefined;
  availableSize?: number | undefined;
  maxSize?: number | undefined;
  size?: number | undefined;
  initialized?: boolean | undefined;
  init?: ((this: this, sizeHint?: number) => unknown) | undefined;
  getData?: ((this: this) => unknown) | undefined;
}

export type WritableWriterLike =
  | WritableWriter
  | WritableByteStream
  | DiskWriterIterator;

export interface TempStream {
  get readable(): ReadableByteStream;
  get writable(): WritableByteStream;
  diskOffset?: number | undefined;
  size?: number | undefined;
  initialized?: boolean | undefined;
  init?: ((this: this) => unknown) | undefined;
}

declare class Stream {
  size: number;
  initialized?: boolean | undefined;
  init(): Awaitable<undefined>;
}

export abstract class Reader extends Stream implements SeekableReadableReader {
  chunkSize?: number | undefined;
  get readable(): SeekableReadableByteStream;
  abstract readUint8Array(
    index: number,
    length: number,
    diskNumber?: number,
  ): Awaitable<Uint8Array<ArrayBuffer>>;
}

export class TextReader extends Reader implements SeekableReadableReader {
  constructor(text: string);
  override init(): undefined;
  override readUint8Array(
    index: number,
    length: number,
  ): Promise<Uint8Array<ArrayBuffer>>;
}

export class BlobReader extends Reader implements SeekableReadableReader {
  constructor(blob: Blob);
  override init(): undefined;
  override readUint8Array(
    index: number,
    length: number,
  ): Promise<Uint8Array<ArrayBuffer>>;
}

export class Data64URIReader extends Reader implements SeekableReadableReader {
  constructor(dataURI: string);
  override init(): undefined;
  override readUint8Array(
    index: number,
    length: number,
  ): Uint8Array<ArrayBuffer>;
}

export class Uint8ArrayReader extends Reader implements SeekableReadableReader {
  constructor(array: Uint8Array);
  override init(): undefined;
  override readUint8Array(
    index: number,
    length: number,
  ): Uint8Array<ArrayBuffer>;
}

export interface HttpOptions extends HttpRangeOptions {
  useRangeHeader?: boolean | undefined;
}

export class HttpReader extends Reader implements SeekableReadableReader {
  constructor(url: string, options?: HttpOptions);
  override init(): Promise<undefined>;
  override readUint8Array(
    index: number,
    length: number,
  ): Promise<Uint8Array<ArrayBuffer>>;
}

export interface HttpRangeOptions
  extends Omit<RequestInit, "headers" | "body" | "method"> {
  preventHeadRequest?: boolean | undefined;
  forceRangeRequests?: boolean | undefined;
  combineSizeEocd?: boolean | undefined;
  useXHR?: boolean | undefined;
  headers?: Iterable<[string, string]> | Record<string, string> | undefined;
}

export class HttpRangeReader extends Reader implements SeekableReadableReader {
  constructor(url: string, options?: HttpRangeOptions);
  override init(): Promise<undefined>;
  override readUint8Array(
    index: number,
    length: number,
  ): Promise<Uint8Array<ArrayBuffer>>;
}

export class SplitDataReader extends Reader implements SeekableReadableReader {
  lastDiskNumber?: number | undefined;
  constructor(readers: readonly Reader[]);
  override init(): Promise<undefined>;
  override readUint8Array(
    index: number,
    length: number,
    diskNumber?: number,
  ): Promise<Uint8Array<ArrayBuffer>>;
}

export abstract class Writer extends Stream implements WritableWriter {
  get writable(): WritableByteStream;
  writeUint8Array(array: Uint8Array<ArrayBuffer>): Awaitable<undefined>;
}

export class TextWriter extends Writer implements WritableWriter {
  constructor(encoding?: string);
  override init(): undefined;
  override writeUint8Array(array: Uint8Array<ArrayBuffer>): undefined;
  getData(): Promise<string>;
}

export class BlobWriter extends Stream implements WritableWriter {
  get writable(): WritableByteStream;
  constructor(contentType?: string);
  override init(): undefined;
  getData(): Promise<Blob>;
}

export class Data64URIWriter extends Writer implements WritableWriter {
  constructor(contentType?: string);
  override init(): undefined;
  override writeUint8Array(array: Uint8Array<ArrayBuffer>): undefined;
  getData(): string;
}

export class Uint8ArrayWriter extends Writer implements WritableWriter {
  constructor(initialBufferSize?: number);
  override init(sizeHint?: number): undefined;
  override writeUint8Array(array: Uint8Array<ArrayBuffer>): undefined;
  getData(): Uint8Array<ArrayBuffer>;
}

export interface DiskWriter {
  get writable(): WritableByteStream;
  size?: number | undefined;
  maxSize?: number | undefined;
  initialized?: boolean | undefined;
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
  get writable(): WritableByteStream;
  constructor(writers: DiskWriterIterator, splitAt?: number);
  override init(): undefined;
}

export interface MsdosAttributes {
  readOnly: boolean;
  hidden: boolean;
  system: boolean;
  directory: boolean;
  archive: boolean;
}

export interface BitFlag {
  level: number;
  dataDescriptor: boolean;
  languageEncodingFlag: boolean;
}

export interface ExtraField {
  type: number;
  data: Uint8Array<ArrayBuffer>;
}

export interface ExtraFieldZip64 extends ExtraField {
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

export interface ExtraFieldUnix extends ExtraField {
  version: number;
  uid: number;
  gid: number;
  unixMode: number | undefined;
}

export interface ExtraFieldInfoZip extends ExtraField {
  version: number;
  uid: number;
  gid: number;
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
  rawFilename: Uint8Array<ArrayBuffer>;
  filenameUTF8: boolean;
  directory: boolean;
  executable: boolean;
  encrypted: boolean | undefined;
  zipCrypto: boolean | undefined;
  compressedSize: number;
  uncompressedSize: number;
  lastModDate: Date;
  rawLastModDate: number;
  lastAccessDate: Date | undefined;
  creationDate: Date | undefined;
  comment: string;
  rawComment: Uint8Array<ArrayBuffer>;
  commentUTF8: boolean;
  extraField: Map<number, ExtraField> | undefined;
  extraFieldZip64: ExtraFieldZip64 | undefined;
  extraFieldUnicodePath: ExtraFieldUnicodePath | undefined;
  extraFieldUnicodeComment: ExtraFieldUnicodeComment | undefined;
  extraFieldAES: ExtraFieldAES | undefined;
  extraFieldNTFS: ExtraFieldNTFS | undefined;
  extraFieldUnix: ExtraFieldUnix | undefined;
  extraFieldInfoZip: ExtraFieldInfoZip | undefined;
  extraFieldExtendedTimestamp: ExtraFieldExtendedTimestamp | undefined;
  rawExtraField: Uint8Array<ArrayBuffer>;
  compressionMethod: number;
  signature: number | undefined;
  zip64: true | undefined;
  bitFlag: BitFlag | undefined;
  version: number;
  versionMadeBy: number;
  msDosCompatible: boolean;
  internalFileAttributes: number;
  externalFileAttributes: number;
  msdosAttributes: MsdosAttributes;
  msdosAttributesRaw: number;
  uid: number | undefined;
  gid: number | undefined;
  unixMode: number | undefined;
  setuid: boolean;
  setgid: boolean;
  sticky: boolean;
}

export interface ReadOptions extends WorkerConfiguration {
  passThrough?: boolean | undefined;
  checkOverlappingEntry?: boolean | undefined;
  checkOverlappingEntryOnly?: boolean | undefined;
  checkPasswordOnly?: boolean | undefined;
  checkSignature?: boolean | undefined;
  password?: string | undefined;
  rawPassword?: Uint8Array<ArrayBuffer> | undefined;
  signal?: AbortSignal | undefined;
  preventClose?: boolean | undefined;
  transferStreams?: boolean | undefined;
}

export interface EntryDataProgressEventHandler {
  onstart?: ((total: number) => unknown) | undefined;
  onprogress?: ((progress: number, total: number) => unknown) | undefined;
  onend?: ((computedSize: number) => unknown) | undefined;
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
  arrayBuffer(
    options?: EntryDataProgressEventHandler & ReadOptions,
  ): Promise<ArrayBuffer>;
}

export interface GetEntriesOptions {
  filenameEncoding?: string | undefined;
  commentEncoding?: string | undefined;
  decodeText?:
    | ((value: Uint8Array<ArrayBuffer>, encoding: string) => string | undefined)
    | undefined;
  extractPrependedData?: boolean | undefined;
  extractAppendedData?: boolean | undefined;
}

export interface EntryProgressEventHandler {
  onprogress?:
    | ((progress: number, total: number, entry: Entry) => unknown)
    | undefined;
}

export class ZipReader {
  readonly comment?: Uint8Array<ArrayBuffer>;
  readonly prependedData?: Uint8Array<ArrayBuffer>;
  readonly appendedData?: Uint8Array<ArrayBuffer>;
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

export interface ReadableStreamEntry extends Entry {
  readable: ReadableStream<Uint8Array<ArrayBuffer>>;
}

export class ZipReaderStream {
  readonly readable: ReadableStream<ReadableStreamEntry>;
  readonly writable: WritableStream<Uint8Array<ArrayBuffer>>;
  constructor(options?: ReadOptions & GetEntriesOptions);
}

export interface ZipWriterOptions {
  usdz?: boolean | undefined;
  offset?: number | undefined;
}

export interface WriteOptions extends WorkerConfiguration {
  zip64?: boolean | undefined;
  level?: number | undefined;
  bufferedWrite?: boolean | undefined;
  createTempStream?: (() => Awaitable<TempStream>) | undefined;
  keepOrder?: boolean | undefined;
  encodeText?:
    | ((text: string) => Uint8Array<ArrayBuffer> | undefined)
    | undefined;
  version?: number | undefined;
  versionMadeBy?: number | undefined;
  passThrough?: boolean | undefined;
  password?: string | undefined;
  rawPassword?: Uint8Array<ArrayBuffer> | undefined;
  encrypted?: boolean | undefined;
  encryptionStrength?: number | undefined;
  zipCrypto?: boolean | undefined;
  useUnicodeFileNames?: boolean | undefined;
  dataDescriptor?: boolean | undefined;
  dataDescriptorSignature?: boolean | undefined;
  compressionMethod?: number | undefined;
  signal?: AbortSignal | undefined;
  lastModDate?: Date | undefined;
  lastAccessDate?: Date | undefined;
  creationDate?: Date | undefined;
  extendedTimestamp?: boolean | undefined;
  msDosCompatible?: boolean | undefined;
  internalFileAttributes?: number | undefined;
  externalFileAttributes?: number | undefined;
  msdosAttributes?: Partial<MsdosAttributes> | undefined;
  msdosAttributesRaw?: number | undefined;
  uid?: number | undefined;
  gid?: number | undefined;
  unixMode?: number | undefined;
  unixExtraFieldType?: "infozip" | "unix" | undefined;
  setuid?: boolean | undefined;
  setgid?: boolean | undefined;
  sticky?: boolean | undefined;
  supportZip64SplitFile?: boolean | undefined;
  transferStreams?: boolean | undefined;
}

export interface AddEntryOptions {
  directory?: boolean | undefined;
  executable?: boolean | undefined;
  comment?: string | undefined;
  extraField?: Map<number, Uint8Array<ArrayBuffer>> | undefined;
  uncompressedSize?: number | undefined;
  signature?: number | undefined;
}

export interface CloseOptions {
  zip64?: boolean | undefined;
  supportZip64SplitFile?: boolean | undefined;
  preventClose?: boolean | undefined;
}

export class ZipWriter<T extends WritableWriterLike> {
  readonly hasCorruptedEntries?: boolean;
  constructor(
    writer: T,
    options?: ZipWriterOptions & WriteOptions & CloseOptions,
  );
  prependZip(reader: ReadableReaderLike): Promise<undefined>;
  add(
    name: string,
    reader: ReadableReaderLike | null,
    options?: EntryDataProgressEventHandler & WriteOptions & AddEntryOptions,
  ): Promise<Entry>;
  remove(entry: string | Entry): boolean;
  close(
    comment?: Uint8Array<ArrayBuffer>,
    options?: EntryProgressEventHandler & CloseOptions,
  ): Promise<GetData<WritableWriterFrom<T>>>;
}

export class ZipWriterStream {
  readonly readable: ReadableStream<Uint8Array<ArrayBuffer>>;
  readonly zipWriter: ZipWriter<WritableStream<Uint8Array<ArrayBuffer>>>;
  constructor(options?: ZipWriterOptions & WriteOptions & CloseOptions);
  transform(path: string): {
    readable: ReadableStream<Uint8Array<ArrayBuffer>>;
    writable: WritableStream<Uint8Array<ArrayBuffer>>;
  };
  writable(path: string): WritableStream<Uint8Array<ArrayBuffer>>;
  close(
    comment?: Uint8Array<ArrayBuffer>,
    options?: EntryProgressEventHandler & CloseOptions,
  ): Promise<WritableStream<Uint8Array<ArrayBuffer>>>;
}

export const ERR_HTTP_RANGE: string;
export const ERR_BAD_FORMAT: string;
export const ERR_EOCDR_NOT_FOUND: string;
export const ERR_EOCDR_LOCATOR_ZIP64_NOT_FOUND: string;
export const ERR_CENTRAL_DIRECTORY_NOT_FOUND: string;
export const ERR_LOCAL_FILE_HEADER_NOT_FOUND: string;
export const ERR_EXTRAFIELD_ZIP64_NOT_FOUND: string;
export const ERR_ENCRYPTED: string;
export const ERR_UNSUPPORTED_ENCRYPTION: string;
export const ERR_UNSUPPORTED_COMPRESSION: string;
export const ERR_INVALID_SIGNATURE: string;
export const ERR_INVALID_PASSWORD: string;
export const ERR_INVALID_UNCOMPRESSED_SIZE: string;
export const ERR_SPLIT_ZIP_FILE: string;
export const ERR_OVERLAPPING_ENTRY: string;
export const ERR_DUPLICATED_NAME: string;
export const ERR_INVALID_COMMENT: string;
export const ERR_INVALID_ENTRY_NAME: string;
export const ERR_INVALID_ENTRY_COMMENT: string;
export const ERR_INVALID_VERSION: string;
export const ERR_INVALID_EXTRAFIELD_TYPE: string;
export const ERR_INVALID_EXTRAFIELD_DATA: string;
export const ERR_INVALID_ENCRYPTION_STRENGTH: string;
export const ERR_UNSUPPORTED_FORMAT: string;
export const ERR_UNDEFINED_UNCOMPRESSED_SIZE: string;
export const ERR_ZIP_NOT_EMPTY: string;

export {};
