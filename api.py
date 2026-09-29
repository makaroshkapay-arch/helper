from datetime import datetime, timedelta, timezone
from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select
from database import SessionLocal, Calculation, Goal, NFTDeal
import httpx

router = APIRouter(prefix="/api")

class CalcIn(BaseModel):
    telegram_id: int = 0
    buy_price: float
    sell_price: float
    fiat_amount: float
    buy_commission: float = 0
    sell_commission: float = 0

class GoalIn(BaseModel):
    telegram_id: int = 0
    title: str = "Моя цель"
    target: float
    current: float = 0

def calculate(x: CalcIn):
    buy_cost = x.fiat_amount * (1 + x.buy_commission / 100)
    gross = x.fiat_amount * (x.sell_price / x.buy_price) if x.buy_price else 0
    sell_fee = gross * x.sell_commission / 100
    profit = gross - buy_cost - sell_fee
    spread = ((x.sell_price - x.buy_price) / x.buy_price * 100) if x.buy_price else 0
    return profit, spread

@router.post("/calculate")
async def calculate_route(x: CalcIn):
    profit, spread = calculate(x)
    async with SessionLocal() as db:
        row = Calculation(
            telegram_id=x.telegram_id,
            buy_price=x.buy_price, sell_price=x.sell_price,
            fiat_amount=x.fiat_amount,
            buy_commission=x.buy_commission, sell_commission=x.sell_commission,
            profit=profit, spread=spread
        )
        db.add(row)
        await db.commit()
        return {"profit": profit, "spread": spread, "id": row.id}

@router.get("/history/{telegram_id}")
async def history(telegram_id: int):
    async with SessionLocal() as db:
        result = await db.execute(
            select(Calculation).where(Calculation.telegram_id == telegram_id)
            .order_by(Calculation.created_at.desc()).limit(100)
        )
        rows = result.scalars().all()
        return [{
            "id": r.id, "buy": r.buy_price, "sell": r.sell_price,
            "fiat": r.fiat_amount, "buy_commission": r.buy_commission,
            "sell_commission": r.sell_commission, "profit": r.profit,
            "spread": r.spread, "created_at": r.created_at.isoformat()
        } for r in rows]

@router.delete("/history/{telegram_id}")
async def clear_history(telegram_id: int):
    async with SessionLocal() as db:
        result = await db.execute(select(Calculation).where(Calculation.telegram_id == telegram_id))
        for row in result.scalars().all():
            await db.delete(row)
        await db.commit()
        return {"ok": True}

@router.get("/stats/{telegram_id}")
async def stats(telegram_id: int):
    now = datetime.now(timezone.utc)
    async with SessionLocal() as db:
        result = await db.execute(select(Calculation).where(Calculation.telegram_id == telegram_id))
        rows = result.scalars().all()

    def period(days):
        start = now - timedelta(days=days)
        rs = [r for r in rows if r.created_at.replace(tzinfo=timezone.utc) >= start]
        profit = sum(r.profit for r in rs)
        avg_spread = sum(r.spread for r in rs) / len(rs) if rs else 0
        return {"profit": profit, "orders": len(rs), "avg_spread": avg_spread}

    total = sum(r.profit for r in rows)
    losses = sum(r.profit for r in rows if r.profit < 0)
    return {"today": period(1), "week": period(7), "month": period(30),
            "total_profit": total, "orders": len(rows), "losses": losses}

@router.get("/goal/{telegram_id}")
async def get_goal(telegram_id: int):
    async with SessionLocal() as db:
        goal = await db.get(Goal, telegram_id)
        if not goal:
            return {"set": False}
        return {"set": True, "title": goal.title, "target": goal.target, "current": goal.current}

@router.post("/goal")
async def save_goal(x: GoalIn):
    async with SessionLocal() as db:
        goal = await db.get(Goal, x.telegram_id)
        if goal:
            goal.title, goal.target, goal.current = x.title, x.target, x.current
        else:
            db.add(Goal(telegram_id=x.telegram_id, title=x.title, target=x.target, current=x.current))
        await db.commit()
        return {"ok": True}


class NFTIn(BaseModel):
    telegram_id: int = 0
    name: str = "NFT"
    buy_price: float
    buy_currency: str = "TON"
    sell_price: float
    sell_currency: str = "TON"
    link: str = ""

@router.post("/nft")
async def save_nft(x: NFTIn):
    profit=x.sell_price-x.buy_price
    async with SessionLocal() as db:
        row=NFTDeal(telegram_id=x.telegram_id,name=x.name,buy_price=x.buy_price,buy_currency=x.buy_currency,
                    sell_price=x.sell_price,sell_currency=x.sell_currency,link=x.link,profit=profit)
        db.add(row); await db.commit()
        return {"ok":True,"id":row.id,"profit":profit}

@router.get("/nft/{telegram_id}")
async def nft_history(telegram_id:int):
    async with SessionLocal() as db:
        result=await db.execute(select(NFTDeal).where(NFTDeal.telegram_id==telegram_id).order_by(NFTDeal.created_at.desc()).limit(100))
        return [{"id":r.id,"name":r.name,"buy_price":r.buy_price,"buy_currency":r.buy_currency,
                 "sell_price":r.sell_price,"sell_currency":r.sell_currency,"link":r.link,
                 "profit":r.profit,"created_at":r.created_at.isoformat()} for r in result.scalars().all()]

@router.get("/rates")
async def rates():
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r=await client.get("https://api.coingecko.com/api/v3/simple/price",
                               params={"ids":"the-open-network","vs_currencies":"usd,rub","include_24hr_change":"true"})
            r.raise_for_status(); d=r.json()["the-open-network"]
            return {"symbol":"TON (GRAM)","usd":d.get("usd"),"rub":d.get("rub"),
                    "change24h":d.get("usd_24h_change"),"source":"CoinGecko"}
    except Exception:
        return {"error":"Курс временно недоступен"}


class ExchangeIn(BaseModel):
    telegram_id: int = 0
    service: str = "Send"
    fee_type: str = "taker"
    amount: float
    from_currency: str
    to_currency: str
    rate: float
    commission: float
    fee_mode: str = "subtract"

@router.post("/exchange")
async def exchange_calc(x: ExchangeIn):
    if x.amount <= 0 or x.rate <= 0:
        return {"error": "Сумма и курс должны быть больше нуля"}
    fee = x.amount * x.commission / 100
    net = x.amount - fee if x.fee_mode == "subtract" else x.amount
    received = net * x.rate
    total_spent = x.amount + fee if x.fee_mode == "add" else x.amount
    return {"amount": x.amount, "commission": x.commission, "fee": fee,
            "net": net, "rate": x.rate, "received": received,
            "total_spent": total_spent, "from_currency": x.from_currency,
            "to_currency": x.to_currency, "service": x.service,
            "fee_type": x.fee_type, "fee_mode": x.fee_mode}

@router.get("/exchange-rates")
async def exchange_rates():
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={"ids":"the-open-network,tether,bitcoin,ethereum",
                        "vs_currencies":"usd,rub"})
            r.raise_for_status()
            d = r.json()
        return {"TON": d.get("the-open-network", {}), "USDT": d.get("tether", {}),
                "BTC": d.get("bitcoin", {}), "ETH": d.get("ethereum", {}), "USD": {"usd":1}, "RUB":{"rub":1}}
    except Exception:
        return {"error":"Курсы временно недоступны"}
