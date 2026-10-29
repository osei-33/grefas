/**
 * Corporate Official Letter Formatter Utility
 * Handles rich text markdown formatting (bold, italic, underline, lists, tables, clauses)
 * for official letters across print previews, PDFs, email dispatch, and public verification.
 */

export function formatInlineMarkdown(text: string): string {
  if (!text) return '';
  return text
    // Bold: **text** or <b>text</b>
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/<b>(.*?)<\/b>/gi, '<strong>$1</strong>')
    // Italic: *text* or _text_ or <i>text</i>
    .replace(/\*([^\*]+?)\*/g, '<em>$1</em>')
    .replace(/_([^_]+?)_/g, '<em>$1</em>')
    .replace(/<i>(.*?)<\/i>/gi, '<em>$1</em>')
    // Underline: __text__ or <u>text</u>
    .replace(/__(.+?)__/g, '<span style="text-decoration: underline; text-underline-offset: 2px;">$1</span>')
    .replace(/<u>(.*?)<\/u>/gi, '<span style="text-decoration: underline; text-underline-offset: 2px;">$1</span>')
    // Strikethrough: ~~text~~ or <s>text</s>
    .replace(/~~(.+?)~~/g, '<del style="color: #6b7280;">$1</del>')
    .replace(/<s>(.*?)<\/s>/gi, '<del style="color: #6b7280;">$1</del>')
    // Currency highlights: GH₵ 1,234.50 or GHS
    .replace(/\b(GH[₵S]\s*[\d,]+(?:\.\d{2})?)/g, '<strong style="font-family: Arial, sans-serif; color: #111827;">$1</strong>')
    // Reference highlights: (Ref: ...) or Our Ref: ...
    .replace(/\b((?:Our Ref|Ref):\s*[A-Z0-9\/\-]+)/gi, '<span style="font-family: monospace; font-weight: bold; color: #c2410c;">$1</span>')
    // Inline code: `text`
    .replace(/`([^`]+)`/g, '<code style="background-color: #f3f4f6; padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 88%; color: #c2410c;">$1</code>');
}

export function formatLetterBodyHtml(rawBody: string): string {
  if (!rawBody || !rawBody.trim()) {
    return '<p class="body-p" style="text-indent: 30px; margin: 0 0 14px 0; line-height: 1.65; color: #9ca3af; font-style: italic;">No body paragraphs drafted yet.</p>';
  }

  // Normalize line endings and split into paragraphs/blocks by blank lines
  const normalized = rawBody.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);

  return blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';

    // 1. Horizontal Divider Rule: --- or ***
    if (/^[-*_]{3,}$/.test(trimmed)) {
      return '<hr class="letter-divider" style="border: none; border-top: 1px solid #d1d5db; margin: 18px 0;" />';
    }

    // 2. Section Headings: ### 1.0 TITLE or ## TITLE or # TITLE
    if (/^#{1,4}\s+(.+)$/.test(trimmed)) {
      const match = trimmed.match(/^#{1,4}\s+(.+)$/);
      const headingText = match ? match[1] : trimmed;
      return `<h3 class="clause-heading" style="font-family: Arial, sans-serif; font-size: 10.5pt; font-weight: 800; color: #111827; margin: 18px 0 6px 0; text-transform: uppercase; letter-spacing: 0.6px; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px;">${formatInlineMarkdown(headingText)}</h3>`;
    }

    // 3. Blockquotes / Indented Stature: > Quote
    if (trimmed.startsWith('>')) {
      const quoteContent = trimmed.split('\n').map(l => l.replace(/^>\s*/, '')).join('<br/>');
      return `<blockquote class="clause-quote" style="border-left: 3.5px solid #c2410c; padding: 8px 16px; margin: 14px 0; font-style: italic; color: #374151; background-color: #fafaf9; border-radius: 0 6px 6px 0; line-height: 1.6;">${formatInlineMarkdown(quoteContent)}</blockquote>`;
    }

    // 4. Markdown Table: | Col1 | Col2 |
    if (trimmed.includes('|') && trimmed.includes('\n')) {
      const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length >= 2 && lines.some(l => l.includes('---'))) {
        const headerLine = lines[0];
        // Filter out divider lines (e.g. |---|---|)
        const rowLines = lines.slice(1).filter(l => !l.replace(/[\s|:-]/g, '').length);
        const actualDataRows = lines.slice(1).filter(l => l.replace(/[\s|:-]/g, '').length > 0);

        const parseCells = (line: string) => {
          return line
            .split('|')
            .map(c => c.trim())
            .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        };

        const headers = parseCells(headerLine);

        let tableHtml = '<table class="letter-table" style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 9.5pt; font-family: Arial, sans-serif;">';
        if (headers.length > 0) {
          tableHtml += '<thead><tr style="background-color: #f3f4f6; border-bottom: 2px solid #111827;">';
          headers.forEach(h => {
            tableHtml += `<th style="padding: 7px 10px; text-align: left; font-weight: 800; color: #111827; border: 1px solid #d1d5db;">${formatInlineMarkdown(h)}</th>`;
          });
          tableHtml += '</tr></thead>';
        }

        tableHtml += '<tbody>';
        actualDataRows.forEach((r, idx) => {
          const cells = parseCells(r);
          tableHtml += `<tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'}; border-bottom: 1px solid #e5e7eb;">`;
          cells.forEach(c => {
            tableHtml += `<td style="padding: 6px 10px; border: 1px solid #e5e7eb; color: #374151;">${formatInlineMarkdown(c)}</td>`;
          });
          tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table>';
        return tableHtml;
      }
    }

    // 5. Ordered / Numbered List: 1. Item or 1) Item
    const lines = trimmed.split('\n');
    const isNumberedList = lines.length > 1 && lines.every(l => /^\d+[\.\)]\s+/.test(l.trim()));
    const isBulletList = lines.length > 1 && lines.every(l => /^[\*\-•]\s+/.test(l.trim()));

    if (isNumberedList) {
      let listHtml = '<ol class="letter-ol" style="margin: 10px 0 14px 28px; padding-left: 0; line-height: 1.65; color: #1f2937;">';
      lines.forEach(l => {
        const itemContent = l.trim().replace(/^\d+[\.\)]\s+/, '');
        listHtml += `<li style="margin-bottom: 5px; padding-left: 4px;">${formatInlineMarkdown(itemContent)}</li>`;
      });
      listHtml += '</ol>';
      return listHtml;
    }

    if (isBulletList) {
      let listHtml = '<ul class="letter-ul" style="margin: 10px 0 14px 28px; padding-left: 0; list-style-type: square; line-height: 1.65; color: #1f2937;">';
      lines.forEach(l => {
        const itemContent = l.trim().replace(/^[\*\-•]\s+/, '');
        listHtml += `<li style="margin-bottom: 5px; padding-left: 4px;">${formatInlineMarkdown(itemContent)}</li>`;
      });
      listHtml += '</ul>';
      return listHtml;
    }

    // 6. Mixed list within a paragraph (e.g. first sentence followed by bullet points)
    const hasListLines = lines.some(l => /^(\d+[\.\)]|[\*\-•])\s+/.test(l.trim()));
    if (hasListLines && lines.length > 1) {
      let mixedHtml = '';
      let currentListType: 'none' | 'ol' | 'ul' = 'none';

      for (const l of lines) {
        const tr = l.trim();
        if (/^\d+[\.\)]\s+/.test(tr)) {
          if (currentListType !== 'ol') {
            if (currentListType === 'ul') mixedHtml += '</ul>';
            mixedHtml += '<ol class="letter-ol" style="margin: 8px 0 8px 28px; padding-left: 0; line-height: 1.65; color: #1f2937;">';
            currentListType = 'ol';
          }
          mixedHtml += `<li style="margin-bottom: 4px; padding-left: 4px;">${formatInlineMarkdown(tr.replace(/^\d+[\.\)]\s+/, ''))}</li>`;
        } else if (/^[\*\-•]\s+/.test(tr)) {
          if (currentListType !== 'ul') {
            if (currentListType === 'ol') mixedHtml += '</ol>';
            mixedHtml += '<ul class="letter-ul" style="margin: 8px 0 8px 28px; padding-left: 0; list-style-type: square; line-height: 1.65; color: #1f2937;">';
            currentListType = 'ul';
          }
          mixedHtml += `<li style="margin-bottom: 4px; padding-left: 4px;">${formatInlineMarkdown(tr.replace(/^[\*\-•]\s+/, ''))}</li>`;
        } else {
          if (currentListType === 'ol') { mixedHtml += '</ol>'; currentListType = 'none'; }
          if (currentListType === 'ul') { mixedHtml += '</ul>'; currentListType = 'none'; }
          mixedHtml += `<p class="body-p" style="text-indent: 30px; margin: 0 0 8px 0; line-height: 1.65; text-align: justify; color: #111827;">${formatInlineMarkdown(tr)}</p>`;
        }
      }

      if (currentListType === 'ol') mixedHtml += '</ol>';
      if (currentListType === 'ul') mixedHtml += '</ul>';
      return mixedHtml;
    }

    // 7. Standard Justified Corporate Paragraph
    const formattedParagraph = formatInlineMarkdown(trimmed).replace(/\n/g, '<br/>');
    return `<p class="body-p" style="text-indent: 32px; margin: 0 0 14px 0; line-height: 1.65; text-align: justify; color: #111827;">${formattedParagraph}</p>`;
  }).join('');
}

export function getWordAndCharCount(text: string) {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const chars = text.length;
  const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter(p => p.trim().length > 0).length : 0;
  return { words, chars, paragraphs };
}

export function formatCurrentDateFormal(): string {
  const now = new Date();
  const day = now.getDate();
  const month = now.toLocaleDateString('en-GB', { month: 'long' });
  const year = now.getFullYear();

  const suffix = (d: number) => {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  return `${day}${suffix(day)} ${month}, ${year}`;
}
