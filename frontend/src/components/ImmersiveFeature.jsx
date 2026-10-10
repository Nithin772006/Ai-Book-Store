import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Button from './Button';
import defaultFeaturePoster from '../assets/library-feature-poster.jpg';

gsap.registerPlugin(useGSAP, ScrollTrigger);

export const DEFAULT_FEATURE_VIDEO_SRC = null; // Update with second video asset when available

export default function ImmersiveFeature({
  videoSrc = DEFAULT_FEATURE_VIDEO_SRC,
  posterSrc = defaultFeaturePoster,
  eyebrow = 'THE ARCHIVES',
  heading = 'A world waiting\nbetween the pages.',
  supportingText = 'Explore the ideas, stories, and discoveries that make every reading journey unique. Curated volumes preserved for longevity and intellect.',
  ctaText = 'DISCOVER THE ARCHIVES',
  ctaLink = '/books',
}) {
  const containerRef = useRef(null);
  const mediaRef = useRef(null);

  useGSAP(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    // Parallax movement on media container during scroll
    gsap.to(mediaRef.current, {
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1.2,
      },
      yPercent: 8,
      ease: 'none',
    });

    // Stagger reveal on the burgundy content panel
    gsap.from('.feature-reveal-item', {
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 75%',
        toggleActions: 'play none none reverse',
      },
      opacity: 0,
      y: 30,
      stagger: 0.18,
      duration: 0.9,
      ease: 'power3.out',
    });
  }, { scope: containerRef });

  return (
    <section ref={containerRef} className="immersive-feature-section" aria-label="Library Feature">
      <div className="store-container feature-inner-container">
        {/* Media Window Column */}
        <div className="feature-media-column">
          <div className="feature-media-window">
            <div ref={mediaRef} className="feature-media-parallax-wrap">
              {videoSrc ? (
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  poster={posterSrc}
                  className="feature-media-tag"
                  aria-hidden="true"
                >
                  <source src={videoSrc} type="video/mp4" />
                </video>
              ) : (
                <img
                  src={posterSrc}
                  alt="Atmospheric private library with arched mahogany shelves and warm amber light"
                  className="feature-media-tag"
                />
              )}
            </div>
          </div>
        </div>

        {/* Contrasting Rich Burgundy Content Panel */}
        <div className="feature-content-column">
          <div className="feature-burgundy-card">
            <span className="feature-eyebrow feature-reveal-item">{eyebrow}</span>
            <h2 className="feature-heading feature-reveal-item">
              {heading.split('\n').map((line, idx) => (
                <span key={idx} className="feature-heading-line">
                  {line}
                </span>
              ))}
            </h2>
            <p className="feature-copy feature-reveal-item">
              {supportingText}
            </p>
            <div className="feature-cta-row feature-reveal-item">
              <Button
                to={ctaLink}
                variant="outline"
                size="md"
                className="feature-outline-btn"
                id="btn-immersive-feature-cta"
              >
                {ctaText}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
