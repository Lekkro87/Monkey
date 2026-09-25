/** Hand-drawn 24px line icons (stroke = currentColor). */
const PATHS: Record<string, string> = {
  gavel: 'M14 3l7 7M11 6l7 7M9.5 7.5l7 7-3 3-7-7zM3 21l7.5-7.5',
  dollar: 'M12 2v20M17 6.5c0-1.9-2.2-3-5-3s-5 1.2-5 3.3S9 10 12 10.6s5 1.6 5 3.8-2.2 3.6-5 3.6-5-1.2-5-3.2',
  van: 'M2 7h11v9H2zM13 10h4.5l3.5 3.5V16h-8zM6 19.5a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zM17 19.5a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z',
  box: 'M3 7.5l9-4.5 9 4.5v9l-9 4.5-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9',
  wrench: 'M14.5 6.5a4.5 4.5 0 00-5.8 5.8L3 18l3 3 5.7-5.7a4.5 4.5 0 005.8-5.8l-2.8 2.8-2.9-.3-.3-2.9z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  search: 'M10.5 17a6.5 6.5 0 100-13 6.5 6.5 0 000 13zM15.5 15.5L21 21',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  trophy: 'M8 3h8v5a4 4 0 01-8 0zM8 5H4v1a4 4 0 004 4M16 5h4v1a4 4 0 01-4 4M12 12v5M8 21h8M9.5 17h5',
  chart: 'M3 3v18h18M7 15l4-4 3 3 6-7',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 13a7.6 7.6 0 000-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 00-1.7-1L15 3h-4l-.4 2.6a7.4 7.4 0 00-1.7 1l-2.4-1-2 3.4L6.6 11a7.6 7.6 0 000 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 001.7 1L11 21h4l.4-2.6a7.4 7.4 0 001.7-1l2.4 1 2-3.4z',
  lock: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 017 0V11',
  alert: 'M12 3L2 20h20zM12 9v5M12 17.2v.1',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  eye: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  hand: 'M8 13V5.5a1.5 1.5 0 013 0V11M11 11V4a1.5 1.5 0 013 0v7M14 11V5.5a1.5 1.5 0 013 0V13M17 8.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-2a6 6 0 01-5-2.7L4.3 14a1.5 1.5 0 012.5-1.6L8 14',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M4 12.5l5 5L20 6.5',
  right: 'M5 12h14M13 6l6 6-6 6',
  left: 'M19 12H5M11 6l-6 6 6 6',
  garage: 'M3 21V9l9-6 9 6v12M7 21v-8h10v8M7 16h10',
  store: 'M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0 2.7 2.7 0 005.3 0M10 20v-5h4v5',
  flame: 'M12 21a7 7 0 01-7-7c0-3.5 2.5-5.5 3.5-8.5 1.5 2 2 3 2 5 1.5-1 2.5-3 2.5-6.5C16 6.5 19 10 19 14a7 7 0 01-7 7z',
  up: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  down: 'M3 7l6 6 4-4 8 8M15 17h6v-6',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  tag: 'M3 3h8l10 10-8 8L3 11zM7.5 7.5v.1',
  bell: 'M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0',
  pin: 'M12 21s-7-6.5-7-12a7 7 0 0114 0c0 5.5-7 12-7 12zM12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  volume: 'M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12',
  mute: 'M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6',
  play: 'M7 4l13 8-13 8z',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v6M12 7.5v.1',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  flashlight: 'M9 2h6v4l-2 4v11h-2V10L9 6zM9 6h6',
  door: 'M4 21V4h16v17M4 8h16M4 12h16M4 16h16M2 21h20',
  key: 'M14.5 10a4.5 4.5 0 10-4.3 4.5L8 17v2h-2v2H3v-3l6.5-6.5M16.5 7.5v.1',
  book: 'M4 4h6a3 3 0 013 3v14a2.5 2.5 0 00-2.5-2.5H4zM20 4h-6a3 3 0 00-3 3v14a2.5 2.5 0 012.5-2.5H20z',
  scale: 'M12 3v18M5 7h14M5 7l-3 7a3.5 3.5 0 006 0zM19 7l-3 7a3.5 3.5 0 006 0zM8 21h8',
  cam: 'M4 7h3l2-3h6l2 3h3v13H4zM12 17a4 4 0 100-8 4 4 0 000 8z',
  swap: 'M4 8h14l-4-4M20 16H6l4 4',
  home: 'M3 11l9-8 9 8v10h-6v-6H9v6H3z',
  cash: 'M2 6h20v12H2zM12 15a3 3 0 100-6 3 3 0 000 6zM5.5 9v.1M18.5 15v.1',
  phone: 'M7 2h10v20H7zM11 18h2',
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',
  skip: 'M5 5l10 7-10 7zM19 5v14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
  dots: 'M5 12h.1M12 12h.1M19 12h.1',
  hammer: 'M13 7l-8.5 8.5a2.1 2.1 0 003 3L16 10M12 4l8 8 2-2-8-8z',
  question: 'M9.5 9a2.5 2.5 0 115 .5c0 1.5-2.5 2-2.5 3.5M12 17v.1M12 21a9 9 0 100-18 9 9 0 000 18z',
};

export function icon(name: string, size = 18, cls = ''): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `ico ${cls}`.trim());
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', PATHS[name] ?? PATHS.question);
  svg.appendChild(path);
  return svg;
}
