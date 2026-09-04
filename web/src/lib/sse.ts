/** Decode SSE records across UTF-8 chunks, including an unterminated final record. */
export async function* readSSEData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];
  let finished = false;

  const consumeLine = (line: string): string | undefined => {
    if (line === "") {
      if (!data.length) return;
      const record = data.join("\n");
      data = [];
      return record;
    }
    if (line === "data") data.push("");
    else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  };

  try {
    while (!finished) {
      const { done, value } = await reader.read();
      finished = done;
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      for (;;) {
        const newline = /\r\n|[\r\n]/.exec(buffer);
        if (!newline) break;
        // A CR at a chunk boundary may still be followed by LF.
        if (!done && newline[0] === "\r" && newline.index === buffer.length - 1) break;
        const record = consumeLine(buffer.slice(0, newline.index));
        buffer = buffer.slice(newline.index + newline[0].length);
        if (record !== undefined) yield record;
      }
    }
    if (buffer) consumeLine(buffer);
    if (data.length) yield data.join("\n");
  } finally {
    // Breaking on [DONE] or a protocol error must close the underlying request.
    try {
      if (!finished) await reader.cancel();
    } catch {
      // An aborted fetch may already have errored its body.
    } finally {
      reader.releaseLock();
    }
  }
}
