export interface TranscriptFormatOptions {
  stripUnderscore?: boolean;
  stripBlankSymbol?: boolean;
  trimWhitespace?: boolean;
}

export function formatTranscript(text: string, options: TranscriptFormatOptions = {}): string {
  const { stripUnderscore = false, stripBlankSymbol = false, trimWhitespace = false } = options;
  let processed = text;

  if (stripUnderscore) {
    processed = processed.replace(/_/g, ' ');
  }

  if (stripBlankSymbol) {
    processed = processed.replace(/▁/g, '');
  }

  if (trimWhitespace) {
    processed = processed.trim();
  }

  return processed;
}

export function formatNumber(value: number, locale: string = 'ko-KR'): string {
  return new Intl.NumberFormat(locale).format(value);
}
