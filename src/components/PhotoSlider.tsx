import { useEffect, useState } from 'react';
import type { SliderPhoto } from '../types';

const SLIDE_INTERVAL_MS = 5000;

export function PhotoSlider({
  photos,
  loaded,
}: {
  photos: SliderPhoto[];
  loaded: boolean;
}) {
  const slides = loaded ? photos.map((p) => p.image_data) : [];
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setIndex(0);
    setAnimate(true);
  }, [slides.length]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPaused(document.hidden || mq.matches);
    update();
    document.addEventListener('visibilitychange', update);
    mq.addEventListener('change', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      mq.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    if (slides.length < 2 || paused || index >= slides.length) return;
    const timer = window.setTimeout(() => {
      setAnimate(true);
      setIndex((prev) => prev + 1);
    }, SLIDE_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [index, slides.length, paused]);

  useEffect(() => {
    if (index === slides.length && slides.length > 1) {
      const resetTimer = window.setTimeout(() => {
        setAnimate(false);
        setIndex(0);
      }, 700);
      return () => window.clearTimeout(resetTimer);
    }
  }, [index, slides.length]);

  if (slides.length === 0) {
    return null;
  }

  const trackSlides = slides.length > 1 ? [...slides, slides[0]] : slides;
  const activeDot = index % slides.length;

  return (
    <div className="photo-slider" aria-hidden="true">
      <div
        className="photo-slider-track"
        style={{
          transform: `translate3d(-${index * 100}%, 0, 0)`,
          transition: animate ? 'transform 0.7s ease-in-out' : 'none',
        }}
      >
        {trackSlides.map((src, idx) => (
          <div key={`${idx}-${src.slice(0, 32)}`} className="photo-slide">
            <img
              src={src}
              className={src === '/assets/slider-banner-2.jpg' ? 'festival-slide' : undefined}
              alt=""
              loading={idx <= index + 1 ? 'eager' : 'lazy'}
              decoding="async"
              width={1200}
              height={600}
            />
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="photo-slider-dots">
          {slides.map((_, idx) => (
            <span key={idx} className={`photo-dot${idx === activeDot ? ' is-active' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
}
