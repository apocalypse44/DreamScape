// Sign text that always fits its board: shrink the font (down to 60%) until the line fits maxWidth,
// then let fillText condense whatever is left. The context's font is restored afterwards.
export function fitText(ctx, text, x, y, maxWidth) {
  const font = ctx.font;
  const match = font.match(/(\d+(?:\.\d+)?)px/);
  if (match) {
    const start = Number(match[1]);
    let size = start;
    while (ctx.measureText(text).width > maxWidth && size > start * 0.6) {
      size -= 1;
      ctx.font = font.replace(match[0], `${size}px`);
    }
  }
  ctx.fillText(text, x, y, maxWidth);
  ctx.font = font;
}
