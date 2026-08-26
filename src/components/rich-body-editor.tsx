"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  RemoveFormatting,
} from "lucide-react";

export type EditorVariable = { tag: string; hint?: string };

/**
 * Gmail-compose-style rich text editor for the drawer's step 2.
 * - Toolbar: bold / italic / underline / bullet list / numbered list / clear
 * - Variables insert as ATOMIC chips at the cursor:
 *     • Backspace removes a whole chip in one keystroke
 *     • Chips never split; typing next to them stays outside
 * - getContent() returns HTML with chips preserved as <span data-var="...">;
 *   the server strips tags when building the plain-text email body.
 */
export function RichBodyEditor({
  value,
  onChange,
  variables,
  disabled,
}: {
  value: string;
  onChange: (html: string) => void;
  variables: EditorVariable[];
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [, force] = useState(0);

  // Sync external value → DOM only when it differs structurally (e.g. AI rewrite).
  // After loading, convert every [Variable] token into an atomic badge chip.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== value && normalize(value) !== normalize(el.innerHTML)) {
      el.innerHTML = value || "";
      tokenizeAll(el);
      // Propagate the chipped markup back so state === DOM (prevents loops).
      if (el.innerHTML !== value) onChange(el.innerHTML);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const normalize = (s: string) => s.replace(/\s+/g, " ").replace(/> </g, "><").trim();

  /** Wrap every [X.Y] token inside `root` as an atomic var chip. */
  const tokenizeAll = (root: HTMLElement) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const targets: { node: Text; ranges: { start: number; end: number }[] }[] = [];
    const re = /\[[A-Za-z]+(?:\.[A-Za-z_]+)+\]/g; // e.g. [Event.Start_time]
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (!node.parentElement?.closest(".var-chip")) {
        re.lastIndex = 0;
        const m: { start: number; end: number }[] = [];
        let hit: RegExpExecArray | null;
        while ((hit = re.exec(node.data)) !== null) m.push({ start: hit.index, end: hit.index + hit[0].length });
        if (m.length) targets.push({ node, ranges: m });
      }
    }
    for (const { node: textNode, ranges } of targets.reverse()) {
      for (const r of ranges.reverse()) {
        const tag = textNode.data.slice(r.start, r.end);
        const chip = document.createElement("span");
        chip.contentEditable = "false";
        chip.dataset.var = tag;
        chip.className = "var-chip";
        chip.textContent = tag;
        const after = textNode.splitText(r.end);
        after.deleteData(0, 0); // no-op, keeps reference stable
        textNode.deleteData(r.start, tag.length);
        textNode.parentNode?.insertBefore(chip, after);
      }
    }
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    if (!sel) return;
    if (savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    ref.current?.focus();
  };

  const emit = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const exec = (cmd: string) => {
    restoreSelection();
    document.execCommand(cmd);
    saveSelection();
    emit();
    force((n) => n + 1);
  };

  /** Insert a variable chip exactly at the current caret position. */
  const insertVariable = useCallback(
    (tag: string) => {
      const el = ref.current;
      if (!el || disabled) return;
      restoreSelection();
      el.focus();

      const chip = document.createElement("span");
      chip.contentEditable = "false";
      chip.dataset.var = tag;
      chip.className = "var-chip";
      chip.textContent = tag;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
        el.appendChild(chip);
        el.appendChild(document.createTextNode("\u00a0"));
      } else {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(chip);
        // Move caret AFTER the chip so typing continues outside it.
        range.setStartAfter(chip);
        range.collapse(true);
        const nbsp = document.createTextNode("\u00a0");
        range.insertNode(nbsp);
        range.setStartAfter(nbsp);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      saveSelection();
      emit();
      force((n) => n + 1);
    },
    [disabled, onChange]
  );

  // Expose last-focused editor instance for the chip bar below the editor.
  useEffect(() => {
    const w = window as unknown as { __wiggliEditor?: RichBodyEditorHandle };
    w.__wiggliEditor = { insertVariable };
    return () => {
      if (w.__wiggliEditor?.insertVariable === insertVariable) delete w.__wiggliEditor;
    };
  }, [insertVariable]);

  return (
    <div className={`rich-editor ${disabled ? "rich-editor-disabled" : ""}`}>
      <div className="rich-toolbar">
        <button type="button" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}><Bold size={14} /></button>
        <button type="button" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}><Italic size={14} /></button>
        <button type="button" title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")}><UnderlineIcon size={14} /></button>
        <span className="rich-sep" />
        <button type="button" title="Bullet list" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")}><List size={14} /></button>
        <button type="button" title="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")}><ListOrdered size={14} /></button>
        <span className="rich-sep" />
        <button type="button" title="Clear formatting" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("removeFormat")}><RemoveFormatting size={14} /></button>
      </div>
      <div
        ref={ref}
        className="rich-content"
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emit}
        onBlur={saveSelection}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        data-placeholder="Write your invitation…"
      />
    </div>
  );
}

type RichBodyEditorHandle = { insertVariable: (tag: string) => void };

/** Insert into whichever editor instance is mounted (drawer has one). */
export function insertIntoActiveEditor(tag: string): boolean {
  const w = window as unknown as { __wiggliEditor?: RichBodyEditorHandle };
  if (w.__wiggliEditor) {
    w.__wiggliEditor.insertVariable(tag);
    return true;
  }
  return false;
}

/**
 * Convert editor HTML to the final email HTML.
 * Variable chips → plain [Tag] tokens (server resolves them).
 */
export function htmlWithVarTokens(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  div.querySelectorAll("span[data-var]").forEach((chip) => {
    chip.replaceWith(document.createTextNode(chip.getAttribute("data-var") ?? ""));
  });
  return div.innerHTML;
}

/**
 * Replace only the AI-owned paragraph in an otherwise user-edited invitation.
 * If the user deleted the block, insert it immediately after the greeting.
 */
export function replaceSmartContextBlock(html: string, paragraph: string): string {
  const root = document.createElement("div");
  root.innerHTML = html;
  const escaped = paragraph
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  let block = root.querySelector<HTMLElement>('[data-smart-block="ai-context"]');
  if (!block) {
    block = document.createElement("div");
    block.dataset.smartBlock = "ai-context";
    const greeting = root.querySelector('[data-smart-block="greeting"]');
    greeting?.after(block);
    if (!greeting) root.prepend(block);
  }
  block.innerHTML = `<p>${escaped}</p>`;
  return root.innerHTML;
}
