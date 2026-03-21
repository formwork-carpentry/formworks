/**
 * @module @formwork/ai
 * @description RAG (Retrieval-Augmented Generation) Pipeline — load documents, chunk them,
 * embed into vectors, retrieve relevant chunks, and feed them to an LLM.
 *
 * WHY: LLMs have knowledge cutoffs and limited context windows. RAG lets you
 * augment the model's knowledge by retrieving relevant documents at query time.
 *
 * HOW: Documents → Loader → Chunks → Embedder → VectorStore → Retriever → LLM
 *
 * @patterns Pipeline (sequential processing), Strategy (pluggable loaders/chunkers/embedders)
 * @principles OCP (add loaders/chunkers without modifying pipeline), SRP (each stage is independent)
 *
 * @example
 * ```ts
 * const pipeline = new RagPipeline({
 *   loader: new TextLoader(),
 *   chunker: new RecursiveChunker({ chunkSize: 500, overlap: 50 }),
 *   vectorStore: new InMemoryVectorStore(),
 *   embedder: async (text) => mockEmbedding(text),
 * });
 *
 * // Ingest documents
 * await pipeline.ingest([
 *   { id: 'doc1', content: 'Carpenter is a TypeScript framework...', metadata: { source: 'docs' } },
 * ]);
 *
 * // Query — returns relevant chunks + generated answer
 * const result = await pipeline.query('What is Carpenter?', { topK: 3 });
 * console.log(result.chunks);  // most relevant document chunks
 * ```
 */

// ── Types ─────────────────────────────────────────────────

/** A document to be ingested into the RAG pipeline */
export interface RagDocument {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/** A chunk of a document after splitting */
export interface RagChunk {
  id: string;
  documentId: string;
  content: string;
  metadata?: Record<string, unknown>;
  /** Position of this chunk within the source document (0-based) */
  chunkIndex: number;
}

/** A retrieved chunk with its relevance score */
export interface RetrievedChunk extends RagChunk {
  score: number;
}

/** Embedding function — converts text to a vector */
export type EmbedFn = (text: string) => Promise<number[]>;

// ── Chunker Interface ─────────────────────────────────────
// Chunkers split documents into smaller pieces that fit in the
// LLM context window and can be independently embedded/retrieved.

export interface IChunker {
  /** Split a document into chunks */
  /**
   * @param {RagDocument} document
   * @returns {RagChunk[]}
   */
  chunk(document: RagDocument): RagChunk[];
}

/**
 * RecursiveChunker — splits text by trying multiple separators in order
 * (paragraph → sentence → word → character), keeping chunks under the size limit
 * with configurable overlap between adjacent chunks.
 *
 * WHY recursive: A naive character-split breaks mid-word/sentence.
 * Recursive splitting tries to break at natural boundaries first.
 *
 * @example
 * ```ts
 * const chunker = new RecursiveChunker({ chunkSize: 500, overlap: 50 });
 * const chunks = chunker.chunk({ id: 'doc1', content: longText });
 * // Each chunk is ~500 chars, overlapping by ~50 chars with neighbors
 * ```
 */
export class RecursiveChunker implements IChunker {
  private readonly chunkSize: number;
  private readonly overlap: number;
  /** Separators tried in order — first match wins */
  private readonly separators: string[];

  constructor(options: { chunkSize?: number; overlap?: number; separators?: string[] } = {}) {
    this.chunkSize = options.chunkSize ?? 500;
    this.overlap = options.overlap ?? 50;
    // Default: try paragraphs, then sentences, then words, then characters
    this.separators = options.separators ?? ["\n\n", "\n", ". ", " ", ""];
  }

  /**
   * @param {RagDocument} document
   * @returns {RagChunk[]}
   */
  chunk(document: RagDocument): RagChunk[] {
    const pieces = this.splitRecursive(document.content, 0);
    return pieces.map((content, i) => ({
      id: `${document.id}_chunk_${i}`,
      documentId: document.id,
      content,
      metadata: { ...document.metadata },
      chunkIndex: i,
    }));
  }

  /**
   * Recursively split text using the separator hierarchy.
   * If the current separator produces chunks that are still too large,
   * try the next separator on those chunks.
   */
  private splitRecursive(text: string, separatorIdx: number): string[] {
    if (text.length <= this.chunkSize) return [text];
    if (separatorIdx >= this.separators.length) {
      // Last resort: hard split by character count
      return this.hardSplit(text);
    }

    const sep = this.separators[separatorIdx];
    const parts = sep === "" ? this.hardSplit(text) : text.split(sep);
    const chunks: string[] = [];
    let current = "";

    for (const part of parts) {
      const candidate = current ? current + sep + part : part;
      if (candidate.length > this.chunkSize && current) {
        chunks.push(current);
        // Overlap: keep the tail of the current chunk as the start of the next
        const overlapText = current.slice(-this.overlap);
        current = overlapText + sep + part;
      } else {
        current = candidate;
      }
    }
    if (current) chunks.push(current);

    // If any chunk is still too large, recurse with next separator
    return chunks.flatMap((c) =>
      c.length > this.chunkSize ? this.splitRecursive(c, separatorIdx + 1) : [c],
    );
  }

  private hardSplit(text: string): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += this.chunkSize - this.overlap) {
      chunks.push(text.slice(i, i + this.chunkSize));
    }
    return chunks;
  }
}

/**
 * FixedSizeChunker — simpler alternative that splits at exact character boundaries.
 * Faster but may break mid-word.
 */
export class FixedSizeChunker implements IChunker {
  constructor(
    private readonly size: number = 500,
    private readonly overlap: number = 0,
  ) {}

  /**
   * @param {RagDocument} document
   * @returns {RagChunk[]}
   */
  chunk(document: RagDocument): RagChunk[] {
    const chunks: RagChunk[] = [];
    const step = Math.max(1, this.size - this.overlap);
    for (let i = 0, idx = 0; i < document.content.length; i += step, idx++) {
      chunks.push({
        id: `${document.id}_chunk_${idx}`,
        documentId: document.id,
        content: document.content.slice(i, i + this.size),
        metadata: { ...document.metadata },
        chunkIndex: idx,
      });
    }
    return chunks;
  }
}

// ── Vector Store Interface ────────────────────────────────
// Vector stores hold embedded chunks and support similarity search.

export interface IVectorStore {
  /** Add vectors with their associated chunks */
  /**
   * @param {Array<{ id: string; vector: number[]; chunk: RagChunk }>} items
   * @returns {Promise<void>}
   */
  add(items: Array<{ id: string; vector: number[]; chunk: RagChunk }>): Promise<void>;
  /** Search for the most similar vectors to a query vector */
  /**
   * @param {number[]} queryVector
   * @param {number} topK
   * @returns {Promise<RetrievedChunk[]>}
   */
  search(queryVector: number[], topK: number): Promise<RetrievedChunk[]>;
  /** Get the total number of stored vectors */
  size(): number;
  /** Clear all stored vectors */
  clear(): void;
}

/**
 * In-memory vector store using cosine similarity.
 * Suitable for development/testing. For production, use Pinecone/Weaviate/pgvector.
 */
export class InMemoryRagVectorStore implements IVectorStore {
  private items: Array<{ id: string; vector: number[]; chunk: RagChunk }> = [];

  /**
   * @param {Array<{ id: string; vector: number[]; chunk: RagChunk }>} items
   * @returns {Promise<void>}
   */
  async add(items: Array<{ id: string; vector: number[]; chunk: RagChunk }>): Promise<void> {
    this.items.push(...items);
  }

  /**
   * @param {number[]} queryVector
   * @param {number} topK
   * @returns {Promise<RetrievedChunk[]>}
   */
  async search(queryVector: number[], topK: number): Promise<RetrievedChunk[]> {
    // Score every stored vector by cosine similarity
    const scored = this.items.map((item) => ({
      ...item.chunk,
      score: this.cosineSimilarity(queryVector, item.vector),
    }));

    // Sort by score descending, take top K
    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  size(): number {
    return this.items.length;
  }
  clear(): void {
    this.items = [];
  }

  /** Cosine similarity between two vectors: dot(a,b) / (|a| * |b|) */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }
}

// ── RAG Pipeline ──────────────────────────────────────────

export interface RagPipelineConfig {
  chunker: IChunker;
  vectorStore: IVectorStore;
  /** Function to convert text to an embedding vector */
  embedder: EmbedFn;
}

/**
 * RAG Pipeline — orchestrates document ingestion and retrieval.
 *
 * @example
 * ```ts
 * // Simple mock embedder for testing (real: call OpenAI embeddings API)
 * const embedder = async (text: string) => {
 *   const hash = Array.from(text).reduce((h, c) => h + c.charCodeAt(0), 0);
 *   return Array.from({ length: 128 }, (_, i) => Math.sin(hash + i));
 * };
 *
 * const pipeline = new RagPipeline({
 *   chunker: new RecursiveChunker({ chunkSize: 200 }),
 *   vectorStore: new InMemoryRagVectorStore(),
 *   embedder,
 * });
 *
 * await pipeline.ingest([{ id: 'readme', content: readmeText }]);
 * const results = await pipeline.retrieve('How do I install?', 3);
 * ```
 */
export class RagPipeline {
  private readonly chunker: IChunker;
  private readonly vectorStore: IVectorStore;
  private readonly embedder: EmbedFn;
  private ingestedDocIds = new Set<string>();

  constructor(config: RagPipelineConfig) {
    this.chunker = config.chunker;
    this.vectorStore = config.vectorStore;
    this.embedder = config.embedder;
  }

  /**
   * Ingest documents: chunk → embed → store.
   * @returns Number of chunks created and stored
   */
  async ingest(documents: RagDocument[]): Promise<number> {
    let totalChunks = 0;

    for (const doc of documents) {
      // Skip already-ingested documents
      if (this.ingestedDocIds.has(doc.id)) continue;

      const chunks = this.chunker.chunk(doc);
      const items = await Promise.all(
        chunks.map(async (chunk) => ({
          id: chunk.id,
          vector: await this.embedder(chunk.content),
          chunk,
        })),
      );

      await this.vectorStore.add(items);
      this.ingestedDocIds.add(doc.id);
      totalChunks += chunks.length;
    }

    return totalChunks;
  }

  /**
   * Retrieve the most relevant chunks for a query.
   * @param query - Natural language query
   * @param topK - Number of chunks to return (default: 5)
   */
  async retrieve(query: string, topK = 5): Promise<RetrievedChunk[]> {
    const queryVector = await this.embedder(query);
    return this.vectorStore.search(queryVector, topK);
  }

  /** Get the number of stored chunks */
  getChunkCount(): number {
    return this.vectorStore.size();
  }

  /** Get IDs of ingested documents */
  getIngestedDocIds(): string[] {
    return [...this.ingestedDocIds];
  }
}
