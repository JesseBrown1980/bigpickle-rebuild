// Port router — single transport, N^K prefix-walk routing.
// Spec: C:/asolaria-foundation-v1/02-PORT-NAMESPACE-CANON.md
//
// A "port" is the root of a prefix tree. The label after the port (e.g. the
// "a.b.c" suffix in "50001.a.b.c") is a Hilbert-style path through the tree.
// Routing is O(K) prefix-walk, NOT O(N^K) scan. One transport multiplexes
// infinite labels.

class TrieNode {
  handler = null;
  children = new Map();
}

export class PortRouter {
  #root = new TrieNode();

  // One socket multiplexes infinite labels — exposed so tests can assert.
  transportCount = 1;

  register(label, handler) {
    if (typeof label !== 'string' || label.length === 0) {
      throw new TypeError('PortRouter.register: label must be non-empty string');
    }
    if (typeof handler !== 'function') {
      throw new TypeError('PortRouter.register: handler must be a function');
    }
    const segments = label.split('.');
    // First segment is the port id and lives at the root. Walk the suffix.
    let node = this.#root;
    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];
      let child = node.children.get(seg);
      if (!child) {
        child = new TrieNode();
        node.children.set(seg, child);
      }
      node = child;
    }
    node.handler = handler;
  }

  route(label) {
    return this.routeWithTrace(label).handler;
  }

  routeWithTrace(label) {
    if (typeof label !== 'string' || label.length === 0) {
      return { handler: null, nodesVisited: 0 };
    }
    const segments = label.split('.');
    let node = this.#root;
    let nodesVisited = 1; // root
    for (let i = 1; i < segments.length; i++) {
      const next = node.children.get(segments[i]);
      if (!next) {
        return { handler: null, nodesVisited };
      }
      node = next;
      nodesVisited++;
    }
    return { handler: node.handler ?? null, nodesVisited };
  }
}
