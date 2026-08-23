// Delivered by Originkit · stack: nextjs · styling: tailwind
"use client";

/**
 * Figma draws one chevron (`Bold / Arrows / Alt Arrow Right`) in all three
 * buttons and tints it per surface — #121212 on the light pills, white on the
 * dark CTA. Two SVG files for one path would be the wrong trade, so it is a
 * component painted with `currentColor` and the button's own text colour
 * carries it. Every other icon in this section is a public asset, as usual.
 */
export const ChevronRight = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 22 22"
    fill="none"
    aria-hidden
    focusable="false"
    className="block shrink-0"
  >
    <path
      d="M8.16385 16.4621C7.75528 16.0535 7.75528 15.3903 8.16385 14.9802L11.6147 11.5309L8.16385 8.08005C7.76785 7.66991 7.77256 7.01619 8.17799 6.61234C8.58185 6.20691 9.23556 6.20219 9.64571 6.59819L13.8367 10.7892C14.2453 11.1993 14.2453 11.8625 13.8367 12.2711L9.64571 16.4621C9.23714 16.8706 8.57399 16.8706 8.16385 16.4621Z"
      fill="currentColor"
    />
  </svg>
);
