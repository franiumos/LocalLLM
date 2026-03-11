# Supported Models full List

All models are downloaded on demand from HuggingFace in GGUF format to `~/.localllm/models/`.

**50 models** across 7 categories.

---

## Chat (13 models)

| Model | Author | Params | Capabilities | Size (Q4_K_M) |
|---|---|---|---|---|
| Llama 3.2 3B Instruct | Meta | 3B | tool_use | 2 GB |
| Llama 3.1 8B Instruct | Meta | 8B | tool_use | 4.9 GB |
| Llama 3.3 70B Instruct | Meta | 70B | tool_use | 42.5 GB |
| Mistral 7B Instruct v0.3 | Mistral AI | 7B | tool_use | 4.4 GB |
| Mistral Nemo 12B Instruct | Mistral AI | 12B | tool_use | 7.5 GB |
| Mistral Small 24B Instruct | Mistral AI | 24B | tool_use | 14.1 GB |
| Qwen 2.5 7B Instruct | Alibaba | 7B | tool_use | 4.7 GB |
| Qwen 2.5 14B Instruct | Alibaba | 14B | tool_use | 8.7 GB |
| Qwen 2.5 32B Instruct | Alibaba | 32B | tool_use | 19.9 GB |
| Gemma 2 9B Instruct | Google | 9B | tool_use | 5.8 GB |
| Gemma 3 4B Instruct | Google | 4B | tool_use, vision | 2.8 GB |
| Gemma 3 12B Instruct | Google | 12B | tool_use, vision | 7.3 GB |
| Gemma 3 27B Instruct | Google | 27B | tool_use, vision | 16.3 GB |

## Code (9 models)

| Model | Author | Params | Capabilities | Size (Q4_K_M) |
|---|---|---|---|---|
| Phi-4 Mini Instruct | Microsoft | 3.8B | tool_use | 2.4 GB |
| CodeLlama 7B Instruct | Meta | 7B | tool_use | 4.1 GB |
| DeepSeek Coder V2 Lite Instruct | DeepSeek | 16B (2.4B active) | tool_use | 9 GB |
| StarCoder2 3B | BigCode | 3B | - | 1.8 GB |
| Qwen 2.5 Coder 3B Instruct | Alibaba | 3B | tool_use | 2 GB |
| Qwen 2.5 Coder 7B Instruct | Alibaba | 7B | tool_use | 4.7 GB |
| Qwen 2.5 Coder 14B Instruct | Alibaba | 14B | tool_use | 8.7 GB |
| Qwen 2.5 Coder 32B Instruct | Alibaba | 32B | tool_use | 19.9 GB |
| Codestral 22B v0.1 | Mistral AI | 22B | tool_use | 12.9 GB |

## Reasoning (8 models)

| Model | Author | Params | Capabilities | Size (Q4_K_M) |
|---|---|---|---|---|
| DeepSeek R1 Distill Qwen 1.5B | DeepSeek | 1.5B | - | 1.1 GB |
| DeepSeek R1 Distill Qwen 7B | DeepSeek | 7B | tool_use | 4.7 GB |
| DeepSeek R1 Distill Llama 8B | DeepSeek | 8B | tool_use | 4.9 GB |
| DeepSeek R1 Distill Qwen 14B | DeepSeek | 14B | tool_use | 8.7 GB |
| DeepSeek R1 Distill Qwen 32B | DeepSeek | 32B | tool_use | 19.9 GB |
| Phi-3 Medium 14B Instruct | Microsoft | 14B | tool_use | 8.6 GB |
| Phi-4 14B | Microsoft | 14B | tool_use | 9.1 GB |
| QwQ 32B | Alibaba | 32B | tool_use | 19.9 GB |

## Vision (3 models)

| Model | Author | Params | Size (Q4_K_M) |
|---|---|---|---|
| LLaVA 1.6 Mistral 7B | Haotian Liu | 7B | 4.4 GB |
| Qwen2 VL 7B Instruct | Alibaba | 7B | 4.7 GB |
| Qwen2 VL 2B Instruct | Alibaba | 2B | 1.4 GB |

## Multilingual (4 models)

| Model | Author | Params | Size (Q4_K_M) |
|---|---|---|---|
| Aya 23 8B | Cohere | 8B | 4.9 GB |
| Aya Expanse 8B | Cohere | 8B | 4.9 GB |
| Aya Expanse 32B | Cohere | 32B | 19.9 GB |
| Yi 1.5 9B Chat | 01.AI | 9B | 5.5 GB |

## Lightweight (8 models)

| Model | Author | Params | Size (Q4_K_M) |
|---|---|---|---|
| TinyLlama 1.1B Chat | TinyLlama | 1.1B | 0.7 GB |
| Llama 3.2 1B Instruct | Meta | 1B | 0.8 GB |
| Gemma 2 2B Instruct | Google | 2B | 1.6 GB |
| Gemma 3 1B Instruct | Google | 1B | 0.8 GB |
| Qwen 2.5 0.5B Instruct | Alibaba | 0.5B | 0.4 GB |
| Qwen 2.5 1.5B Instruct | Alibaba | 1.5B | 1 GB |
| Qwen 2.5 3B Instruct | Alibaba | 3B | 2 GB |
| SmolLM2 1.7B Instruct | HuggingFace | 1.7B | 1.1 GB |

## Image Generation (5 models)

| Model | Author | Params | Size (Q4) | Size (Q8) |
|---|---|---|---|---|
| Stable Diffusion 1.5 | Runway | 860M | 0.5 GB | 1 GB |
| Stable Diffusion XL 1.0 | Stability AI | 3.5B | 2 GB | 3.5 GB |
| Stable Diffusion 3.5 Medium | Stability AI | 2.8B | 2.1 GB | 3.2 GB |
| Stable Diffusion 3.5 Large | Stability AI | 8B | 5.8 GB | 8.8 GB |
| FLUX.1 Dev | Black Forest Labs | 12B | 6.8 GB | 12.9 GB |
