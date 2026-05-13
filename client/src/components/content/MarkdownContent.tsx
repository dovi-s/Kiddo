import { Fragment, type ReactNode } from "react";
import { Link } from "wouter";

type Block =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string };

function renderInline(text: string): ReactNode[] {
  const output: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      output.push(text.slice(lastIndex, match.index));
    }
    if (match[1] && match[2]) {
      const label = match[1];
      const href = match[2];
      output.push(
        href.startsWith("/") ? (
          <Link key={`${href}-${match.index}`} href={href} className="text-primary hover:underline">
            {label}
          </Link>
        ) : (
          <a key={`${href}-${match.index}`} href={href} className="text-primary hover:underline">
            {label}
          </a>
        ),
      );
    } else if (match[3]) {
      output.push(
        <code key={`code-${match.index}`} className="rounded bg-muted px-1.5 py-0.5 text-[0.95em] text-foreground">
          {match[3]}
        </code>,
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    output.push(text.slice(lastIndex));
  }

  return output;
}

function parseMarkdown(body: string): Block[] {
  const lines = body.split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let orderedItems: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "p", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listItems.length) {
      blocks.push({ type: "ul", items: [...listItems] });
      listItems = [];
    }
  };
  const flushOrdered = () => {
    if (orderedItems.length) {
      blocks.push({ type: "ol", items: [...orderedItems] });
      orderedItems = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      flushOrdered();
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      flushOrdered();
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      flushOrdered();
      blocks.push({ type: "h3", text: line.slice(4).trim() });
      continue;
    }

    if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      flushOrdered();
      blocks.push({ type: "quote", text: line.slice(2).trim() });
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      flushOrdered();
      listItems.push(line.slice(2).trim());
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      flushParagraph();
      flushList();
      orderedItems.push(line.replace(/^\d+\.\s/, "").trim());
      continue;
    }

    flushList();
    flushOrdered();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  flushOrdered();
  return blocks;
}

export function MarkdownContent({ body }: { body: string }) {
  const blocks = parseMarkdown(body);

  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        if (block.type === "h2") {
          return (
            <h2 key={index} className="font-heading text-2xl font-semibold text-foreground pt-4">
              {block.text}
            </h2>
          );
        }
        if (block.type === "h3") {
          return (
            <h3 key={index} className="font-heading text-xl font-semibold text-foreground pt-2">
              {block.text}
            </h3>
          );
        }
        if (block.type === "quote") {
          return (
            <blockquote key={index} className="border-l-4 border-primary/30 pl-4 text-muted-foreground italic">
              {renderInline(block.text)}
            </blockquote>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={index} className="space-y-2 pl-5 text-muted-foreground list-disc">
              {block.items.map((item) => (
                <li key={item}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={index} className="space-y-2 pl-5 text-muted-foreground list-decimal">
              {block.items.map((item) => (
                <li key={item}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={index} className="text-base leading-8 text-muted-foreground">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
