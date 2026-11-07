// Fetch the model and its small animation files together, then parse one FBX
// per frame. The old model-first chain delayed every animation download.
export async function loadCharacterAssets({ files, fetchBuffer, parse, nextFrame, installModel, installClip, onClipError }) {
  const entries = Object.entries(files);
  const pending = entries.map(async ([name, file]) => {
    try { return { name, file, buffer: await fetchBuffer(file) }; }
    catch (error) { return { name, file, error }; }
  });
  const model = await pending[0];
  if (model.error) throw model.error;
  await nextFrame();
  installModel(parse(model.buffer));
  for (let i = 1; i < entries.length; i++) {
    const result = await pending[i];
    if (result.error) { onClipError(result.file, result.error); continue; }
    await nextFrame();
    try { installClip(result.name, parse(result.buffer)); }
    catch (error) { onClipError(result.file, error); }
  }
}
