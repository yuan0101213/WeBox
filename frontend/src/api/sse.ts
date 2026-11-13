/** Decode SSE lines incrementally, including split CRLF and multi-line data. */
export function createSseParser(onEvent: (event: string, data: string) => void) {
  let pending = '', event = '', data: string[] = [];
  function line(value: string) {
    if (value === '') {
      if (data.length) onEvent(event || 'message', data.join('\n'));
      event = ''; data = [];
      return;
    }
    if (value.startsWith(':')) return;
    const colon = value.indexOf(':');
    const field = colon < 0 ? value : value.slice(0, colon);
    let valueText = colon < 0 ? '' : value.slice(colon + 1);
    if (valueText.startsWith(' ')) valueText = valueText.slice(1);
    if (field === 'event') event = valueText;
    if (field === 'data') data.push(valueText);
  }
  return {
    push(chunk: string) {
      pending += chunk;
      let start = 0;
      for (let i = 0; i < pending.length; i++) {
        if (pending[i] !== '\r' && pending[i] !== '\n') continue;
        if (pending[i] === '\r' && i === pending.length - 1) break;
        line(pending.slice(start, i));
        if (pending[i] === '\r' && pending[i + 1] === '\n') i++;
        start = i + 1;
      }
      pending = pending.slice(start);
    },
    finish() {
      if (pending.endsWith('\r')) line(pending.slice(0, -1));
      // An event without its terminating blank line is incomplete per SSE.
      pending = ''; event = ''; data = [];
    },
  };
}
