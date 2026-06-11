// Full-bleed background video for a landing section. Decorative only:
// muted, looping, inline, poster for instant paint, aria-hidden. The
// orchestrator pauses every <video> for prefers-reduced-motion users.
// Veil/overlay live in the parent so each section controls its own wash.
export function SectionVideo({
    src,
    poster,
    className = ''
}: {
    src: string;
    poster: string;
    className?: string;
}) {
    return (
        <video
            aria-hidden
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={poster}
            className={`pointer-events-none absolute inset-0 h-full w-full object-cover ${className}`}
        >
            <source src={src} type="video/mp4" />
        </video>
    );
}
