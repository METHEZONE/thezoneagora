"use client";

import { motion } from "framer-motion";
import { useMotionOk } from "./useMotionOk";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * 열쇠가 검은 상자로 빨려 들어가는 다이어그램.
 * 열쇠 루프는 CSS keyframes. 모션 정지/축소 시 .loop 클래스가 빠져 정지 화면이 된다.
 */
function KeyDiagram() {
  const motionOk = useMotionOk();

  return (
    <figure className="ag-keybox">
      <div className="ag-keybox-stage" role="img" aria-label="API 키가 서드파티 봇 상자로 들어가는 그림">
        <span className="ag-keybox-rail" aria-hidden="true" />

        <div className="ag-keybox-box" aria-hidden="true">
          <span className={`ag-keybox-slot${motionOk ? " loop" : ""}`} />
          <i />
          <i />
          <i />
        </div>
        <span className="ag-keybox-boxlabel" aria-hidden="true">
          서드파티 트레이딩 봇
        </span>

        <div className="ag-key-track" aria-hidden="true">
        <div className={`ag-key${motionOk ? " loop" : ""}`}>
          <span className="ag-key-tag">API KEY · 출금 권한 포함</span>
          <svg viewBox="0 0 110 40" width="110" height="40">
            <circle cx="18" cy="20" r="13" fill="none" stroke="#11100F" strokeWidth="3.5" />
            <line x1="31" y1="20" x2="104" y2="20" stroke="#11100F" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="86" y1="20" x2="86" y2="31" stroke="#11100F" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="100" y1="20" x2="100" y2="28" stroke="#11100F" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        </div>
        </div>
      </div>
      <figcaption>열쇠가 들어간 뒤의 일은 보이지 않습니다</figcaption>
    </figure>
  );
}

export function SceneCold() {
  const motionOk = useMotionOk();

  return (
    <header className="ag-scene ag-cold" id="top">
      <div className="ag-wrap">
        <motion.h1
          className="ag-display ag-h1"
          initial={motionOk ? { opacity: 0, y: 28 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          봇에게 API 키를 넘기는 순간,
          <br />
          돈은 당신 것이 아닙니다.
        </motion.h1>

        <div className="ag-cold-grid">
          <motion.p
            className="ag-lede"
            initial={motionOk ? { opacity: 0, y: 18 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12, ease: EASE }}
          >
            거래소 API 키에는 대개 출금 권한까지 딸려 갑니다. 열쇠를 건넨 다음부터
            할 수 있는 일은 지켜보는 것뿐입니다. AGORA는 열쇠 대신 규칙을 건네는
            구조를 만들었습니다.
          </motion.p>
          <motion.div
            initial={motionOk ? { opacity: 0, y: 18 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.24, ease: EASE }}
          >
            <KeyDiagram />
          </motion.div>
        </div>

        <div className="ag-cold-cue" aria-hidden="true">
          <i />
          아래에서 증명합니다
        </div>
      </div>
    </header>
  );
}
