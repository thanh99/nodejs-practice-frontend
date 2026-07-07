"use client";

import { useEffect } from "react";

export default function RippleEffect() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest("button:not([disabled])") as HTMLElement | null;
      if (!el) return;

      const cls = el.className ?? "";
      const isFilled = /bg-(blue|violet|indigo|gray-[89]|red|green|purple|black|gradient)/.test(cls)
        || el.style.backgroundColor;
      if (!isFilled) return;

      const rect = el.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2.2;
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      const circle = document.createElement("span");
      Object.assign(circle.style, {
        position:     "absolute",
        width:        `${size}px`,
        height:       `${size}px`,
        left:         `${x}px`,
        top:          `${y}px`,
        background:   "rgba(255,255,255,0.3)",
        borderRadius: "50%",
        transform:    "scale(0)",
        animation:    "rippleExpand 0.55s ease-out forwards",
        pointerEvents:"none",
      });

      el.style.position = "relative";
      el.style.overflow = "hidden";
      el.appendChild(circle);
      circle.addEventListener("animationend", () => circle.remove());
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
