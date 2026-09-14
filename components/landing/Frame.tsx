"use client";

import { motion } from "framer-motion";
import { useMotionOk } from "./useMotionOk";

/**
 * 제품 화면을 담는 브라우저 프레임.
 * transform: translateZ(0)이 걸려 있어 내부의 position: fixed 요소(시트, 모달)가
 * 프레임 밖으로 탈출하지 못한다. static이면 내부 인터랙션을 막는다(전시용).
 */
export function Frame({
  url,
  children,
  cropHeight,
  isStatic = false,
  className,
}: {
  url: string;
  children: React.ReactNode;
  cropHeight?: number;
  isStatic?: boolean;
  className?: string;
}) {
  const motionOk = useMotionOk();

  return (
    <motion.figure
      className={`ag-frame${className ? ` ${className}` : ""}`}
      style={{ margin: 0 }}
      initial={motionOk ? { opacity: 0, y: 36 } : false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ag-frame-bar" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>{url}</span>
        <i style={{ opacity: 0 }} />
      </div>
      <div
        className={`ag-frame-body${isStatic ? " ag-frame-static" : ""}${cropHeight ? " ag-frame-crop" : ""}`}
        style={cropHeight ? { maxHeight: cropHeight } : undefined}
        aria-hidden={isStatic || undefined}
      >
        {children}
        {cropHeight ? <div className="ag-frame-fade" /> : null}
      </div>
    </motion.figure>
  );
}

/** 마운트 전 자리를 지키는 어두운 플레이스홀더. */
export function FramePlaceholder({ height }: { height: number }) {
  return (
    <div className="ag-frame-placeholder" style={{ height }}>
      라이브 데이터 연결 중
    </div>
  );
}
