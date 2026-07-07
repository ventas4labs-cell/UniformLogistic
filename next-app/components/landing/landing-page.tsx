'use client';

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LandingNav } from './landing-nav';
import { LandingHero } from './landing-hero';
import { LandingStrip } from './landing-strip';
import { LandingAdvantage } from './landing-advantage';
import { LandingIndustries } from './landing-industries';
import { LandingCta } from './landing-cta';
import { LandingFooter } from './landing-footer';

gsap.registerPlugin(ScrollTrigger);

// ─── Landing orchestrator ────────────────────────────────────────────
// One client boundary for the whole landing page. All GSAP wiring lives
// here, driven by data-attributes the section components expose:
//
//   .hero-line         hero headline lines — "sunrise" masked rise
//   [data-sun]         hero glow — scales/brightens in behind the type
//   [data-hero-fade]   hero secondary content — fades up after the type
//   [data-reveal]      fade-up on scroll (single element)
//   [data-reveal-group] stagger-reveals its [data-reveal-item] children
//   [data-parallax]    background drift, value = speed (e.g. "0.2")
//   [data-float]       perpetual gentle float (portal mockups)
//   [data-stitch]      vertical dashed rule that "sews" itself on scroll
//
// Everything is wrapped in gsap.matchMedia so prefers-reduced-motion
// users get a static page — content is server-rendered visible and only
// hidden by the tweens themselves.
export function LandingPage({
    appHref,
    isAuthed = false
}: {
    appHref: string | null;
    isAuthed?: boolean;
}) {
    const root = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const mm = gsap.matchMedia(root);

        mm.add('(prefers-reduced-motion: no-preference)', () => {
            // ── Hero entrance ───────────────────────────────────────
            const intro = gsap.timeline({ defaults: { ease: 'power4.out' } });
            intro
                .from('[data-sun]', {
                    autoAlpha: 0,
                    scale: 0.55,
                    yPercent: 30,
                    duration: 2.2,
                    ease: 'power2.out'
                })
                .from(
                    '.hero-line',
                    {
                        yPercent: 112,
                        skewY: 4,
                        duration: 1.25,
                        stagger: 0.14
                    },
                    0.15
                )
                .from(
                    '[data-hero-fade]',
                    {
                        autoAlpha: 0,
                        y: 28,
                        duration: 0.9,
                        stagger: 0.1,
                        ease: 'power3.out'
                    },
                    0.85
                );

            // ── Scroll reveals ──────────────────────────────────────
            gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
                gsap.from(el, {
                    autoAlpha: 0,
                    y: 36,
                    duration: 1,
                    ease: 'power3.out',
                    scrollTrigger: { trigger: el, start: 'top 86%' }
                });
            });

            gsap.utils
                .toArray<HTMLElement>('[data-reveal-group]')
                .forEach((group) => {
                    gsap.from(group.querySelectorAll('[data-reveal-item]'), {
                        autoAlpha: 0,
                        y: 44,
                        duration: 0.9,
                        ease: 'power3.out',
                        stagger: 0.12,
                        scrollTrigger: { trigger: group, start: 'top 82%' }
                    });
                });

            // ── Parallax drift ──────────────────────────────────────
            gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
                const speed = parseFloat(el.dataset.parallax || '0.2');
                gsap.to(el, {
                    yPercent: -100 * speed,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: el.parentElement || el,
                        start: 'top bottom',
                        end: 'bottom top',
                        scrub: true
                    }
                });
            });

            // ── Floating mockups ────────────────────────────────────
            gsap.utils.toArray<HTMLElement>('[data-float]').forEach((el, i) => {
                gsap.to(el, {
                    y: i % 2 === 0 ? -12 : -8,
                    rotation: i % 2 === 0 ? -0.6 : 0.5,
                    duration: 3.2 + i * 0.7,
                    ease: 'sine.inOut',
                    yoyo: true,
                    repeat: -1
                });
            });

            // ── Stitch rules sew themselves in ──────────────────────
            gsap.utils.toArray<HTMLElement>('[data-stitch]').forEach((el) => {
                gsap.from(el, {
                    scaleY: 0,
                    transformOrigin: 'top center',
                    ease: 'none',
                    scrollTrigger: {
                        trigger: el,
                        start: 'top 85%',
                        end: 'bottom 45%',
                        scrub: 0.6
                    }
                });
            });
        });

        // Reduced motion: background videos hold their poster frame.
        mm.add('(prefers-reduced-motion: reduce)', () => {
            root.current
                ?.querySelectorAll<HTMLVideoElement>('video')
                .forEach((v) => {
                    v.pause();
                    v.removeAttribute('autoplay');
                });
        });

        return () => mm.revert();
    }, []);

    return (
        <div
            ref={root}
            className="min-h-screen bg-[#F7F4EE] text-[#16130F] antialiased selection:bg-[#EA580C] selection:text-[#F7F4EE]"
        >
            <LandingNav appHref={appHref} isAuthed={isAuthed} />
            <main>
                <LandingHero appHref={appHref} />
                <LandingStrip />
                <LandingAdvantage />
                <LandingIndustries />
                <LandingCta appHref={appHref} />
            </main>
            <LandingFooter />
        </div>
    );
}
