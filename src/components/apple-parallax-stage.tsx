"use client";

import { useEffect, useRef } from "react";

/** A small, scroll-linked depth effect that does not rely on animation libraries. */
export function AppleParallaxStage() {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = stage.getBoundingClientRect();
        const viewportCenter = window.innerHeight / 2;
        const stageCenter = rect.top + rect.height / 2;
        const shift = Math.max(-24, Math.min(24, (viewportCenter - stageCenter) * 0.08));
        stage.style.setProperty("--parallax-shift", `${shift.toFixed(2)}px`);
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div ref={stageRef} className="apple-parallax-stage" aria-label="Vista previa de ReventaIQ">
      <div className="apple-stage-disc apple-stage-disc-left" aria-hidden="true" />
      <div className="apple-stage-disc apple-stage-disc-right" aria-hidden="true" />
      <div className="apple-product-window">
        <div className="apple-product-topbar"><span /><span /><span /><b>REVENTAIQ</b></div>
        <div className="apple-product-body">
          <aside aria-hidden="true"><b>R</b><i /><i /><i /></aside>
          <div className="apple-product-main">
            <p>OPERACIÓN</p>
            <h3>Decide con claridad.</h3>
            <div className="apple-product-stat"><span>Oportunidades</span><strong>Sin datos</strong></div>
            <div className="apple-product-card"><span>PRÓXIMO PASO</span><b>Nueva evaluación</b></div>
          </div>
        </div>
      </div>
      <p className="apple-stage-caption">Cada compra, con su evidencia.</p>
    </div>
  );
}
