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

// A sign face in the grimoire style (like the HUD's leaf panels): dark stone, a gold double rule with corner
// brackets, the title in Georgia capitals, the subtitle in gold italic. Fills the whole canvas.
export function drawGrimoirePlaque(ctx, title, subtitle = '') {
  const { width: w, height: h } = ctx.canvas, u = h / 256;
  const ground = ctx.createLinearGradient(0, 0, 0, h); ground.addColorStop(0, '#26302a'); ground.addColorStop(1, '#171e1a');
  ctx.fillStyle = ground; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 4 * u; ctx.strokeRect(10 * u, 10 * u, w - 20 * u, h - 20 * u);
  ctx.strokeStyle = 'rgba(201,162,74,.45)'; ctx.lineWidth = 2 * u; ctx.strokeRect(22 * u, 22 * u, w - 44 * u, h - 44 * u);
  ctx.fillStyle = '#c9a24a'; // corner brackets
  for (const [x, y, sx, sy] of [[10, 10, 1, 1], [w / u - 10, 10, -1, 1], [10, 246, 1, -1], [w / u - 10, 246, -1, -1]])
    { ctx.fillRect(x * u, y * u, 34 * u * sx, 7 * u * sy); ctx.fillRect(x * u, y * u, 7 * u * sx, 34 * u * sy); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#efe6cc';
  ctx.font = `${(subtitle ? 58 : 66) * u | 0}px Georgia, serif`;
  fitText(ctx, title.toUpperCase(), w / 2, (subtitle ? 112 : 150) * u, w - 90 * u);
  if (!subtitle) return;
  ctx.fillStyle = '#c9a24a'; ctx.fillRect(w / 2 - 70 * u, 134 * u, 140 * u, 2 * u);
  ctx.fillStyle = '#d8c48f'; ctx.font = `italic ${36 * u | 0}px Georgia, serif`;
  fitText(ctx, subtitle, w / 2, 190 * u, w - 90 * u);
}
