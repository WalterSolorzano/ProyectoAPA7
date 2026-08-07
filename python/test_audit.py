import asyncio
import os
import sys

import httpx

# Agregamos la ruta actual para poder importar los módulos
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from classification.llm_classifier import _get_active_providers


async def audit():
    providers = _get_active_providers()
    print(f"Auditing {len(providers)} providers...")
    for p in providers:
        if p["key"] == "local-no-key":
            continue
        print(f"\n--- Provider: {p['name']} ---")
        payload = {
            "model": p["model"],
            "messages": [{"role": "user", "content": "Say hello world"}],
            "max_tokens": 10
        }
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(p["url"], json=payload, headers=p["headers"](p["key"]))
            print(f"Status: {resp.status_code}")
            headers = {k.lower(): v for k, v in resp.headers.items()}

            rate_limit_headers = {k: v for k, v in headers.items() if 'ratelimit' in k or 'retry-after' in k or 'limit' in k or 'quota' in k}
            if rate_limit_headers:
                print("Rate Limit Headers:")
                for k, v in rate_limit_headers.items():
                    print(f"  {k}: {v}")
            else:
                print("No visible rate limit headers.")
        except Exception as e:
            print(f"Error: {e}")

    print("\nAuditoria finalizada.")

if __name__ == "__main__":
    asyncio.run(audit())
