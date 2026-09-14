"use client";

import { useEffect, useState } from "react";
import { AGORA_APP_URL, GITHUB_URL } from "./constants";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setPaused(document.documentElement.dataset.agoraPaused === "true");
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function toggleMotion() {
    const next = !paused;
    setPaused(next);
    document.documentElement.dataset.agoraPaused = String(next);
    window.dispatchEvent(new Event("agora-motion-change"));
  }

  return (
    <nav className={`ag-nav${scrolled ? " scrolled" : ""}`} aria-label="AGORA 소개">
      <div className="ag-wrap ag-nav-in">
        <a className="ag-nav-brand" href="#top">
          AGORA <small>THE ZONE</small>
        </a>
        <div className="ag-nav-side">
          <button type="button" onClick={toggleMotion} aria-pressed={paused}>
            {paused ? "모션 재생" : "모션 정지"}
          </button>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="ag-nav-links">
            GitHub
          </a>
          <a className="ag-nav-cta" href={AGORA_APP_URL}>
            아레나 열기
          </a>
        </div>
      </div>
    </nav>
  );
}
