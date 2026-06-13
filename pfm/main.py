import os
from pathlib import Path
from functools import lru_cache
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pfm.config import Config
from pfm.stripe_client import StripeClient
import stripe


config = Config()
app = FastAPI(title="PyFastMart")

BASE_DIR = Path(__file__).parent.parent
STATIC_DIR = Path(os.getenv("STATIC_DIR", str(BASE_DIR / "frontend")))

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@lru_cache
def get_home():
    with open(STATIC_DIR/'index.html', 'r') as index:
        return index.read()

def get_stripe_client() -> StripeClient:
    if not config.stripe.secret_key:
        raise HTTPException(
            status_code=500,
            detail="Stripe not configured. Run 'pfm manage' to set up Stripe keys.",
        )
    return StripeClient(config.stripe.secret_key)


@app.get("/api/site", response_model=dict)
async def get_site_info():
    return config.get_site_data()


@app.get("/api/products", response_model=list[dict])
async def get_products():
    client = get_stripe_client()
    products = client.get_products()
    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "price": p.price,
            "price_id": p.price_id,
            "currency": p.currency,
            "image": p.image,
        }
        for p in products
    ]


@app.post("/api/checkout")
async def create_checkout(request: Request):
    data = await request.json()
    items = data.get("items", [])

    if not items:
        raise HTTPException(status_code=400, detail="No items in cart")

    client = get_stripe_client()

    origin = request.headers.get("origin", "http://localhost:8000")

    line_items = [
        {
            "price": item["price_id"],
            "quantity": item.get("quantity", 1),
        }
        for item in items
    ]

    session = client.create_checkout_session(
        line_items=line_items,
        success_url=f"{origin}?success=true",
        cancel_url=f"{origin}?canceled=true",
        metadata={"items": str(items)},
    )

    return {"url": session.url}


@app.post("/api/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not config.stripe.webhook_secret:
        raise HTTPException(status_code=500, detail="Webhook not configured")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, config.stripe.webhook_secret
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    return {"received": True}


@app.get("/", response_class=HTMLResponse)
async def index():
    return get_home()


def run():
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
