#!/usr/bin/env python3
"""Static regression checks for the ATHAR LLM integration and protected MCQ builder."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read(path: str) -> str:
    file = ROOT / path
    assert file.is_file(), f"Required file missing: {path}"
    return file.read_text(encoding="utf-8")

page = read("llm-providers.html")
builder = read("mcq-builder.html")
auth = read("assets/auth.js")
function = read("supabase/functions/generate-mcq/index.ts")
readme = read("README.md")
setup = read("docs/implementation/llm-provider-gateway.md")

assert "cheahjs/free-llm-api-resources" in page, "Provider catalog must credit/link the upstream directory."
for provider in ("OpenRouter", "Groq", "Cerebras", "GitHub Models", "Hugging Face", "NVIDIA NIM", "Mistral AI", "Cloudflare"):
    assert provider in page, f"Provider catalog missing {provider}."
assert builder.count('id="source-pdf"') == 1, "PDF input must not be duplicated."
assert builder.count('id="generate-ai"') == 1, "AI generation control must not be duplicated."
assert builder.count('id="approve-ai"') == 1, "Approval control must not be duplicated."
assert "protectMcqBuilder" in builder, "MCQ builder must have an owner/admin guard."
assert "profiles" in builder and "owner" in builder and "admin" in builder, "Guard must verify staff role."
assert "pdf.min.js" in builder and "pdf.worker.min.js" in builder, "PDF.js and its worker must be configured."
assert ".from('mcq_questions').insert" in builder, "Manual MCQs must save to the cloud database."
assert "shouldCreateUser: false" in auth, "Public account creation must stay disabled."
assert "|admin|" not in auth, "Login must not redirect to an unpublished admin page."
for env in ("LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL", "LLM_PROVIDER"):
    assert env in function, f"Edge Function must support {env}."
assert 'fetch(baseUrl + "/chat/completions"' in function, "Gateway must use the configured provider endpoint."
assert 'includes(profiles[0].role)' in function and '"owner", "admin"' in function, "Server must enforce owner/admin authorization."
assert "LLM_API_KEY" in setup and "لا تضع أي مفتاح" in setup, "Provider secrets and secret-safety rules must be documented."
assert "llm-providers.html" in readme and "LLM_BASE_URL" in readme, "README must document the live integration architecture."
assert "API موحدة" in page, "The page must explain that the upstream directory is not a unified API."
print("ATHAR LLM integration and MCQ builder static regression checks passed.")
