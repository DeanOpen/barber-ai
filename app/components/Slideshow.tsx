"use client";

import {
  CloseOutlined,
  DownloadOutlined,
  LeftOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { Button } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";

type Slide = { name: string; description: string; b64: string | null };

type Props = {
  slides: Slide[];
  startIndex?: number;
  onClose: () => void;
};

const AUTO_ADVANCE_MS = 4500;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function Slideshow({ slides, startIndex = 0, onClose }: Props) {
  const [index, setIndex] = useState(() =>
    Math.max(0, Math.min(startIndex, Math.max(0, slides.length - 1)))
  );
  const [auto, setAuto] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const total = slides.length;
  const slide = slides[index];

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % total);
  }, [total]);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key.toLowerCase() === "p") {
        setAuto((a) => !a);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  useEffect(() => {
    if (!auto || total <= 1) return;
    const id = window.setInterval(next, AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [auto, next, total]);

  // Lock body scroll while open.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartX.current;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX ?? start;
    const dx = end - start;
    if (Math.abs(dx) > 40) {
      if (dx < 0) next();
      else prev();
    }
    touchStartX.current = null;
  }

  if (!slide) return null;

  const downloadName = `${slugify(slide.name) || `look-${index + 1}`}.png`;

  return (
    <div
      className="slideshow"
      role="dialog"
      aria-modal="true"
      aria-label="Lookbook slideshow"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="slideshow-topbar">
        <div className="slideshow-counter">
          {index + 1} / {total}
        </div>
        <div className="slideshow-controls">
          <Button
            type="text"
            size="large"
            icon={auto ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={() => setAuto((a) => !a)}
            aria-label={auto ? "Pause auto-advance" : "Play auto-advance"}
            className="slideshow-btn"
          >
            {auto ? "Pause" : "Auto"}
          </Button>
          <Button
            type="text"
            size="large"
            icon={<CloseOutlined />}
            onClick={onClose}
            aria-label="Close slideshow"
            className="slideshow-btn"
          />
        </div>
      </div>

      <div className="slideshow-stage">
        <button
          type="button"
          className="slideshow-nav slideshow-nav-prev"
          onClick={prev}
          aria-label="Previous look"
          disabled={total <= 1}
        >
          <LeftOutlined />
        </button>

        <div className="slideshow-frame">
          {slide.b64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/png;base64,${slide.b64}`}
              alt={slide.name}
              className="slideshow-image"
            />
          ) : (
            <div className="slideshow-image slideshow-image-failed">
              this look failed
            </div>
          )}
        </div>

        <button
          type="button"
          className="slideshow-nav slideshow-nav-next"
          onClick={next}
          aria-label="Next look"
          disabled={total <= 1}
        >
          <RightOutlined />
        </button>
      </div>

      <div className="slideshow-caption">
        <div className="slideshow-name">{slide.name}</div>
        {slide.description && (
          <div className="slideshow-desc">{slide.description}</div>
        )}
        {slide.b64 && (
          <div className="slideshow-actions">
            <a
              className="slideshow-save"
              href={`data:image/png;base64,${slide.b64}`}
              download={downloadName}
            >
              <DownloadOutlined /> Save this one
            </a>
          </div>
        )}
      </div>

      <div className="slideshow-dots" role="tablist" aria-label="Lookbook slides">
        {slides.map((s, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Go to slide ${i + 1}: ${s.name}`}
            className={`slideshow-dot ${i === index ? "is-active" : ""}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}
