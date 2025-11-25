"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, rtc } from "../../api";
import "quill/dist/quill.snow.css";
import "katex/dist/katex.min.css";
import "./style/globals.css";
import { DocRTC } from "./rtcClient";
import EditorUI from "./EditorUI";

export default function Editor() {
  const rtcRef = useRef<DocRTC | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);
  const params = useParams();
  const router = useRouter();
  const documentId = params.documentId as string;
  const [isSaving, setIsSaving] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [title, setTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchMatches, setSearchMatches] = useState<any[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [showSignature, setShowSignature] = useState(false);
  const [showMathEditor, setShowMathEditor] = useState(false);
  const [mathLatex, setMathLatex] = useState("");
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const canEditRef = useRef<boolean>(false);
  const toolbarAddedRef = useRef<boolean>(false);
  const initials = useRef<string>("");

    // States for version tracking
  const [versionsList, setVersionsList] = useState<any[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<any | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const previewEditorRef = useRef<HTMLDivElement>(null);
  const previewQuillRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!editorRef.current || quillRef.current) return;

    let mounted = true;

    const initQuill = async () => {
      const QuillModule = (await import("quill")).default;
      const DeltaModule = (await import("quill-delta")).default;
      
      // Dynamically import KaTeX
      const katex = await import("katex");
      (window as any).katex = katex.default;

      if (!mounted || !editorRef.current) return;

      const QuillTable = QuillModule.import("modules/table");
      QuillModule.register("modules/table", QuillTable);

      // Register formula module for math equations
      const Formula = QuillModule.import("formats/formula");
      if (Formula) {
        QuillModule.register("formats/formula", Formula);
      }

      const customBindings = {
        enterInTable: {
          key: 13,
          handler: function (this: any, range: any) {
            const [line] = this.quill.getLine(range.index);
            if (line && line.domNode && line.domNode.closest("td")) {
              this.quill.insertText(range.index, "\n");
              this.quill.setSelection(range.index + 1);
              return false;
            }
            return true;
          },
        },
      };

      const toolbarOptions = [
        [{ header: [1, 2, 3, false] }],
        [{ size: ["small", false, "large", "huge"] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ align: [] }],
        ["blockquote", "code-block"],
        ["link", "image"],
        ["formula"],
        ["clean"],
      ];

      quillRef.current = new QuillModule(editorRef.current, {
        theme: "snow",
        modules: {
          toolbar: {
            container: toolbarOptions,
          },
          keyboard: {
            bindings: customBindings,
          },
          history: {
            delay: 1000,
            maxStack: 100,
            userOnly: true,
          },
          table: true,
        },
      });
      
      await loadDocument();

      quillRef.current.disable();

      setTimeout(() => {
        if (!toolbarAddedRef.current) {
          addCustomToolbarButtons();
          addTooltips();
          toolbarAddedRef.current = true;
        }
        setupTableContextMenu();
        setupTableSelection();
      }, 100);

      let applyingRemote = false;
      let snapshotApplied = false;
      let queuedDeltas: any[] = [];

      if (!rtcRef.current && mounted) {
        rtcRef.current = new DocRTC(
          Number(documentId), initials.current,
          (deltaOrSnapshot, isSnapshot, version) => {
            if (!quillRef.current) return;
            if (isSnapshot) {
              snapshotApplied = true;
              applyingRemote = true;
              const currentCursorRange = quillRef.current.getSelection();
              quillRef.current.setContents(deltaOrSnapshot, "api");
              if (currentCursorRange) {
                const transformedIndex = deltaOrSnapshot.transformPosition(
                  currentCursorRange.index,
                  true
                );
                quillRef.current.setSelection(transformedIndex, 0, "api");
              }
              applyingRemote = false;
              if (canEditRef.current) quillRef.current.enable();
              for (const d of queuedDeltas) {
                applyingRemote = true;
                quillRef.current.updateContents(d, "api");
                applyingRemote = false;
              }
              queuedDeltas = [];
              return;
            }
            if (!isSnapshot) {
              applyingRemote = true;
              const quill = quillRef.current;
              if (!quill) return;
              const oldRange = quill.getSelection();
              quill.updateContents(deltaOrSnapshot, "api");
              if (oldRange) {
                const newIndex = deltaOrSnapshot.transformPosition(
                  oldRange.index
                );
                quill.setSelection(newIndex, oldRange.length, "api");
              }
              applyingRemote = false;
            }
          }
        );
        rtcRef.current.connect();
        rtcRef.current.setCursorHandler((peerId, index, length, name) => {
          removeRemoteHighlight(peerId);
          if (length === 0) {
            renderCaret(peerId, index);
            renderCursorLabel(peerId, name, index);
          } else {
            renderRemoteSelection(peerId, index, length);
            renderCursorLabel(peerId, name, index);
          }
        });
      }

      quillRef.current.on(
        "text-change",
        (delta: any, oldDelta: any, source: string) => {
          if (!snapshotApplied) return;
          if (source === "user" && !applyingRemote) {
            rtcRef.current?.sendDelta(delta);

            const range = quillRef.current.getSelection();
            if (range) {
              rtcRef.current?.sendCursor(range.index, range.length);
            }
          }
        }
      );

      quillRef.current.on(
        "selection-change", 
        (range: { index: number; length: number } | null, oldRange: any, source: string) => {
          if (source !== "user") return;
          if (!range) return;
          if (applyingRemote) return;
          rtcRef.current?.sendCursor(range.index, range.length);
        }
      );
    };

    initQuill();

    return () => {
      mounted = false;
      if (quillRef.current) {
        quillRef.current.disable();
        quillRef.current = null;
      }
    };
  }, []);

  const remoteCursors: Record<string, any> = {};
  const userColors: Record<string, string> = {};

  function getColorForPeer(peerId: string) {
    if (!userColors[peerId]) {
      userColors[peerId] = getRandomColor();
    }
    return userColors[peerId];
  }

  function getRandomColor() {
    const colors = [
      "#FF6B6B", "#5FAD56", "#4D9DE0",
      "#F0C808", "#B86ADC", "#FF8C42",
      "#2EC4B6", "#E71D36"
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function renderRemoteSelection(peerId: string, index: number, length: number) {
    const quill = quillRef.current;
    if (!quill) return;

    if (remoteCursors[peerId]) {
      quill.formatText(remoteCursors[peerId].index, remoteCursors[peerId].length, {
        background: false
      }, "silent");
    }

    remoteCursors[peerId] = { index, length };

    quill.formatText(index, length, {
      background: getColorForPeer(peerId)
    }, "silent");
  }

  function renderCursorLabel(peerId: string, name: string, index: number) {
    const quill = quillRef.current;
    const bounds = quill.getBounds(index);

    let label = document.getElementById(`cursor-label-${peerId}`);
    if (!label) {
      label = document.createElement("div");
      label.id = `cursor-label-${peerId}`;
      label.style.position = "absolute";
      label.style.padding = "2px 6px";
      label.style.borderRadius = "4px";
      label.style.fontSize = "12px";
      label.style.color = "white";
      label.style.pointerEvents = "none";
      label.style.transform = "translateY(-20px)";
      document.getElementById("cursor-overlay")?.appendChild(label);
    }

    label.innerText = name;
    label.style.background = getColorForPeer(peerId);
    label.style.left = `${bounds.left}px`;
    label.style.top = `${bounds.top}px`;
  }

  function renderCaret(peerId: string, index: number) {
    removeCaret(peerId);

    const quill = quillRef.current;
    const bounds = quill.getBounds(index);

    const caret = document.createElement("div");
    caret.id = `caret-${peerId}`;
    caret.style.position = "absolute";
    caret.style.width = "2px";
    caret.style.height = `${bounds.height}px`;
    caret.style.left = `${bounds.left}px`;
    caret.style.top = `${bounds.top}px`;
    caret.style.background = getColorForPeer(peerId);

    document.getElementById("cursor-overlay")?.appendChild(caret);
  }

  function removeCaret(peerId: string) {
    const caret = document.getElementById(`caret-${peerId}`);
    if (caret) caret.remove();

    const label = document.getElementById(`cursor-label-${peerId}`);
    if (label) label.remove();
  }

  function removeRemoteHighlight(peerId: string) {
    const prev = remoteCursors[peerId];
    if (!prev || !quillRef.current) return;

    quillRef.current.formatText(
      prev.index,
      prev.length || 1,
      { background: false },
      "silent"
    );
  }

  const addCustomToolbarButtons = () => {
    const toolbars = document.querySelectorAll(".ql-toolbar");
    if (toolbars.length === 0) return;

    const toolbar = toolbars[0];
    
    const existingTable = toolbar.querySelector(".ql-table");
    const existingSign = toolbar.querySelector(".ql-signature");
    const existingMath = toolbar.querySelector(".ql-math-editor");
    
    if (existingTable || existingSign || existingMath) return;

    const tableBtn = document.createElement("button");
    tableBtn.className = "ql-table";
    tableBtn.innerHTML = "⊞";
    tableBtn.title = "Insert Table";
    tableBtn.type = "button";
    tableBtn.onclick = (e) => {
      e.preventDefault();
      setShowTablePicker(!showTablePicker);
    };

    const signBtn = document.createElement("button");
    signBtn.className = "ql-signature";
    signBtn.innerHTML = "✍️";
    signBtn.title = "E-Signature";
    signBtn.type = "button";
    signBtn.onclick = (e) => {
      e.preventDefault();
      setShowSignature(true);
    };

    const mathBtn = document.createElement("button");
    mathBtn.className = "ql-math-editor";
    mathBtn.innerHTML = "∑";
    mathBtn.title = "Math Editor";
    mathBtn.type = "button";
    mathBtn.onclick = (e) => {
      e.preventDefault();
      setShowMathEditor(true);
    };

    toolbar.appendChild(tableBtn);
    toolbar.appendChild(signBtn);
    toolbar.appendChild(mathBtn);
  };

  const addTooltips = () => {
    const tooltips: Record<string, string> = {
      ".ql-bold": "Bold",
      ".ql-italic": "Italic",
      ".ql-underline": "Underline",
      ".ql-strike": "Strikethrough",
      ".ql-list[value='ordered']": "Numbered List",
      ".ql-list[value='bullet']": "Bullet List",
      ".ql-blockquote": "Quote",
      ".ql-code-block": "Code Block",
      ".ql-link": "Insert Link",
      ".ql-image": "Insert Image",
      ".ql-formula": "Insert Formula",
      ".ql-clean": "Clear Formatting",
      ".ql-header": "Heading",
      ".ql-size": "Font Size",
      ".ql-align": "Text Align",
    };

    Object.entries(tooltips).forEach(([selector, tooltip]) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        if (!el.getAttribute("title")) {
          el.setAttribute("title", tooltip);
        }
      });
    });
  };

  const setupTableSelection = () => {
    if (!editorRef.current) return;

    const handleMouseOver = (e: Event) => {
      const target = e.target as HTMLElement;
      const table = target.closest("table");

      if (table) {
        const cells = table.querySelectorAll("td");
        cells.forEach((cell) => {
          (cell as HTMLElement).style.backgroundColor = "#e3f2fd";
        });
      }
    };

    const handleMouseOut = (e: Event) => {
      const target = e.target as HTMLElement;
      const table = target.closest("table");

      if (table) {
        const cells = table.querySelectorAll("td");
        cells.forEach((cell) => {
          (cell as HTMLElement).style.backgroundColor = "";
        });
      }
    };

    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const table = target.closest("table");

      if (table && (e as MouseEvent).ctrlKey) {
        e.preventDefault();
        selectTable(table);
      }
    };

    editorRef.current.addEventListener("mouseover", handleMouseOver);
    editorRef.current.addEventListener("mouseout", handleMouseOut);
    editorRef.current.addEventListener("click", handleClick);
  };

  const selectTable = (table: HTMLElement) => {
    const cells = table.querySelectorAll("td");
    cells.forEach((cell) => {
      (cell as HTMLElement).style.backgroundColor = "#2196f3";
      (cell as HTMLElement).style.color = "#ffffff";
    });

    setTimeout(() => {
      cells.forEach((cell) => {
        (cell as HTMLElement).style.backgroundColor = "";
        (cell as HTMLElement).style.color = "";
      });
    }, 300);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        handlePrint();
      }
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
        clearSearch();
      }
      if (e.key === "Escape" && showExportMenu) {
        setShowExportMenu(false);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && document.activeElement?.closest("table")) {
        const selection = quillRef.current?.getSelection();
        if (selection) {
          const [line] = quillRef.current.getLine(selection.index);
          const table = line?.domNode?.closest("table");
          if (table && e.ctrlKey) {
            e.preventDefault();
            table.remove();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSearch, showExportMenu]);

  useEffect(() => {
    const handleUnload = () => {
      rtcRef.current?.leave();
      rtc.leave(documentId);
    }
    window.addEventListener(`beforeunload`, handleUnload);
    window.addEventListener("unload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("unload", handleUnload);
      handleUnload();
    };
  }, [documentId]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showExportMenu && !target.closest('.export-dropdown')) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  const setupTableContextMenu = () => {
    if (!editorRef.current) return;

    const handleContextMenu = (e: Event) => {
      const target = e.target as HTMLElement;
      const cell = target.closest("td");

      if (cell) {
        e.preventDefault();
        showTableContextMenu(e as MouseEvent, cell);
      }
    };

    editorRef.current.addEventListener("contextmenu", handleContextMenu);
  };

  const showTableContextMenu = (e: MouseEvent, cell: HTMLElement) => {
    const existingMenu = document.querySelector(".table-context-menu");
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement("div");
    menu.className = "table-context-menu";
    menu.style.left = `${e.pageX}px`;
    menu.style.top = `${e.pageY}px`;

    const isNested = isTableNested(cell);

    const options = [
      { label: "Insert Row Above", action: () => insertRow(cell, true) },
      { label: "Insert Row Below", action: () => insertRow(cell, false) },
      { label: "Insert Column Left", action: () => insertColumn(cell, true) },
      { label: "Insert Column Right", action: () => insertColumn(cell, false) },
      { label: "Delete Row", action: () => deleteRow(cell) },
      { label: "Delete Column", action: () => deleteColumn(cell) },
      { label: "Delete Table", action: () => deleteTable(cell) },
    ];

    if (!isNested) {
      options.push({
        label: "Insert Nested Table (2×2)",
        action: () => insertNestedTable(cell),
      });
    }

    options.forEach((option) => {
      const btn = document.createElement("button");
      btn.textContent = option.label;

      btn.onclick = () => {
        option.action();
        menu.remove();
      };
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);

    const closeMenu = () => {
      menu.remove();
      document.removeEventListener("click", closeMenu);
    };
    setTimeout(() => document.addEventListener("click", closeMenu), 0);
  };

  const isTableNested = (cell: HTMLElement): boolean => {
    let parent = cell.parentElement;
    let tableCount = 0;

    while (parent && parent !== editorRef.current) {
      if (parent.tagName === "TABLE") {
        tableCount++;
        if (tableCount > 1) return true;
      }
      parent = parent.parentElement;
    }

    return false;
  };

  const insertNestedTable = (cell: HTMLElement) => {
    const nestedTable = document.createElement("table");
    nestedTable.style.width = "100%";
    nestedTable.style.border = "1px solid #ddd";

    for (let i = 0; i < 2; i++) {
      const row = document.createElement("tr");
      for (let j = 0; j < 2; j++) {
        const td = document.createElement("td");
        td.style.border = "1px solid #ddd";
        td.style.padding = "4px";
        td.innerHTML = "<br>";
        row.appendChild(td);
      }
      nestedTable.appendChild(row);
    }

    cell.innerHTML = "";
    cell.appendChild(nestedTable);
  };

  const insertRow = (cell: HTMLElement, above: boolean) => {
    const row = cell.closest("tr");
    if (!row) return;

    const newRow = row.cloneNode(true) as HTMLElement;
    newRow.querySelectorAll("td").forEach((td) => (td.innerHTML = "<br>"));

    if (above) {
      row.parentNode?.insertBefore(newRow, row);
    } else {
      row.parentNode?.insertBefore(newRow, row.nextSibling);
    }
  };

  const insertColumn = (cell: HTMLElement, left: boolean) => {
    const table = cell.closest("table");
    if (!table) return;

    const cellIndex = Array.from(cell.parentElement!.children).indexOf(cell);
    const rows = table.querySelectorAll("tr");

    rows.forEach((row) => {
      const newCell = document.createElement("td");
      newCell.innerHTML = "<br>";
      newCell.style.border = "1px solid #ddd";
      newCell.style.padding = "4px";
      const targetCell = row.children[cellIndex] as HTMLElement;

      if (left) {
        row.insertBefore(newCell, targetCell);
      } else {
        row.insertBefore(newCell, targetCell.nextSibling);
      }
    });
  };

  const deleteRow = (cell: HTMLElement) => {
    const row = cell.closest("tr");
    const table = row?.closest("table");
    if (!row || !table) return;

    const rows = table.querySelectorAll("tr");
    if (rows.length <= 1) {
      table.remove();
    } else {
      row.remove();
    }
  };

  const deleteColumn = (cell: HTMLElement) => {
    const table = cell.closest("table");
    if (!table) return;

    const cellIndex = Array.from(cell.parentElement!.children).indexOf(cell);
    const rows = table.querySelectorAll("tr");

    const firstRow = rows[0];
    if (firstRow.children.length <= 1) {
      table.remove();
      return;
    }

    rows.forEach((row) => {
      if (row.children[cellIndex]) {
        row.children[cellIndex].remove();
      }
    });
  };

  const deleteTable = (cell: HTMLElement) => {
    const table = cell.closest("table");
    if (table) {
      table.remove();
    }
  };

  const handleSearch = () => {
    if (!searchTerm || !quillRef.current) return;

    clearSearch();

    const text = quillRef.current.getText();
    const regex = new RegExp(searchTerm, "gi");
    let match;
    const matches = [];

    while ((match = regex.exec(text)) !== null) {
      matches.push({ index: match.index, length: searchTerm.length });
    }

    setSearchMatches(matches);
    if (matches.length > 0) {
      highlightMatch(0);
    }
  };

  const highlightMatch = (matchIndex: number) => {
    if (!quillRef.current || matchIndex >= searchMatches.length) return;

    clearSearch();

    searchMatches.forEach((match, idx) => {
      quillRef.current.formatText(
        match.index,
        match.length,
        {
          background: idx === matchIndex ? "#ffff00" : "#ffeb3b",
        },
        "silent"
      );
    });

    setCurrentMatchIndex(matchIndex);
    quillRef.current.setSelection(searchMatches[matchIndex].index, searchMatches[matchIndex].length);
  };

  const clearSearch = () => {
    if (!quillRef.current) return;

    searchMatches.forEach((match) => {
      quillRef.current.formatText(match.index, match.length, { background: false }, "silent");
    });
  };

  const nextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
    highlightMatch(nextIndex);
  };

  const prevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    highlightMatch(prevIndex);
  };

  const loadDocument = async () => {
    try {
      const response = await api.documents.getById(documentId);
      if (!editorRef.current || !quillRef.current) return;
      setTitle(response.document.title);

      if (!response.canEdit && quillRef.current) {
        const toolbars = document.querySelectorAll(".ql-toolbar");
        toolbars.forEach((toolbar) => toolbar.remove());
      }
      quillRef.current.disable();
      canEditRef.current = response.canEdit;
      initials.current = response.initials;
    } catch (error) {
      console.error("Error loading document:", error);
    }
  };

  const saveDocument = async () => {
    if (!quillRef.current) return;
    setIsSaving(true);
    const content = quillRef.current.getContents();
    try {
      await api.documents.updateContent(documentId, content);
      setLastSaved(new Date());
    } catch (error) {
      console.log("Error Saving", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await fetch(`/api/documents/${documentId}/export/pdf`, {
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF');
    }
  };

  const handleExportDOCX = async () => {
    try {
      const response = await fetch(`/api/documents/${documentId}/export/docx`, {
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Error exporting DOCX:', error);
      alert('Failed to export DOCX');
    }
  };

  const handlePrint = () => {
    if (!editorRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print');
      return;
    }

    const editorContent = editorRef.current.querySelector('.ql-editor');
    if (!editorContent) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
          <style>
            @page {
              size: A4;
              margin: 2.54cm;
            }
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #000;
              margin: 0;
              padding: 20px;
            }
            h1 {
              text-align: center;
              margin-bottom: 30px;
              font-size: 24px;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 10px 0;
            }
            td, th {
              border: 1px solid #ddd;
              padding: 8px;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            .ql-align-center {
              text-align: center;
            }
            .ql-align-right {
              text-align: right;
            }
            .ql-align-justify {
              text-align: justify;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          ${editorContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleUndo = () => {
    quillRef.current?.history.undo();
  };

  const handleRedo = () => {
    quillRef.current?.history.redo();
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const handleTitleSave = async () => {
    if (!title.trim()) {
      alert("Title cannot be empty");
      return;
    }
    try {
      await api.documents.updateTitle(documentId, title);
      setIsEditingTitle(false);
    } catch (error) {
      console.error("Error updating title:", error);
      alert("Failed to update title");
    }
  };

  const handleBackToDashboard = async () => {
    router.push("/home");
  };

  const insertTable = () => {
    if (!quillRef.current) return;

    const tableModule = quillRef.current.getModule("table");
    if (!tableModule) return;

    tableModule.insertTable(tableRows, tableCols);
    setShowTablePicker(false);
  };

    const renderFormulas = () => {
    if (typeof window === "undefined") return;

    const editor = editorRef.current;
    if (!editor) return;

    const katexLib = (window as any).katex;
    if (!katexLib) return;

    const nodes = editor.querySelectorAll(".ql-editor .ql-formula");
    nodes.forEach((formulaNode) => {
      const raw = formulaNode as HTMLElement;

      if (raw.dataset.rendered === "true") return;

      const latex = raw.getAttribute("data-value") || raw.textContent?.trim() || "";
      if (!latex) return;
      const wrapper = document.createElement("span");
      wrapper.className = "katex-wrapper";
      wrapper.style.position = "relative";
      wrapper.style.display = "inline-block";

      raw.style.opacity = "0";
      raw.style.position = "absolute";
      raw.style.left = "0";
      raw.style.top = "0";

      // Create a KaTeX output container
      const rendered = document.createElement("span");
      try {
        katexLib.render(latex, rendered, {
          throwOnError: false,
          displayMode: true,
        });
      } catch {
        rendered.textContent = latex;
      }

      // Insert wrapper
      const parent = raw.parentElement;
      if (!parent) return;

      parent.insertBefore(wrapper, raw);
      wrapper.appendChild(raw);
      wrapper.appendChild(rendered);

      raw.dataset.rendered = "true"; 
    });
  };

  const insertMath = () => {
    const quill = quillRef.current;
    if (!quill || !mathLatex.trim()) return;

    const range = quill.getSelection(true);
    const index = range ? range.index : quill.getLength();

    quill.insertEmbed(index, "formula", mathLatex.trim(), "user");
    quill.setSelection(index + 1, 0);
    setMathLatex("");
    setShowMathEditor(false);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  
  const saveSignature = async () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !quillRef.current) return;
    const dataUrl = canvas.toDataURL("image/png");

    const quill = quillRef.current;
    const sel = quill.getSelection(true);
    const index = sel ? sel.index : quill.getLength();

    quill.insertEmbed(index, "image", dataUrl, "user"); 
    quill.setSelection(index + 1, 0, "user"); 

    setShowSignature(false);
    clearSignature();

    
    try{
      await saveDocument(); 
      setLastSaved(new Date()); 
    } catch (err) {
      console.error("Error saving signature:", err);
      alert("Failed to save signature");
    }
  };

  const loadVersions = async () => {
    try {
      const response = await api.versions.getAll(documentId);
      setVersionsList(response.versions || []);
      console.log(response)
    } catch (err) {
      console.error("Failed to load versions", err);
    }
  };

  const loadVersionContent = async (versionId: string | number) => {
    try {
      const response = await api.versions.getById(documentId, versionId);
      setSelectedVersion(response);
    } catch (err) {
      console.error("Failed to load version content", err);
    }
  };

  const restoreVersion = async (versionId: string | number) => {
    const confirmed = window.confirm(
      "Are you sure you want to restore this version? The current contents will be overwritten"
    );

    if (!confirmed) return;

    try {
      const response = await api.versions.restore(documentId, versionId);

      if (response.document.content) {
        quillRef.current.setContents(response.document.content);
      }

      setSelectedVersion(null);
      setShowVersions(false);

      await loadVersions();
    } catch (err) {
      console.error("Failed to restore version", err);
    }
  };

  useEffect(() => {
    if (!selectedVersion) return;

    const initPreview = async () => {
      if (!previewEditorRef.current) return;

      const QuillModule = (await import("quill")).default;

      // Clean up existing preview editor
      // if (previewQuillRef.current) {
      //   previewQuillRef.current = null;
      // }

      // Clear and recreate the container
      // previewEditorRef.current.innerHTML = "";
      // const editorDiv = document.createElement("div");
      // previewEditorRef.current.appendChild(editorDiv);

      // Create read-only Quill instance
      previewQuillRef.current = new QuillModule(previewEditorRef.current, {
        theme: "snow",
        readOnly: true,
        modules: {
          toolbar: false,
        },
      });

      previewQuillRef.current.setContents(selectedVersion.document.content);
    };

    initPreview();
  }, [selectedVersion]);

  useEffect(() => {
    loadVersions();
  }, [documentId]);

  return (
    <EditorUI
      containerRef={containerRef}
      editorRef={editorRef}
      signatureCanvasRef={signatureCanvasRef}
      isFullscreen={isFullscreen}
      isSaving={isSaving}
      lastSaved={lastSaved}
      showExportMenu={showExportMenu}
      title={title}
      isEditingTitle={isEditingTitle}
      showSearch={showSearch}
      searchTerm={searchTerm}
      searchMatches={searchMatches}
      currentMatchIndex={currentMatchIndex}
      showTablePicker={showTablePicker}
      tableRows={tableRows}
      tableCols={tableCols}
      showSignature={showSignature}
      showMathEditor={showMathEditor}
      mathLatex={mathLatex}
      isDrawing={isDrawing}
      setTitle={setTitle}
      setIsEditingTitle={setIsEditingTitle}
      setShowSearch={setShowSearch}
      setSearchTerm={setSearchTerm}
      setShowExportMenu={setShowExportMenu}
      setShowTablePicker={setShowTablePicker}
      setTableRows={setTableRows}
      setTableCols={setTableCols}
      setShowSignature={setShowSignature}
      setShowMathEditor={setShowMathEditor}
      setMathLatex={setMathLatex}
      handleBackToDashboard={handleBackToDashboard}
      saveDocument={saveDocument}
      handleExportPDF={handleExportPDF}
      handleExportDOCX={handleExportDOCX}
      handlePrint={handlePrint}
      handleTitleSave={handleTitleSave}
      handleUndo={handleUndo}
      handleRedo={handleRedo}
      toggleFullscreen={toggleFullscreen}
      handleSearch={handleSearch}
      prevMatch={prevMatch}
      nextMatch={nextMatch}
      insertTable={insertTable}
      insertMath={insertMath}
      startDrawing={startDrawing}
      draw={draw}
      stopDrawing={stopDrawing}
      clearSignature={clearSignature}
      saveSignature={saveSignature}

      //Versions
  showVersions={showVersions}
  versionsList={versionsList}
  selectedVersion={selectedVersion}
  previewEditorRef={previewEditorRef}
  setShowVersions={setShowVersions}
  loadVersionContent={loadVersionContent}
  restoreVersion={restoreVersion}
  setSelectedVersion={setSelectedVersion}
    />
  );
}