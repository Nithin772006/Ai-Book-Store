import React, { useRef, useState, useEffect } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import Button from './Button';
import defaultPoster from '../assets/hero-poster.jpg';

// Register GSAP plugins
gsap.registerPlugin(useGSAP);

/**
 * CINEMATIC BOOKSTORE HERO VIDEO CONFIGURATION
 * 
 * Video source path:
 * Default is the Google Flow cinematic bookstore video in the public assets directory:
 *   `/videos/ex-libris-hero.mp4`
 * (Alternate preserved source: `/videos/Levitating_book_opens_on_desk_20261010194331.mp4`)
 * 
 * Poster fallback:
 * Extracted from the video's first frame, matching the opening composition:
 *   `../assets/hero-poster.jpg` (or `/videos/ex-libris-hero-poster.jpg`)
 */
export const DEFAULT_HERO_VIDEO_SRC = '/videos/ex-libris-hero.mp4';
export const DEFAULT_HERO_POSTER_SRC = defaultPoster;

export default function HeroSection({
  videoSrc = DEFAULT_HERO_VIDEO_SRC,
  posterSrc = DEFAULT_HERO_POSTER_SRC,
  eyebrow = 'A CURATED WORLD OF IDEAS',
  headline = 'Read something\nunexpected.',
  supportingText = 'Discover remarkable books, enduring ideas, and new perspectives for a more curious life.',
  primaryCtaText = 'EXPLORE THE COLLECTION',
  primaryCtaLink = '/books',
  secondaryCtaText = 'CURATED SELECTIONS',
  secondaryCtaLink = '/books?featured=true',
}) {
  const heroRef = useRef(null);
  const contentRef = useRef(null);
  const videoRef = useRef(null);

  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  // Monitor user preference for reduced motion
  useEffect(() => {
    if (!window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleMotionChange = (e) => {
      setReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleMotionChange);
    return () => mediaQuery.removeEventListener('change', handleMotionChange);
  }, []);

  // Safe muted autoplay handling without repeated renders
  useEffect(() => {
    if (!videoRef.current || reducedMotion || videoFailed || !videoSrc) return;

    const playPromise = videoRef.current.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Autoplay may be restricted in low-power modes; poster remains active
        console.warn('Hero video autoplay muted notice:', err.message);
      });
    }
  }, [reducedMotion, videoFailed, videoSrc]);

  // GSAP Entrance Animation Sequence for HTML Content
  useGSAP(() => {
    if (reducedMotion) return;

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.from('.hero-eyebrow-tag', {
      opacity: 0,
      y: -14,
      duration: 0.8,
      delay: 0.15,
    })
      .from('.headline-line-block', {
        opacity: 0,
        y: 26,
        stagger: 0.16,
        duration: 1.0,
      }, '-=0.5')
      .from('.hero-support-copy', {
        opacity: 0,
        y: 18,
        duration: 0.85,
      }, '-=0.6')
      .from('.hero-cta-group', {
        opacity: 0,
        y: 14,
        duration: 0.75,
      }, '-=0.55');
  }, { scope: heroRef, dependencies: [reducedMotion] });

  const handleCanPlay = () => {
    setVideoLoaded(true);
  };

  const handleVideoError = (e) => {
    console.warn('Hero background video encountered an issue, preserving static poster fallback:', e);
    setVideoFailed(true);
  };

  const handleSecondaryClick = (e) => {
    const el = document.getElementById('curated-selections');
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section ref={heroRef} className="cinematic-hero-section" aria-label="Bookstore Introduction">
      {/* Background Media Container */}
      <div className="hero-media-wrapper">
        {/* Baseline Poster Fallback: Visible immediately to prevent black/blank flash */}
        <img
          src={posterSrc}
          alt=""
          aria-hidden="true"
          className={`hero-poster-fallback ${videoLoaded && !reducedMotion ? 'poster-faded' : 'poster-visible'}`}
        />

        {/* Cinematic Google Flow Background Video */}
        {videoSrc && !reducedMotion && !videoFailed && (
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            poster={posterSrc}
            className={`hero-media-element ${videoLoaded ? 'is-playing' : 'is-loading'}`}
            onCanPlay={handleCanPlay}
            onError={handleVideoError}
            aria-hidden="true"
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        )}

        {/* Cinematic Asymmetric Overlay Vignette */}
        <div className="hero-cinematic-overlay" aria-hidden="true" />
      </div>

      {/* Hero Editorial Content Container */}
      <div className="store-container hero-text-container" ref={contentRef}>
        <div className="hero-copy-column">
          <div className="hero-eyebrow-tag">
            <span className="eyebrow-line" aria-hidden="true" />
            <span className="eyebrow-text">{eyebrow}</span>
          </div>

          <h1 className="hero-headline-serif">
            {headline.split('\n').map((line, idx) => (
              <span key={idx} className="headline-line-block">
                {idx === 1 ? (
                  <span className="headline-word-accent">{line}</span>
                ) : (
                  line
                )}
              </span>
            ))}
          </h1>

          <p className="hero-support-copy">
            {supportingText}
          </p>

          <div className="hero-cta-group">
            <Button
              to={primaryCtaLink}
              variant="burgundy"
              size="lg"
              magnetic={true}
              className="hero-primary-btn"
              id="hero-explore-btn"
            >
              {primaryCtaText}
            </Button>

            {secondaryCtaText && (
              <Button
                to={secondaryCtaLink}
                onClick={handleSecondaryClick}
                variant="outline"
                size="lg"
                className="hero-secondary-btn"
                id="hero-featured-btn"
              >
                {secondaryCtaText}
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
