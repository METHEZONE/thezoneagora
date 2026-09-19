from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import Select, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters import get_adapter
from app.config import get_settings
from app.database import get_session
from app.models import Agent, ExecutionAttempt, Signal
from app.schemas import SignalExecutionRead, SignalRead
from app.services.executor_client import ExecutorError, execute_signal


router = APIRouter(prefix="/signals", tags=["signals"])
settings = get_settings()


@router.post("", response_model=SignalExecutionRead, status_code=status.HTTP_201_CREATED)
async def create_signal(
    payload: dict[str, Any],
    session: Annotated[AsyncSession, Depends(get_session)],
    agent_key: Annotated[str, Header(alias="X-Agent-Key")],
) -> dict[str, Signal | ExecutionAttempt]:
    agent = await session.scalar(select(Agent).where(Agent.agent_key == agent_key))
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid agent key",
        )
    if agent.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Signals can only be stored for an ACTIVE agent",
        )

    try:
        adapter = get_adapter(agent.adapter_key)
        normalized = adapter(
            payload,
            timeframe=agent.timeframe,
            signal_ttl_ms=settings.signal_ttl_ms,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    signal = Signal(agent_id=agent.id, **normalized)
    session.add(signal)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A signal with this signal_id already exists for the agent",
        ) from exc

    await session.refresh(signal)

    attempt = ExecutionAttempt(signal_id=signal.id, status="PENDING")
    session.add(attempt)
    await session.commit()
    await session.refresh(attempt)

    try:
        digest = await execute_signal(
            signal,
            executor_url=settings.executor_url,
            timeout_seconds=settings.executor_timeout_seconds,
        )
        attempt.status = "SUCCESS"
        attempt.tx_digest = digest
    except ExecutorError as exc:
        attempt.status = "FAILED"
        attempt.error_message = str(exc)

    await session.commit()
    await session.refresh(attempt)
    return {"signal": signal, "execution": attempt}


@router.get("", response_model=list[SignalRead])
async def list_signals(
    session: Annotated[AsyncSession, Depends(get_session)],
    agent_id: Annotated[int | None, Query(gt=0)] = None,
    order: Literal["asc", "desc"] = "asc",
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
) -> list[Signal]:
    statement: Select[tuple[Signal]] = select(Signal)
    if agent_id is not None:
        statement = statement.where(Signal.agent_id == agent_id)

    ordering = Signal.generated_at.asc() if order == "asc" else Signal.generated_at.desc()
    result = await session.scalars(statement.order_by(ordering, Signal.id).limit(limit))
    return list(result)
