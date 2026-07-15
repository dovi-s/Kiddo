import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic } from "lucide-react";
import { useEffect } from "react";

// RichText (the DOMPurify-only read-only renderer) now lives in its own module
// so importers that only RENDER stored HTML don't pull tiptap. Re-exported here
// for the authoring pages (Events/EventCreate) that import both from this file
// and already bundle the editor anyway. The public GiftCheckout funnel imports
// RichText directly from rich-text-view to stay tiptap-free. 2026-06-04.
export { RichText } from "./rich-text-view";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

export function RichTextEditor({ value, onChange, placeholder = "Write something...", className, "data-testid": testId }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        listItem: false,
        bulletList: false,
        orderedList: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    onUpdate({ editor }) {
      const html = editor.getHTML();
      // Treat empty paragraph as empty string
      onChange(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        class: "outline-none min-h-[80px] text-sm text-foreground leading-relaxed",
      },
    },
  });

  // Sync external value changes (e.g. modal re-open)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value || "";
    if (current !== incoming && (incoming === "" || incoming === "<p></p>")) {
      editor.commands.setContent(incoming || "");
    }
  }, [value, editor]);

  if (!editor) return null;

  const ToolbarBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className={`rounded-xl border border-border bg-background focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent transition-all ${className ?? ""}`} data-testid={testId}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-border px-2 py-1.5">
        <ToolbarBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={13} />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={13} />
        </ToolbarBtn>
        <div className="ml-auto text-3xs text-muted-foreground select-none hidden sm:block">
          <span className="opacity-60">⌘B bold · ⌘I italic · Enter new line</span>
        </div>
      </div>
      {/* Editor area */}
      <div className="px-3 py-2.5">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

