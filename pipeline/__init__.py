"""
Pipeline package for the political RAG content generator.

Modules:
- news_fetcher: Fetch latest news via NewsAPI.
- transcript_parser: Parse Ravish Kumar transcript dataset.
- chunker: Split transcripts into argument-level chunks.
- embedder: Create sentence-transformer embeddings.
- vector_store: FAISS index construction and persistence.
- retriever: Retrieve relevant chunks for a given news item.
- generator: Generate profile-specific social media posts.
- profiles: Define user profile schema and dummy profiles.
"""

