import math
import re
from dataclasses import dataclass
from typing import Dict, List

import numpy as np


TOKEN_RE = re.compile(r"[\u0900-\u097F]+|\w+", re.UNICODE)


def tokenize(text: str) -> List[str]:
    return [t.lower() for t in TOKEN_RE.findall(text or "")]


@dataclass
class BM25Store:
    tokenized_docs: List[List[str]]
    doc_freqs: List[Dict[str, int]]
    idf: Dict[str, float]
    doc_lens: np.ndarray
    avgdl: float
    k1: float = 1.5
    b: float = 0.75

    @classmethod
    def build(cls, docs: List[str], k1: float = 1.5, b: float = 0.75) -> "BM25Store":
        tokenized_docs = [tokenize(d) for d in docs]
        doc_freqs: List[Dict[str, int]] = []
        df_counts: Dict[str, int] = {}
        doc_lens = np.zeros(len(tokenized_docs), dtype=np.float32)

        for i, tokens in enumerate(tokenized_docs):
            doc_lens[i] = float(len(tokens))
            tf: Dict[str, int] = {}
            for tok in tokens:
                tf[tok] = tf.get(tok, 0) + 1
            doc_freqs.append(tf)
            for tok in tf.keys():
                df_counts[tok] = df_counts.get(tok, 0) + 1

        n_docs = max(1, len(tokenized_docs))
        avgdl = float(doc_lens.mean()) if len(doc_lens) else 0.0

        idf: Dict[str, float] = {}
        for tok, df in df_counts.items():
            # BM25+ style stable IDF
            idf[tok] = math.log(1.0 + (n_docs - df + 0.5) / (df + 0.5))

        return cls(
            tokenized_docs=tokenized_docs,
            doc_freqs=doc_freqs,
            idf=idf,
            doc_lens=doc_lens,
            avgdl=avgdl,
            k1=k1,
            b=b,
        )

    def score(self, query: str) -> np.ndarray:
        q_tokens = tokenize(query)
        scores = np.zeros(len(self.tokenized_docs), dtype=np.float32)
        if not q_tokens or len(self.tokenized_docs) == 0:
            return scores

        for i, tf_doc in enumerate(self.doc_freqs):
            dl = float(self.doc_lens[i])
            denom_norm = self.k1 * (1.0 - self.b + self.b * (dl / (self.avgdl + 1e-12)))
            s = 0.0
            for tok in q_tokens:
                tf = tf_doc.get(tok, 0)
                if tf == 0:
                    continue
                idf = self.idf.get(tok, 0.0)
                num = tf * (self.k1 + 1.0)
                den = tf + denom_norm
                s += idf * (num / (den + 1e-12))
            scores[i] = float(s)
        return scores
