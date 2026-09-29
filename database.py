from datetime import datetime, timezone
from sqlalchemy import String, Integer, Float, DateTime, select, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./p2p_helper.db")
engine = create_async_engine(DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class Calculation(Base):
    __tablename__ = "calculations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    telegram_id: Mapped[int] = mapped_column(Integer, index=True)
    buy_price: Mapped[float] = mapped_column(Float, default=0)
    sell_price: Mapped[float] = mapped_column(Float, default=0)
    fiat_amount: Mapped[float] = mapped_column(Float, default=0)
    buy_commission: Mapped[float] = mapped_column(Float, default=0)
    sell_commission: Mapped[float] = mapped_column(Float, default=0)
    profit: Mapped[float] = mapped_column(Float, default=0)
    spread: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

class NFTDeal(Base):
    __tablename__ = "nft_deals"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    telegram_id: Mapped[int] = mapped_column(Integer, index=True)
    name: Mapped[str] = mapped_column(String(160), default="NFT")
    buy_price: Mapped[float] = mapped_column(Float, default=0)
    buy_currency: Mapped[str] = mapped_column(String(12), default="TON")
    sell_price: Mapped[float] = mapped_column(Float, default=0)
    sell_currency: Mapped[str] = mapped_column(String(12), default="TON")
    link: Mapped[str] = mapped_column(String(500), default="")
    profit: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

class Goal(Base):
    __tablename__ = "goals"
    telegram_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(120), default="Моя цель")
    target: Mapped[float] = mapped_column(Float, default=0)
    current: Mapped[float] = mapped_column(Float, default=0)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
