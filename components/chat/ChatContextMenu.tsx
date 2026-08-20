"use client";

import { useEffect, useRef, useState } from "react";
import { ChatFolder, ChatThread } from "@/lib/types";
import {
  ArrowDownIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  EyeOffIcon,
  FolderIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons/Icons";

/**
 * Right-click / "..."-icon context menu for one chat thread row, modeled on claude.ai's chat-list
 * menu. "Zum Projekt hinzufügen" reuses finara's existing ChatFolder concept (see ChatThread's
 * folderId doc comment in lib/types.ts) rather than introducing a second, parallel grouping
 * entity — the menu just labels it "Projekt" to match the requested wording.
 */
export function ChatContextMenu({
  thread,
  folders,
  position,
  onClose,
  onTogglePin,
  onMarkUnread,
  onStartRename,
  onMoveToFolder,
  onCreateFolderAndMove,
  onDelete,
  onOpenNewTab,
  onMoveDown,
}: {
  thread: ChatThread;
  folders: ChatFolder[];
  position: { x: number; y: number };
  onClose: () => void;
  onTogglePin: () => void;
  onMarkUnread: () => void;
  onStartRename: () => void;
  onMoveToFolder: (folderId: string) => void;
  onCreateFolderAndMove: (name: string) => void;
  onDelete: () => void;
  onOpenNewTab: () => void;
  onMoveDown: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [projectSubmenuOpen, setProjectSubmenuOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function submitNewProject() {
    const trimmed = newProjectName.trim();
    if (trimmed) onCreateFolderAndMove(trimmed);
    setNewProjectName("");
  }

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700/70";

  return (
    <div
      ref={menuRef}
      style={{ position: "fixed", left: position.x, top: position.y }}
      className="z-50 w-64 rounded-xl border border-slate-700 bg-slate-800 p-1.5 shadow-xl"
    >
      <button type="button" className={itemClass} onClick={onTogglePin}>
        <PinIcon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{thread.pinned ? "Lösen" : "Anpinnen"}</span>
        <span className="text-xs text-slate-500">P</span>
      </button>

      <button type="button" className={itemClass} onClick={onMarkUnread}>
        <EyeOffIcon className="h-4 w-4 shrink-0" />
        <span className="flex-1">Als ungelesen markieren</span>
        <span className="text-xs text-slate-500">U</span>
      </button>

      <button type="button" className={itemClass} onClick={onStartRename}>
        <PencilIcon className="h-4 w-4 shrink-0" />
        <span className="flex-1">Umbenennen</span>
        <span className="text-xs text-slate-500">R</span>
      </button>

      <div
        className="relative"
        onMouseEnter={() => setProjectSubmenuOpen(true)}
        onMouseLeave={() => setProjectSubmenuOpen(false)}
      >
        <button
          type="button"
          className={itemClass}
          onClick={() => setProjectSubmenuOpen((v) => !v)}
        >
          <FolderIcon className="h-4 w-4 shrink-0" />
          <span className="flex-1">Zum Projekt hinzufügen</span>
          <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        </button>

        {projectSubmenuOpen && (
          <div className="absolute left-full top-0 ml-1 w-56 rounded-xl border border-slate-700 bg-slate-800 p-1.5 shadow-xl">
            {folders.length === 0 && (
              <p className="px-3 py-1.5 text-xs text-slate-500">Noch keine Projekte angelegt.</p>
            )}
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                className={itemClass}
                onClick={() => onMoveToFolder(folder.id)}
              >
                <FolderIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{folder.name}</span>
                {thread.folderId === folder.id && <span className="text-xs text-brand-teal">✓</span>}
              </button>
            ))}
            <div className="my-1 h-px bg-slate-700" />
            <div className="flex items-center gap-1.5 px-2 py-1">
              <input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitNewProject()}
                placeholder="Neues Projekt"
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-200 outline-none focus:border-brand-teal"
              />
              <button
                type="button"
                onClick={submitNewProject}
                aria-label="Projekt erstellen"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              >
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      <button type="button" className={itemClass} onClick={onOpenNewTab}>
        <ExternalLinkIcon className="h-4 w-4 shrink-0" />
        <span className="flex-1">In neuem Tab öffnen</span>
      </button>

      <button type="button" className={itemClass} onClick={onMoveDown}>
        <ArrowDownIcon className="h-4 w-4 shrink-0" />
        <span className="flex-1">Nach unten verschieben</span>
      </button>

      <div className="my-1 h-px bg-slate-700" />

      {confirmingDelete ? (
        <div className="px-3 py-2">
          <p className="mb-2 text-xs text-slate-300">
            Chat wirklich löschen? Das kann nicht rückgängig gemacht werden.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDelete}
              className="flex-1 rounded-md bg-risk-high px-2 py-1.5 text-xs font-semibold text-white hover:bg-risk-high/90"
            >
              Löschen
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="flex-1 rounded-md border border-slate-600 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-risk-high hover:bg-risk-high/10"
          onClick={() => setConfirmingDelete(true)}
        >
          <TrashIcon className="h-4 w-4 shrink-0" />
          <span className="flex-1">Löschen</span>
          <span className="text-xs text-risk-high/70">D</span>
        </button>
      )}
    </div>
  );
}
