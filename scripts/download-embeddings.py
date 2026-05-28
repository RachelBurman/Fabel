import subprocess
import sys

subprocess.check_call([sys.executable, "-m", "pip", "install", "huggingface_hub", "safetensors", "numpy"])

import json
from pathlib import Path

from huggingface_hub import snapshot_download
from safetensors import safe_open

MODEL_ID = "Kaikaku/epicure-core"
OUTPUT_PATH = Path(__file__).parent.parent / "data" / "epicure-core.json"

print(f"Downloading {MODEL_ID} from HuggingFace...")
local_dir = snapshot_download(repo_id=MODEL_ID)
print(f"Downloaded to: {local_dir}")

# Load embeddings from safetensors
safetensors_files = sorted(Path(local_dir).glob("*.safetensors"))
if not safetensors_files:
    raise FileNotFoundError("No .safetensors file found in downloaded model")

tensors = {}
with safe_open(safetensors_files[0], framework="numpy") as f:
    for key in f.keys():
        tensors[key] = f.get_tensor(key)

print(f"Tensors found: {list(tensors.keys())}")

# Load vocab — try common file names in order of preference
vocab: list[str] | None = None
for vocab_filename in ("vocab.txt", "vocab.json"):
    vocab_file = Path(local_dir) / vocab_filename
    if vocab_file.exists():
        if vocab_filename.endswith(".json"):
            raw = json.loads(vocab_file.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                vocab = sorted(raw, key=lambda w: raw[w])
            else:
                vocab = raw
        else:
            vocab = [line.strip() for line in vocab_file.read_text(encoding="utf-8").splitlines() if line.strip()]
        print(f"Vocab loaded from {vocab_filename}: {len(vocab)} tokens")
        break

if vocab is None:
    tokenizer_file = Path(local_dir) / "tokenizer.json"
    if tokenizer_file.exists():
        raw = json.loads(tokenizer_file.read_text(encoding="utf-8"))
        vocab_dict = raw.get("model", {}).get("vocab", {})
        vocab = sorted(vocab_dict, key=lambda w: vocab_dict[w])
        print(f"Vocab loaded from tokenizer.json: {len(vocab)} tokens")

# Pick the embedding matrix — prefer keys that look like embedding weights
embedding_tensor = None
for preferred in ("embeddings", "weight", "embedding.weight", "embeddings.weight"):
    if preferred in tensors:
        embedding_tensor = tensors[preferred]
        print(f"Using tensor key: '{preferred}' {embedding_tensor.shape}")
        break

if embedding_tensor is None:
    # Fall back to the first 2-D tensor
    for key, tensor in tensors.items():
        if tensor.ndim == 2:
            embedding_tensor = tensor
            print(f"Using tensor key: '{key}' {tensor.shape}")
            break

if embedding_tensor is None:
    raise ValueError(f"Could not find an embedding matrix. Available tensors: {list(tensors.keys())}")

# Build output JSON
if vocab is not None and len(vocab) == embedding_tensor.shape[0]:
    # Map each token directly to its vector
    output = {word: embedding_tensor[i].tolist() for i, word in enumerate(vocab)}
    print(f"Built word->vector map for {len(output)} tokens")
else:
    # Store vocab and embeddings as parallel arrays
    output = {
        "vocab": vocab,
        "embeddings": embedding_tensor.tolist(),
    }
    if vocab:
        print(f"Warning: vocab length ({len(vocab)}) != embedding rows ({embedding_tensor.shape[0]}), storing as parallel arrays")
    else:
        print("No vocab file found, storing embeddings array only")

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH.write_text(json.dumps(output), encoding="utf-8")
print(f"Saved to {OUTPUT_PATH}")
