/** Report intrinsic content size, never the host-controlled iframe viewport. */
export function observeWidgetSize(root: HTMLElement, notify: (width: number, height: number) => void): () => void {
  let lastWidth = 0;
  let lastHeight = 0;
  const measure = (): void => {
    const bounds = root.getBoundingClientRect();
    const width = Math.ceil(bounds.width);
    const height = Math.ceil(bounds.height);
    if (width <= 0 || height <= 0 || (width === lastWidth && height === lastHeight)) return;
    lastWidth = width;
    lastHeight = height;
    notify(width, height);
  };
  measure();
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
  observer?.observe(root);
  return () => observer?.disconnect();
}
