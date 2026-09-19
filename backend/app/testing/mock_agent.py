from fastapi import FastAPI, HTTPException

app = FastAPI()
call_count = 0

@app.get("/health")
async def health(): return {"status": "ok"}

@app.get("/calls")
async def calls(): return {"count": call_count}

@app.post("/backtest")
async def backtest(payload: dict):
    global call_count
    call_count += 1
    candles = payload["ohlcv"]
    return {"signals": [
        {"open_time": candles[0]["open_time"], "action": "BUY"},
        {"open_time": candles[1]["open_time"], "action": "SELL"},
    ]}

@app.post("/fail/backtest")
async def failed_backtest():
    global call_count
    call_count += 1
    raise HTTPException(status_code=500, detail="intentional integration failure")
