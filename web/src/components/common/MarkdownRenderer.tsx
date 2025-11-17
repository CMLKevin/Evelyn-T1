import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
// Use Light version of SyntaxHighlighter to reduce bundle size
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

// Import only commonly used languages to reduce bundle size
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import bash from 'react-syntax-highlighter/dist/esm/languages/hljs/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import css from 'react-syntax-highlighter/dist/esm/languages/hljs/css';
import xml from 'react-syntax-highlighter/dist/esm/languages/hljs/xml'; // For HTML
import sql from 'react-syntax-highlighter/dist/esm/languages/hljs/sql';
import markdown from 'react-syntax-highlighter/dist/esm/languages/hljs/markdown';

// Register languages
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('js', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('ts', typescript);
SyntaxHighlighter.registerLanguage('tsx', typescript);
SyntaxHighlighter.registerLanguage('jsx', javascript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sh', bash);
SyntaxHighlighter.registerLanguage('shell', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('html', xml);
SyntaxHighlighter.registerLanguage('xml', xml);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('md', markdown);

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer = memo(function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content overflow-hidden break-words ${className}`} style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
        // Code blocks with syntax highlighting
        code({ node, inline, children, ...props }: any) {
          // Extract className from props if it exists (for language detection)
          const className = (props as any).className || '';
          const match = /language-(\w+)/.exec(className);
          const language = match ? match[1] : '';
          
          return !inline && language ? (
            <div className="my-3 rounded-xl overflow-hidden shadow-lg">
              <div className="bg-gray-800 px-4 py-2 text-xs text-gray-400 font-mono border-b border-gray-700">
                {language}
              </div>
              <SyntaxHighlighter
                style={atomOneDark}
                language={language}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  padding: '1rem',
                  background: '#1a1a1a',
                  fontSize: '0.875rem',
                  lineHeight: '1.5'
                }}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          ) : (
            <code className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-sm font-mono break-all">
              {children}
            </code>
          );
        },
        
        // Headings
        h1: ({ children }) => (
          <h1 className="text-2xl font-bold mb-3 mt-4 text-white">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-bold mb-2 mt-3 text-white">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-semibold mb-2 mt-3 text-white">
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-base font-semibold mb-2 mt-2 text-white">
            {children}
          </h4>
        ),
        
        // Paragraphs
        p: ({ children }) => (
          <p className="mb-3 last:mb-0 leading-relaxed break-words" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
            {children}
          </p>
        ),
        
        // Lists
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-3 space-y-1 ml-2">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-3 space-y-1 ml-2">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">
            {children}
          </li>
        ),
        
        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 underline transition-colors break-all"
            style={{ wordBreak: 'break-all' }}
          >
            {children}
          </a>
        ),
        
        // Blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-purple-500 pl-4 my-3 italic text-gray-300">
            {children}
          </blockquote>
        ),
        
        // Horizontal rule
        hr: () => (
          <hr className="border-gray-600 my-4" />
        ),
        
        // Tables
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="min-w-full divide-y divide-gray-700">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-gray-800">
            {children}
          </thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-gray-700">
            {children}
          </tbody>
        ),
        tr: ({ children }) => (
          <tr>{children}</tr>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-sm text-gray-400">
            {children}
          </td>
        ),
        
        // Strong/Bold
        strong: ({ children }) => (
          <strong className="font-bold text-white">
            {children}
          </strong>
        ),
        
        // Emphasis/Italic
        em: ({ children }) => (
          <em className="italic text-gray-400">
            {children}
          </em>
        ),
        
        // Strikethrough
        del: ({ children }) => (
          <del className="line-through text-gray-500">
            {children}
          </del>
        ),
        
        // Images
        img: ({ src, alt }) => (
          <img
            src={src}
            alt={alt}
            className="rounded-lg max-w-full h-auto my-3 shadow-lg"
            loading="lazy"
          />
        ),
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownRenderer;

