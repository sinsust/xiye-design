// Delivered by Originkit · stack: nextjs · styling: tailwind
"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";

/**
 * The fan of payment cards — Figma `Group 2147241479` (desktop 499:1978,
 * tablet 499:1522, phone 499:1944).
 *
 * **The rotation is in the texture, not in CSS.** Figma turns each card 87–107°
 * and the obvious move is a `rotate()` on the host, but StickerDrag drags by
 * writing screen-space pointer deltas into its own `left`/`top`. Under a
 * rotated ancestor those axes turn with it and a card dragged sideways travels
 * diagonally. So each `card-N.webp` is exported pre-rotated to its bounding
 * box and every element here stays axis-aligned — which also means the tilt on
 * pickup leans toward the direction of the drag rather than toward some rotated
 * frame of the card's own.
 *
 * **The cluster is measured in its own box, not in the frame.** Figma's group
 * bounding box does not match the union of the rotated cards — the HTML port
 * this came from had to hand-shift the phone cluster 102px to get it back under
 * the headline. So the box here is that true union at each frame (298 x 181 on
 * the phone, 448 x 272 on the tablet, 584 x 399 on desktop) and every card is
 * placed as a percentage of it. One measured width then drives the card sizes,
 * so the fan holds together at any width between the frames instead of only at
 * 402 / 744 / 1440.
 *
 * **Two arrangements, not three.** Divided by their own box the phone and
 * tablet placements come out identical to four decimal places — the tablet is
 * the phone at 1.5x — so they share one set of percentages and desktop has its
 * own. The one card that genuinely moves between them is `card-3`, the most
 * rotated of the four: desktop fans it out to 38% across, the smaller frames
 * tuck it back to 49% against `card-2`.
 *
 * The cluster is centred rather than carrying Figma's 1.4% leftward bias, which
 * both small frames share and which is an artifact of the same mismatched group
 * box — 7px on the phone, on a hand-scattered pile.
 *
 * **The fan is anchored to the copy's rule, not to the right margin.** This box
 * and the copy column are two independent containers, and the cards inside this
 * one are free to hang over its edges — which is the whole point, because Figma
 * starts the fan 16px *left* of the rule the copy column trails, so the leftmost
 * card straddles it. Left flush to the right margin that 16 only holds at 1440:
 * the margins are shares and the fan is a share, but the copy column is a fixed
 * 387, so every pixel of extra width lands in the gap between them and the fan
 * walks off to the right — 107px clear of the rule at 1920, 431 at 3174.
 *
 * `mr` closes that gap by exactly the amount it opens: `25.758%` is the fan's
 * left edge measured from the rule's own 8.333% and the 387 column, and 371 is
 * what that comes to at the 1440 frame, so the shift is zero there and grows
 * with the sheet. It is a margin rather than an offset because the fan is still
 * in flow — the clear band takes its height from this box, and a fan pulled out
 * of flow would let the band collapse to its 410 floor and drop the cards
 * through the dashed grid below. `max(0px, …)` stops it going the other way
 * under 1440, where the fan already overhangs the rule further and pushing it
 * right would cost the right margin instead.
 *
 * **The fan is dealt in and dealt back out.** Figma draws the cards at rest, but
 * the pile is the section's one moment, so each card rises into place as the
 * cluster enters the viewport and lowers back out when it leaves — the same
 * curve run in reverse, not a one-way reveal. See `entrance` below.
 */

/**
 * `aspect` is the card's rotated bounding box, which is also the file's own
 * pixel ratio, so nothing is stretched. `native` is that box at the desktop
 * frame — the one number the drag shadow scales against.
 *
 * Class strings are written out rather than composed, because Tailwind reads
 * this file as text and would not see an interpolated percentage.
 */
const CARDS = [
  {
    id: "card-1",
    native: 192.61,
    className:
      "aspect-[192.61/289.88] w-[32.278%] left-[83.854%] top-[40.023%] desktop-sm:w-[32.955%] desktop-sm:left-[83.524%] desktop-sm:top-[43.417%]",
  },
  {
    id: "card-2",
    native: 186.3,
    className:
      "aspect-[186.30/285.98] w-[31.222%] left-[60.141%] top-[59.807%] desktop-sm:w-[31.878%] desktop-sm:left-[61.415%] desktop-sm:top-[63.466%]",
  },
  {
    id: "card-3",
    native: 254.92,
    className:
      "aspect-[254.92/322.45] w-[42.722%] left-[49.488%] top-[49.113%] desktop-sm:w-[43.618%] desktop-sm:left-[37.683%] desktop-sm:top-[40.456%]",
  },
  {
    id: "card-4",
    native: 196.08,
    className:
      "aspect-[196.08/291.98] w-[32.860%] left-[16.437%] top-[59.686%] desktop-sm:w-[33.549%] desktop-sm:left-[16.775%] desktop-sm:top-[63.367%]",
  },
] as const;

/**
 * Ease-in-out cubic. The house standard elsewhere in this repo is `EASE_OUT`,
 * which is deliberately asymmetric — right for something that arrives once and
 * stays. This entrance runs in both directions, so it wants a curve that reads
 * the same played forwards and backwards; anything ease-*out* would leave the
 * cards snapping away from rest on the exit.
 */
const EASE_IN_OUT = [0.645, 0.045, 0.355, 1] as const;

/**
 * The entrance, and the exit — the same transition in both directions, which is
 * what `whileInView` without `once` gives: the cards animate to rest when the
 * cluster enters the viewport and back to `initial` when it leaves.
 *
 * The stagger runs in DOM order, which is Figma's stacking order and, because
 * the fan is dealt right to left (83.5% → 16.8%), also right to left on screen.
 * So the card that lands last is the one lying on top of the pile.
 *
 * `y` and `opacity` only. The host carries the fan's placement as `left`/`top`
 * percentages and StickerDrag drags by writing screen-space deltas into its own
 * offsets, so anything here that resolved to a scale or a rotate would turn
 * those axes under it — the same reason the card art is exported pre-rotated.
 */
const entrance = (index: number, reduceMotion: boolean | null) =>
  reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { amount: 0.3 },
        transition: {
          type: "tween" as const,
          duration: 0.5,
          ease: EASE_IN_OUT,
          delay: index * 0.08,
        },
      };

type StickerCardProps = {
  id: string;
  native: number;
  className: string;
  index: number;
};

/** 4 张支付卡片的渐变占位配色，按 index 区分，视觉接近真实卡片。 */
const CARD_GRADIENTS: CSSProperties[] = [
  {
    background:
      "linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 42%, #CBD5E1 100%)",
    boxShadow:
      "0 1px 2px rgba(15,23,42,0.10), 0 6px 16px rgba(15,23,42,0.12)",
  },
  {
    background: "linear-gradient(135deg, #0F172A 0%, #1E293B 55%, #334155 100%)",
    boxShadow:
      "0 1px 2px rgba(15,23,42,0.18), 0 6px 16px rgba(15,23,42,0.25)",
  },
  {
    background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 50%, #C7D2FE 100%)",
    boxShadow:
      "0 1px 2px rgba(15,23,42,0.10), 0 6px 16px rgba(15,23,42,0.14)",
  },
  {
    background: "linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 50%, #FBCFE8 100%)",
    boxShadow:
      "0 1px 2px rgba(15,23,42,0.08), 0 6px 16px rgba(15,23,42,0.10)",
  },
];

/** 4 张卡各用一个固定 seed 的免费占位图，保证每次加载同一张。 */
const CARD_PHOTOS = ["card1", "card2", "card3", "card4"];

const gradientCardStyle = (index: number): CSSProperties => {
  const base = CARD_GRADIENTS[index % CARD_GRADIENTS.length] ?? CARD_GRADIENTS[0];
  const photo = CARD_PHOTOS[index % CARD_PHOTOS.length];
  return {
    ...base,
    // 图片优先，渐变垫底——图加载失败时仍显示渐变底色，不会空白。
    backgroundImage: `url("https://picsum.photos/seed/${encodeURIComponent(photo)}/400/600")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.6)",
  };
};

/**
 * StickerDrag wants its box in pixels while the fan is a set of percentages, so
 * the host reserves the card with `aspect-*`, measures itself, and mounts only
 * then. Both dimensions are rounded before they cross into the component: it
 * sizes its backing store from them at 2x device pixels, and a fractional width
 * can land that on an odd pixel count.
 */
const StickerCard = ({ id, native, className, index }: StickerCardProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const reduceMotion = useReducedMotion();

  // 拖拽：按住卡拖动，松手回弹。用 ref 直接写 transform，避免 re-render 卡顿。
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0, z: 100 });

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    dragRef.current.active = true;
    dragRef.current.sx = e.clientX;
    dragRef.current.sy = e.clientY;
    dragRef.current.ox = 0;
    dragRef.current.oy = 0;
    dragRef.current.z += 1;
    el.style.zIndex = `${dragRef.current.z}`;
    el.style.transition = "none";
    el.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const el = cardRef.current;
    if (!d.active || !el) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    el.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx * 0.05}deg)`;
  };

  const endDrag = () => {
    const d = dragRef.current;
    const el = cardRef.current;
    if (!d.active || !el) return;
    d.active = false;
    el.style.transition = "transform 0.35s ease";
    el.style.transform = "";
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const measure = ({ width, height }: { width: number; height: number }) =>
      setBox({ width: Math.round(width), height: Math.round(height) });

    measure(host.getBoundingClientRect());
    const observer = new ResizeObserver(([entry]) =>
      measure(entry.contentRect),
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    /*
      The entrance rides on `transform` while the host's own centring rides on
      Tailwind's `translate` property. They are two separate CSS properties and
      compose in that order, so the reveal can animate without ever restating
      the `-50%/-50%` the placement depends on.
    */
    <motion.div
      ref={hostRef}
      className={`absolute -translate-x-1/2 -translate-y-1/2 ${className}`}
      {...entrance(index, reduceMotion)}
    >
      {box.width > 0 && (
        <div
          ref={cardRef}
          className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
          style={{
            ...gradientCardStyle(index),
            margin: 0,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      )}
    </motion.div>
  );
};

export const CardCluster = () => (
  <div
    role="img"
    aria-label="A fan of four payment cards, loosely stacked"
    className="relative w-[298px] max-w-full shrink-0 aspect-[297.99/180.85] ipad:w-[448px] desktop-sm:mr-[max(0px,calc(25.758%-371px))] desktop-sm:aspect-[584.45/398.52] desktop-sm:w-[52.117%]"
  >
    {/*
      No `z-*` on the hosts. StickerDrag lifts the card being dragged by writing
      an incrementing z-index onto its own container; a z-index here would make
      the host a stacking context and trap that value inside. Left at `auto`
      they order by DOM position — Figma's own stacking, card 4 on top — and on
      pickup the dragged card clears the rest.
    */}
    {CARDS.map((card, index) => (
      <StickerCard key={card.id} {...card} index={index} />
    ))}
  </div>
);
