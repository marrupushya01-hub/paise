"use client";

import { FEATURE } from "@/data/mock";

// Editorial slot at the bottom of Home / first-run. The hatched fill is the
// design's photo placeholder — swap for a real <img> when art lands.
export default function Feature({ short = false }) {
  return (
    <section className={`feature${short ? " feature--short" : ""}`}>
      <span className="feature__tag">{short ? FEATURE.tagShort : FEATURE.tag}</span>
      <h2 className="feature__title">{FEATURE.title}</h2>
      <p className="feature__sub">{FEATURE.sub}</p>
    </section>
  );
}
