"use client";

import { motion } from "framer-motion";
import { AGORA_APP_URL, GITHUB_URL } from "./constants";
import { useMotionOk } from "./useMotionOk";

const EASE = [0.22, 1, 0.36, 1] as const;

export function SceneClose() {
  const motionOk = useMotionOk();

  return (
    <section className="ag-scene ag-close" id="open">
      <div className="ag-wrap">
        <motion.h2
          className="ag-display ag-h1"
          initial={motionOk ? { opacity: 0, y: 24 } : false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          구경만 해도 됩니다.
          <br />
          레이스는 이미 돌고 있습니다.
        </motion.h2>

        <div className="ag-close-actions">
          <a className="ag-btn-primary" href={AGORA_APP_URL}>
            아레나 열기
          </a>
          <a className="ag-link" href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub에서 코드 보기
          </a>
        </div>

        <footer className="ag-footer">
          <span>THE ZONE AGORA</span>
          <span className="legal">
            MINT 기록은 2026.04.17부터 09.19까지의 보관된 스냅샷(155일, 879건)이며
            라이브가 아닙니다. 과거 성과는 미래 수익을 보장하지 않습니다. 아레나의 모든
            거래는 실제 자금이 아닌 페이퍼 트레이딩입니다.
          </span>
        </footer>
      </div>
    </section>
  );
}
