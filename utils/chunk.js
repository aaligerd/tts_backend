// Simple chunker to avoid TTS size limits (tune chunk size)
function chunkText(text, maxChars = 3000) {
  if (text.length <= maxChars) return [text];
  const sentences = text.match(/[^\.!\?]+[\.!\?]+("|'|)?\s*/g) || [text];
  const chunks = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > maxChars) {
      if (cur) chunks.push(cur);
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

export {chunkText};