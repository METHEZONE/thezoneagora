"use client";

// 가격(옅은 영역, 오른쪽 축) + 내 자산(굵은 선, 왼쪽 축) + 그냥 들고있기(점선) 한 화면.
// 매수 ▲ / 매도 ▼ 마커는 가격선에 붙어 "어디서 샀고 어디서 팔았는지"가 바로 보인다.
// upTo를 주면 그 인덱스까지만 그린다 — Time Machine 리플레이용.

import { useEffect, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, SeriesMarker, UTCTimestamp } from "lightweight-charts";
import type { BtResult } from "@/lib/backtest/engine";

export function PriceEquityChart({
  result,
  accent,
  upTo,
  showRejected = false,
  showHold = true,
  height = 320,
  onHoverIndex,
}: {
  result: BtResult;
  accent: string;
  upTo?: number | null;
  showRejected?: boolean;
  showHold?: boolean;
  height?: number;
  onHoverIndex?: (index: number | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceRef = useRef<ISeriesApi<"Area"> | null>(null);
  const equityRef = useRef<ISeriesApi<"Line"> | null>(null);
  const holdRef = useRef<ISeriesApi<"Line"> | null>(null);
  const [ready, setReady] = useState(0);

  // 차트 1회 생성
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let disposed = false;
    let ro: ResizeObserver | null = null;

    (async () => {
      const { createChart, ColorType, LineStyle, CrosshairMode } = await import("lightweight-charts");
      if (disposed || !ref.current) return;
      const chart = createChart(el, {
        width: el.clientWidth,
        height,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#8d857b",
          fontFamily: "var(--body), Inter, Pretendard, sans-serif",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "rgba(44,40,35,0.6)", style: LineStyle.Dotted },
          horzLines: { color: "rgba(44,40,35,0.6)", style: LineStyle.Dotted },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "rgba(255,90,31,0.5)", labelBackgroundColor: "#ff5a1f" },
          horzLine: { color: "rgba(185,176,165,0.35)", labelBackgroundColor: "#2c2823" },
        },
        leftPriceScale: {
          visible: true,
          borderColor: "rgba(44,40,35,0.9)",
          scaleMargins: { top: 0.12, bottom: 0.12 },
        },
        rightPriceScale: {
          visible: true,
          borderColor: "rgba(44,40,35,0.9)",
          scaleMargins: { top: 0.3, bottom: 0.02 },
        },
        timeScale: {
          borderColor: "rgba(44,40,35,0.9)",
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 4,
        },
        handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
        handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: false },
      });

      const price = chart.addAreaSeries({
        priceScaleId: "right",
        lineColor: "rgba(185,176,165,0.55)",
        topColor: "rgba(185,176,165,0.14)",
        bottomColor: "rgba(185,176,165,0.0)",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: false,
        priceFormat: { type: "price", precision: 2, minMove: 0.01 },
      });
      const hold = chart.addLineSeries({
        priceScaleId: "left",
        color: "rgba(127,138,153,0.7)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        priceFormat: { type: "custom", formatter: (v: number) => `$${Math.round(v).toLocaleString()}` },
      });
      const equity = chart.addLineSeries({
        priceScaleId: "left",
        color: accent,
        lineWidth: 3,
        priceLineVisible: true,
        priceLineColor: accent,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        priceFormat: { type: "custom", formatter: (v: number) => `$${Math.round(v).toLocaleString()}` },
      });

      chart.subscribeCrosshairMove((p) => {
        if (!onHoverIndex) return;
        if (!p.time || p.point === undefined) {
          onHoverIndex(null);
          return;
        }
        const ts = (p.time as number) * 1000;
        const idx = result.candles.findIndex((c) => c.t === ts);
        onHoverIndex(idx >= 0 ? idx : null);
      });

      chartRef.current = chart;
      priceRef.current = price;
      equityRef.current = equity;
      holdRef.current = hold;
      ro = new ResizeObserver(() => {
        if (ref.current) chart.applyOptions({ width: ref.current.clientWidth });
      });
      ro.observe(el);
      setReady((n) => n + 1);
    })();

    return () => {
      disposed = true;
      ro?.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
      priceRef.current = null;
      equityRef.current = null;
      holdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // 데이터/마커 갱신
  useEffect(() => {
    const chart = chartRef.current;
    const price = priceRef.current;
    const equity = equityRef.current;
    const hold = holdRef.current;
    if (!chart || !price || !equity || !hold) return;

    const n = result.candles.length;
    const cut = upTo === null || upTo === undefined ? n : Math.max(1, Math.min(n, upTo + 1));
    const t = (i: number) => (result.candles[i].t / 1000) as UTCTimestamp;

    price.setData(result.candles.slice(0, cut).map((c, i) => ({ time: t(i), value: c.c })));
    equity.setData(result.equityCurve.slice(0, cut).map((v, i) => ({ time: t(i), value: v })));
    hold.setData(showHold ? result.holdCurve.slice(0, cut).map((v, i) => ({ time: t(i), value: v })) : []);
    equity.applyOptions({ color: accent, priceLineColor: accent });

    const markers: SeriesMarker<UTCTimestamp>[] = [];
    for (const tr of result.trades) {
      if (tr.index >= cut) break;
      if (tr.verdict === "REJECTED") {
        if (!showRejected) continue;
        markers.push({
          time: t(tr.index),
          position: "inBar",
          color: "rgba(141,133,123,0.8)",
          shape: "circle",
          size: 0.6,
          text: "",
        });
        continue;
      }
      markers.push(
        tr.side === "BUY"
          ? { time: t(tr.index), position: "belowBar", color: "#24c77a", shape: "arrowUp", size: 1.4, text: "매수" }
          : {
              time: t(tr.index),
              position: "aboveBar",
              color: "#f04f5f",
              shape: "arrowDown",
              size: 1.4,
              text: tr.pnlPct !== null ? `매도 ${tr.pnlPct >= 0 ? "+" : ""}${tr.pnlPct.toFixed(1)}%` : "매도",
            }
      );
    }
    price.setMarkers(markers);

    // 전체 창을 항상 보이게 — 리플레이 중에도 축이 흔들리지 않도록 전체 범위로 고정.
    chart.timeScale().setVisibleRange({ from: t(0), to: t(n - 1) });
  }, [result, upTo, showRejected, showHold, accent, ready]);

  return <div ref={ref} className="ag-chart" style={{ height }} />;
}
