import fs from 'fs';
import path from 'path';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function renderInline(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} className="text-indigo-400 font-mono bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-800/50 text-sm">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('[') && part.includes('](')) {
      const match = part.match(/\[(.*?)\]\((.*?)\)/);
      if (match) {
        const [, label, href] = match;
        const cleanHref = href.startsWith('../') ? href.replace('../', '/') : href;
        return (
          <Link key={idx} href={cleanHref} className="text-indigo-400 hover:text-indigo-300 underline font-medium">
            {label}
          </Link>
        );
      }
    }
    return part;
  });
}

export default function ConnectPage() {
  const filePath = path.join(process.cwd(), 'docs/DISCOVERY.md');
  const markdown = fs.readFileSync(filePath, 'utf-8');

  const lines = markdown.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = '';
  let inList = false;
  let listItems: string[] = [];
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const flushList = (key: string) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key} className="list-disc list-inside space-y-2 text-slate-300 mb-6 pl-2">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">{renderInline(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushTable = (key: string) => {
    if (inTable) {
      elements.push(
        <div key={key} className="overflow-x-auto mb-6 border border-slate-800 rounded-xl">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/50">
              <tr>
                {tableHeaders.map((h, idx) => (
                  <th key={idx} className="px-4 py-3 text-left font-semibold text-white border-r border-slate-800 last:border-r-0">
                    {renderInline(h.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950">
              {tableRows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-slate-900/20">
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="px-4 py-3 text-slate-300 border-r border-slate-800 last:border-r-0 leading-relaxed">
                      {renderInline(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        elements.push(
          <pre key={`code-${i}`} className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-sm text-slate-300 overflow-x-auto font-mono mb-6 leading-relaxed">
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        // Start of code block
        flushList(`list-pre-code-${i}`);
        flushTable(`table-pre-code-${i}`);
        inCodeBlock = true;
        codeLang = line.replace('```', '').trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Table detection
    if (line.trim().startsWith('|')) {
      flushList(`list-table-${i}`);
      const cells = line.split('|').slice(1, -1); // remove outer empty splits
      
      // If it's a separator line e.g. |---|---|
      if (line.includes('---')) {
        continue;
      }
      
      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      if (inTable) {
        flushTable(`table-end-${i}`);
      }
    }

    // Dividers
    if (line.trim() === '---') {
      flushList(`list-hr-${i}`);
      elements.push(<hr key={`hr-${i}`} className="border-slate-800 my-8" />);
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      flushList(`list-h1-${i}`);
      elements.push(<h1 key={`h1-${i}`} className="text-4xl font-bold tracking-tight text-white mb-6 mt-4">{renderInline(line.slice(2))}</h1>);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList(`list-h2-${i}`);
      elements.push(<h2 key={`h2-${i}`} className="text-2xl font-semibold text-white border-b border-slate-800 pb-3 mb-4 mt-8">{renderInline(line.slice(3))}</h2>);
      continue;
    }
    if (line.startsWith('### ')) {
      flushList(`list-h3-${i}`);
      elements.push(<h3 key={`h3-${i}`} className="text-xl font-medium text-slate-200 mb-3 mt-6">{renderInline(line.slice(4))}</h3>);
      continue;
    }
    if (line.startsWith('#### ')) {
      flushList(`list-h4-${i}`);
      elements.push(<h4 key={`h4-${i}`} className="text-lg font-medium text-slate-300 mb-2 mt-4">{renderInline(line.slice(5))}</h4>);
      continue;
    }

    // Lists
    const listMatch = line.match(/^(\s*)(-\s|\*\s|\d+\.\s)(.*)/);
    if (listMatch) {
      inList = true;
      listItems.push(listMatch[3]);
      continue;
    }

    // Non-list line
    if (line.trim() === '') {
      if (inList) {
        flushList(`list-empty-${i}`);
      }
      continue;
    }

    // Paragraph
    flushList(`list-p-${i}`);
    elements.push(
      <p key={`p-${i}`} className="text-slate-400 text-base leading-relaxed mb-4">
        {renderInline(line)}
      </p>
    );
  }

  // Final flushes
  flushList('list-end');
  flushTable('table-end');

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30">
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-8">
        <div>
          <Link href="/" className="text-indigo-400 hover:text-indigo-300 font-mono text-sm inline-flex items-center gap-1">
            &larr; Back to Home
          </Link>
        </div>
        <article className="prose prose-invert max-w-none">
          {elements}
        </article>
      </div>
    </main>
  );
}
