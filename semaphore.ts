interface Node<T> {
  prev: Node<T>;
  next: Node<T>;
  value: T;
}

function listCreate<T>(): Node<T> {
  const list: Node<T> = { prev: null!, next: null!, value: null! };
  list.next = list.prev = list;
  return list;
}

function listHead<T>(list: Node<T>): Node<T> | null {
  return list.next === list ? null : list.next;
}

function listAppend<T>(list: Node<T>, value: T): Node<T> {
  const node: Node<T> = { prev: list.prev, next: list, value };
  node.prev.next = node.next.prev = node;
  return node;
}

function listRemove<T>(node: Node<T>): T {
  node.prev.next = node.next;
  node.next.prev = node.prev;
  node.next = node.prev = null!;
  return node.value;
}

class WaitQueue {
  readonly #waiters = listCreate<() => undefined>();

  wait(signal?: AbortSignal): Promise<undefined> {
    return new Promise((resolve, reject) => {
      const waiters = this.#waiters;
      if (!signal) {
        listAppend(waiters, resolve as () => undefined);
        return;
      }
      signal.throwIfAborted();
      const abort = () => {
        reject(signal.reason);
        listRemove(node);
      };
      const node = listAppend(waiters, () => {
        (resolve as () => undefined)();
        signal.removeEventListener("abort", abort);
      });
      signal.addEventListener("abort", abort, { once: true });
    });
  }

  notify(): boolean {
    const node = listHead(this.#waiters);
    if (node) {
      listRemove(node)();
      return true;
    }
    return false;
  }
}

export class Semaphore {
  readonly #queue = new WaitQueue();
  #permits: number;

  constructor(permits: number) {
    this.#permits = permits;
  }

  get permits(): number {
    return this.#permits;
  }

  tryAcquire(): boolean {
    if (this.#permits === 0) {
      return false;
    }
    this.#permits--;
    return true;
  }

  acquire(signal?: AbortSignal): Promise<undefined> | undefined {
    signal?.throwIfAborted();
    if (this.#permits === 0) {
      return this.#queue.wait(signal);
    }
    this.#permits--;
  }

  release(): undefined {
    if (!this.#queue.notify()) {
      this.#permits++;
    }
  }
}
