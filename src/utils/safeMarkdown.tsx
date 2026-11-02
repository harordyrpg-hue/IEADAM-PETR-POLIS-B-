import React from 'react';

/**
 * Safe Markdown-like renderer that renders plain React elements
 * without dangerouslySetInnerHTML to prevent XSS.
 */
export const SafeMarkdownRenderer: React.FC<{ content: string; className?: string }> = ({
  content,
  className = '',
}) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let currentList: string[] = [];
  let blockIndex = 0;

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${blockIndex++}`} className="list-disc list-inside space-y-1.5 my-3 pl-2 text-stone-700 dark:text-stone-300">
          {currentList.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  const renderInline = (text: string): React.ReactNode => {
    // Process **bold** and *italic*
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    // Simple parser for **bold** and *italic*
    const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      if (match[2]) {
        // Bold
        parts.push(
          <strong key={`b-${keyIdx++}`} className="font-bold text-stone-900 dark:text-stone-100">
            {match[2]}
          </strong>
        );
      } else if (match[3]) {
        // Italic
        parts.push(
          <em key={`i-${keyIdx++}`} className="italic">
            {match[3]}
          </em>
        );
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      currentList.push(trimmed.substring(2));
      continue;
    }

    flushList();

    if (!trimmed) {
      // Empty line / paragraph break
      continue;
    }

    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${blockIndex++}`} className="text-lg md:text-xl font-bold text-stone-900 dark:text-white mt-5 mb-2 tracking-tight">
          {renderInline(trimmed.substring(4))}
        </h3>
      );
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${blockIndex++}`} className="text-xl md:text-2xl font-bold text-stone-900 dark:text-white mt-6 mb-3 tracking-tight">
          {renderInline(trimmed.substring(3))}
        </h2>
      );
    } else if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote key={`bq-${blockIndex++}`} className="border-l-4 border-amber-600 dark:border-amber-500 pl-4 py-1 italic my-3 text-stone-600 dark:text-stone-400 bg-amber-500/5 rounded-r">
          {renderInline(trimmed.substring(2))}
        </blockquote>
      );
    } else {
      elements.push(
        <p key={`p-${blockIndex++}`} className="my-2.5 leading-relaxed text-stone-700 dark:text-stone-300">
          {renderInline(trimmed)}
        </p>
      );
    }
  }

  flushList();

  return <div className={`prose-stone ${className}`}>{elements}</div>;
};
