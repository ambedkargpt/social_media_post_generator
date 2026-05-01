# Political RAG Content Generator (Prototype)

This is a prototype Retrieval-Augmented Generation (RAG) pipeline for generating political social media content responding to the latest news using arguments from a Ravish Kumar transcript dataset.

## Features

- Fetches latest India news using NewsAPI
- Parses Ravish Kumar transcripts into argument chunks
- Embeds chunks using **Gemini** embedding models (e.g. `gemini-embedding-001`)
- Stores embeddings in a FAISS vector index
- Retrieves relevant chunks per news item
- Generates profile-specific social media posts using **OpenAI** (default: `gpt-5-nano`)
- Outputs posts plus explicit transcript chunk references

## Project Structure

See `main.py` and the `pipeline/` package for the full pipeline implementation.

## Setup

1. Create and activate a virtual environment (recommended).
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Create a `.env` file (or edit the existing one) with:

```bash
NEWS_API_KEY=your_newsapi_key_here
OPENAI_API_KEY=your_openai_key_here
OPENAI_MODEL=gpt-5-nano
GEMINI_API_KEY=your_gemini_key_here
# Optional: EMBEDDING_MODEL=gemini-embedding-001
```

4. Place your Ravish Kumar transcript dataset at:

```text
data/ravish_transcripts.txt
```

Format:

```text
===== VIDEO TITLE =====
Transcript text...

===== ANOTHER VIDEO =====
More transcript text...
```

## Running

```bash
python main.py
```

The script will:

- Build the transcript index
- Fetch latest India news
- Generate posts per news item and user profile
- Save all outputs to `outputs/generated_posts.json`
- Print a sample post and its references to the terminal

