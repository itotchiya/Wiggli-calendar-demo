"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  RemoveFormatting,
  Indent,
  Outdent,
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
  generatingBlockSelector,
  generating,
}: {
  value: string;
  onChange: (html: string) => void;
  variables: EditorVariable[];
  disabled?: boolean;
  /** CSS selector of the block that AI is currently rewriting. */
  generatingBlockSelector?: string;
  /** True only while AI is actively generating — drives the neon overlay. */
  generating?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [, force] = useState(0);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isBulleted, setIsBulleted] = useState(false);
  const [isNumbered, setIsNumbered] = useState(false);

  const updateToolbarState = useCallback(() => {
    try {
      setIsBold(document.queryCommandState("bold"));
      setIsItalic(document.queryCommandState("italic"));
      setIsUnderline(document.queryCommandState("underline"));
      setIsBulleted(document.queryCommandState("insertUnorderedList"));
      setIsNumbered(document.queryCommandState("insertOrderedList"));
    } catch {}
  }, []);

  // Instant clean on rewrite: generating alone controls the shimmer, no selector gate and no dim overlay.
  const showOverlay = Boolean(generating);
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

    // Sync external value → DOM only when it differs structurally (e.g. AI rewrite).
  // After loading, convert every [Variable] token into an atomic badge chip.
  const normalize = (s: string) => s.replace(/\s+/g, " ").replace(/> </g, "><").trim();
  useEffect(() => {
    if (showOverlay) return; // keep clean while shimmering — don't re-inject old invitation
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

  useEffect(() => {
    const handler = () => updateToolbarState();
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [updateToolbarState]);

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
    const el = ref.current;
    if (!el) return;
    // If no saved range (toolbar clicked without caret), place caret at end so list toggles
    if (!savedRange.current || !el.contains(savedRange.current?.commonAncestorContainer)) {
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      savedRange.current = range.cloneRange();
    } else {
      restoreSelection();
    }
    // Try execCommand, fallback to manual list insertion for deprecated browsers
    let handled = false;
    try {
      handled = document.execCommand(cmd);
    } catch {}
    if (!handled && (cmd === "insertUnorderedList" || cmd === "insertOrderedList")) {
      // Manual fallback: wrap current block or insert new list
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const listTag = cmd === "insertUnorderedList" ? "ul" : "ol";
        const existing = (sel.anchorNode as HTMLElement)?.closest?.(listTag) || (range.commonAncestorContainer as HTMLElement)?.closest?.(listTag);
        if (existing) {
          // Unwrap list: move children out
          const parent = existing.parentNode;
          while (existing.firstChild) parent?.insertBefore(existing.firstChild, existing);
          existing.remove();
        } else {
          const list = document.createElement(listTag);
          const li = document.createElement("li");
          // Use current selection text or br
          const frag = range.extractContents();
          if (!frag.textContent?.trim()) li.innerHTML = "<br>";
          else li.appendChild(frag);
          list.appendChild(li);
          range.insertNode(list);
          // Place caret inside li
          const newRange = document.createRange();
          newRange.setStart(li, 0);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
        }
        handled = true;
      }
    }
    if (cmd === "removeFormat" && !handled) {
      try { document.execCommand("removeFormat"); handled = true; } catch {}
    }
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

  // During AI generation keep the editor chrome but clean the body: only shimmer at top, no dim overlay.
  const isGenerating = showOverlay;
  return (
    <div className={`rich-editor ${disabled && !isGenerating ? "rich-editor-disabled" : ""}`}>
      <div className="rich-toolbar">
        <button type="button" title="Bold" aria-pressed={isBold} className={isBold ? "active" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}><Bold size={14} /></button>
        <button type="button" title="Italic" aria-pressed={isItalic} className={isItalic ? "active" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}><Italic size={14} /></button>
        <button type="button" title="Underline" aria-pressed={isUnderline} className={isUnderline ? "active" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")}><UnderlineIcon size={14} /></button>
        <span className="rich-sep" />
        <button type="button" title="Bullet list" aria-pressed={isBulleted} className={isBulleted ? "active" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")}><List size={14} /></button>
        <button type="button" title="Numbered list" aria-pressed={isNumbered} className={isNumbered ? "active" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")}><ListOrdered size={14} /></button>
        <span className="rich-sep" />
        <button type="button" title="Increase indent (push right)" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("indent")}><Indent size={14} /></button>
        <button type="button" title="Decrease indent" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("outdent")}><Outdent size={14} /></button>
        <span className="rich-sep" />
        <button type="button" title="Clear formatting" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("removeFormat")}><RemoveFormatting size={14} /></button>
      </div>
      {isGenerating ? (
        <div className="rich-generating-state" style={{ minHeight: 260, padding: "12px 14px" }}>
          <span className="ai-shimmer-text">Wiggli AI writing invitation…</span>
        </div>
      ) : (
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
      )}
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
