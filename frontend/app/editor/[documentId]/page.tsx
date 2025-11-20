"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, rtc } from "../../api";
import "quill/dist/quill.snow.css";
import "./style/globals.css";
import { DocRTC } from "./rtcClient";

export default function Editor() {
  const rtcRef = useRef<DocRTC | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);
  const params = useParams();
  const router = useRouter();
  const documentId = params.documentId as string;
  const [isSaving, setIsSaving] = useState(false);
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
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const canEditRef = useRef<boolean>(false);
  const toolbarAddedRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!editorRef.current || quillRef.current) return;

    let mounted = true;

    const initQuill = async () => {
      const QuillModule = (await import("quill")).default;
      const DeltaModule = (await import("quill-delta")).default;

      if (!mounted || !editorRef.current) return;

      const QuillTable = QuillModule.import("modules/table");
      QuillModule.register("modules/table", QuillTable);

      // const customBindings = {
      //   enterInTable: {
      //     key: 13,
      //     handler: function (this: any, range: any) {
      //       const [line] = this.quill.getLine(range.index);
      //       if (line && line.domNode && line.domNode.closest("td")) {
      //         this.quill.insertText(range.index, "\n");
      //         this.quill.setSelection(range.index + 1);
      //         return false;
      //       }
      //       return true;
      //     },
      //   },
      // };

      const toolbarOptions = [
        [{ header: [1, 2, 3, false] }],
        [{ size: ["small", false, "large", "huge"] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ align: [] }],
        ["blockquote", "code-block"],
        ["link", "image"],
        ["clean"],
      ];

      quillRef.current = new QuillModule(editorRef.current, {
        theme: "snow",
        modules: {
          toolbar: {
            container: toolbarOptions,
          },
          keyboard: {
            // bindings: customBindings,
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
          // addCustomToolbarButtons();
          addTooltips();
          toolbarAddedRef.current = true;
        }
        // setupTableContextMenu();
        // setupTableSelection();
      }, 100);

      let applyingRemote = false;
      let snapshotApplied = false;
      let queuedDeltas: any[] = [];

      if (!rtcRef.current && mounted) {
        rtcRef.current = new DocRTC(Number(documentId), (deltaOrSnapshot, version) => {
          if (!quillRef.current) return;
          if (!snapshotApplied) {
            snapshotApplied = true;
            applyingRemote = true;
            const currentCursorRange = quillRef.current.getSelection();
            quillRef.current.setContents(deltaOrSnapshot, "api");
            if (currentCursorRange) {
              const transformedIndex = deltaOrSnapshot.transformPosition(currentCursorRange.index, true);
              quillRef.current.setSelection(transformedIndex, 0, "api")
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
          applyingRemote = true;
          const curr = quillRef.current.getContents();
          const newDoc = curr.compose(deltaOrSnapshot);
          quillRef.current.setContents(newDoc, "api");
          applyingRemote = false;
        });
        rtcRef.current.connect();
      }

      quillRef.current.on("text-change", (delta: any, oldDelta: any, source: string) => {
        if (!snapshotApplied) return;
        if (source === "user" && !applyingRemote) {
          rtcRef.current?.sendDelta(delta);
        }
      });
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

  // const addCustomToolbarButtons = () => {
  //   const toolbars = document.querySelectorAll(".ql-toolbar");
  //   if (toolbars.length === 0) return;

  //   const toolbar = toolbars[0];
    
  //   const existingTable = toolbar.querySelector(".ql-table");
  //   const existingSign = toolbar.querySelector(".ql-signature");
    
  //   if (existingTable || existingSign) return;

  //   const tableBtn = document.createElement("button");
  //   tableBtn.className = "ql-table";
  //   tableBtn.innerHTML = "⊞";
  //   tableBtn.title = "Insert Table";
  //   tableBtn.type = "button";
  //   tableBtn.onclick = (e) => {
  //     e.preventDefault();
  //     setShowTablePicker(!showTablePicker);
  //   };

  //   const signBtn = document.createElement("button");
  //   signBtn.className = "ql-signature";
  //   signBtn.innerHTML = "✍️";
  //   signBtn.title = "E-Signature";
  //   signBtn.type = "button";
  //   signBtn.onclick = (e) => {
  //     e.preventDefault();
  //     setShowSignature(true);
  //   };

  //   toolbar.appendChild(tableBtn);
  //   toolbar.appendChild(signBtn);
  // };

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

  // const setupTableSelection = () => {
  //   if (!editorRef.current) return;

  //   const handleMouseOver = (e: Event) => {
  //     const target = e.target as HTMLElement;
  //     const table = target.closest("table");

  //     if (table) {
  //       const cells = table.querySelectorAll("td");
  //       cells.forEach((cell) => {
  //         (cell as HTMLElement).style.backgroundColor = "#e3f2fd";
  //       });
  //     }
  //   };

    // const handleMouseOut = (e: Event) => {
    //   const target = e.target as HTMLElement;
    //   const table = target.closest("table");

    //   if (table) {
    //     const cells = table.querySelectorAll("td");
    //     cells.forEach((cell) => {
    //       (cell as HTMLElement).style.backgroundColor = "";
    //     });
    //   }
    // };

    // const handleClick = (e: Event) => {
    //   const target = e.target as HTMLElement;
    //   const table = target.closest("table");

    //   if (table && (e as MouseEvent).ctrlKey) {
    //     e.preventDefault();
    //     selectTable(table);
    //   }
    // };

    // editorRef.current.addEventListener("mouseover", handleMouseOver);
    // editorRef.current.addEventListener("mouseout", handleMouseOut);
    // editorRef.current.addEventListener("click", handleClick);
  // };

  // const selectTable = (table: HTMLElement) => {
  //   const cells = table.querySelectorAll("td");
  //   cells.forEach((cell) => {
  //     (cell as HTMLElement).style.backgroundColor = "#2196f3";
  //     (cell as HTMLElement).style.color = "#ffffff";
  //   });

  //   setTimeout(() => {
  //     cells.forEach((cell) => {
  //       (cell as HTMLElement).style.backgroundColor = "";
  //       (cell as HTMLElement).style.color = "";
  //     });
  //   }, 300);
  // };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
        clearSearch();
      }
      // if ((e.key === "Delete" || e.key === "Backspace") && document.activeElement?.closest("table")) {
      //   const selection = quillRef.current?.getSelection();
      //   if (selection) {
      //     const [line] = quillRef.current.getLine(selection.index);
      //     const table = line?.domNode?.closest("table");
      //     if (table && e.ctrlKey) {
      //       e.preventDefault();
      //       table.remove();
      //     }
      //   }
      // }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSearch]);

  useEffect(() => {
    const handleUnload = () => rtcRef.current?.leave();
    window.addEventListener(`beforeunload`, handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      rtcRef.current?.leave();
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // const setupTableContextMenu = () => {
  //   if (!editorRef.current) return;

  //   const handleContextMenu = (e: Event) => {
  //     const target = e.target as HTMLElement;
  //     const cell = target.closest("td");

  //     if (cell) {
  //       e.preventDefault();
  //       showTableContextMenu(e as MouseEvent, cell);
  //     }
  //   };

  //   editorRef.current.addEventListener("contextmenu", handleContextMenu);
  // };

  // const showTableContextMenu = (e: MouseEvent, cell: HTMLElement) => {
  //   const existingMenu = document.querySelector(".table-context-menu");
  //   if (existingMenu) existingMenu.remove();

  //   const menu = document.createElement("div");
  //   menu.className = "table-context-menu";
  //   menu.style.left = `${e.pageX}px`;
  //   menu.style.top = `${e.pageY}px`;

  //   const isNested = isTableNested(cell);

  //   const options = [
  //     { label: "Insert Row Above", action: () => insertRow(cell, true) },
  //     { label: "Insert Row Below", action: () => insertRow(cell, false) },
  //     { label: "Insert Column Left", action: () => insertColumn(cell, true) },
  //     { label: "Insert Column Right", action: () => insertColumn(cell, false) },
  //     { label: "Delete Row", action: () => deleteRow(cell) },
  //     { label: "Delete Column", action: () => deleteColumn(cell) },
  //     { label: "Delete Table", action: () => deleteTable(cell) },
  //   ];

  //   if (!isNested) {
  //     options.push({
  //       label: "Insert Nested Table (2×2)",
  //       action: () => insertNestedTable(cell),
  //     });
  //   }

  //   options.forEach((option) => {
  //     const btn = document.createElement("button");
  //     btn.textContent = option.label;

  //     btn.onclick = () => {
  //       option.action();
  //       menu.remove();
  //     };
  //     menu.appendChild(btn);
  //   });

  //   document.body.appendChild(menu);

  //   const closeMenu = () => {
  //     menu.remove();
  //     document.removeEventListener("click", closeMenu);
  //   };
  //   setTimeout(() => document.addEventListener("click", closeMenu), 0);
  // };

  // const isTableNested = (cell: HTMLElement): boolean => {
  //   let parent = cell.parentElement;
  //   let tableCount = 0;

  //   while (parent && parent !== editorRef.current) {
  //     if (parent.tagName === "TABLE") {
  //       tableCount++;
  //       if (tableCount > 1) return true;
  //     }
  //     parent = parent.parentElement;
  //   }

  //   return false;
  // };

  // const insertNestedTable = (cell: HTMLElement) => {
  //   const nestedTable = document.createElement("table");
  //   nestedTable.style.width = "100%";
  //   nestedTable.style.border = "1px solid #ddd";

  //   for (let i = 0; i < 2; i++) {
  //     const row = document.createElement("tr");
  //     for (let j = 0; j < 2; j++) {
  //       const td = document.createElement("td");
  //       td.style.border = "1px solid #ddd";
  //       td.style.padding = "4px";
  //       td.innerHTML = "<br>";
  //       row.appendChild(td);
  //     }
  //     nestedTable.appendChild(row);
  //   }

  //   cell.innerHTML = "";
  //   cell.appendChild(nestedTable);
  // };

  // const insertRow = (cell: HTMLElement, above: boolean) => {
  //   const row = cell.closest("tr");
  //   if (!row) return;

  //   const newRow = row.cloneNode(true) as HTMLElement;
  //   newRow.querySelectorAll("td").forEach((td) => (td.innerHTML = "<br>"));

  //   if (above) {
  //     row.parentNode?.insertBefore(newRow, row);
  //   } else {
  //     row.parentNode?.insertBefore(newRow, row.nextSibling);
  //   }
  // };

  // const insertColumn = (cell: HTMLElement, left: boolean) => {
  //   const table = cell.closest("table");
  //   if (!table) return;

  //   const cellIndex = Array.from(cell.parentElement!.children).indexOf(cell);
  //   const rows = table.querySelectorAll("tr");

  //   rows.forEach((row) => {
  //     const newCell = document.createElement("td");
  //     newCell.innerHTML = "<br>";
  //     newCell.style.border = "1px solid #ddd";
  //     newCell.style.padding = "4px";
  //     const targetCell = row.children[cellIndex] as HTMLElement;

  //     if (left) {
  //       row.insertBefore(newCell, targetCell);
  //     } else {
  //       row.insertBefore(newCell, targetCell.nextSibling);
  //     }
  //   });
  // };

  // const deleteRow = (cell: HTMLElement) => {
  //   const row = cell.closest("tr");
  //   const table = row?.closest("table");
  //   if (!row || !table) return;

  //   const rows = table.querySelectorAll("tr");
  //   if (rows.length <= 1) {
  //     table.remove();
  //   } else {
  //     row.remove();
  //   }
  // };

  // const deleteColumn = (cell: HTMLElement) => {
  //   const table = cell.closest("table");
  //   if (!table) return;

  //   const cellIndex = Array.from(cell.parentElement!.children).indexOf(cell);
  //   const rows = table.querySelectorAll("tr");

  //   const firstRow = rows[0];
  //   if (firstRow.children.length <= 1) {
  //     table.remove();
  //     return;
  //   }

  //   rows.forEach((row) => {
  //     if (row.children[cellIndex]) {
  //       row.children[cellIndex].remove();
  //     }
  //   });
  // };

  // const deleteTable = (cell: HTMLElement) => {
  //   const table = cell.closest("table");
  //   if (table) {
  //     table.remove();
  //   }
  // };

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
    await saveDocument();
    router.push("/home");
  };

  // const insertTable = () => {
  //   if (!quillRef.current) return;

  //   const tableModule = quillRef.current.getModule("table");
  //   if (!tableModule) return;

  //   tableModule.insertTable(tableRows, tableCols);
  //   setShowTablePicker(false);
  // };

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

  const saveSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !quillRef.current) return;

    const dataUrl = canvas.toDataURL("image/png");
    const range = quillRef.current.getSelection(true);
    quillRef.current.insertEmbed(range.index, "image", dataUrl);

    setShowSignature(false);
    clearSignature();
  };

  return (
    <div ref={containerRef} className={`flex flex-col ${isFullscreen ? "h-screen" : "min-h-screen"} bg-white`}>
      <div className="header-dark flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <button onClick={handleBackToDashboard} className="px-4 py-2 text-sm font-medium rounded-md">
            ← Back
          </button>
          <button className="px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50" onClick={saveDocument} disabled={isSaving}>
            {isSaving ? "Saving..." : "💾 Save"}
          </button>
          {lastSaved && <p className="text-sm">{lastSaved.toLocaleTimeString()}</p>}
        </div>

        <div className="flex items-center gap-2">
          {isEditingTitle ? (
            <>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="px-3 py-1 text-lg font-semibold bg-black text-white border border-gray-600 rounded"
                autoFocus
              />
              <button onClick={handleTitleSave} className="px-3 py-1 text-sm rounded">
                Save
              </button>
              <button onClick={() => setIsEditingTitle(false)} className="px-3 py-1 text-sm rounded">
                Cancel
              </button>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold">{title}</h1>
              <button onClick={() => setIsEditingTitle(true)} className="px-2 py-1 text-xs">
                ✏️
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleUndo} className="px-3 py-2 text-sm font-medium rounded-md" title="Undo (Ctrl+Z)">
            ↶
          </button>
          <button onClick={handleRedo} className="px-3 py-2 text-sm font-medium rounded-md" title="Redo (Ctrl+Y)">
            ↷
          </button>
          <button onClick={() => setShowSearch(!showSearch)} className="px-3 py-2 text-sm font-medium rounded-md" title="Find (Ctrl+F)">
            🔍
          </button>
          <button onClick={toggleFullscreen} className="px-3 py-2 text-sm font-medium rounded-md">
            {isFullscreen ? "⊗" : "⛶"}
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="header-dark flex items-center gap-3 px-6 py-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search..."
            className="px-3 py-1 bg-black text-white border border-gray-600 rounded"
            autoFocus
          />
          <button onClick={handleSearch} className="px-3 py-1 text-sm rounded-md">
            Search
          </button>
          <button onClick={prevMatch} className="px-2 py-1 text-sm rounded-md">
            ↑
          </button>
          <button onClick={nextMatch} className="px-2 py-1 text-sm rounded-md">
            ↓
          </button>
          <span className="text-sm">
            {searchMatches.length > 0 ? `${currentMatchIndex + 1} of ${searchMatches.length}` : "No matches"}
          </span>
          <button
            onClick={() => {
              setShowSearch(false);
              clearSearch();
            }}
            className="px-2 py-1 text-sm rounded-md"
          >
            ✕
          </button>
        </div>
      )}
      {/*
      {showTablePicker && (
        <div className="header-dark flex items-center gap-3 px-6 py-3">
          <span className="text-sm">Table Size:</span>
          <input
            type="number"
            min="1"
            max="5"
            value={tableRows}
            onChange={(e) => setTableRows(Math.min(5, Math.max(1, parseInt(e.target.value) || 1)))}
            className="w-16 px-2 py-1 bg-black text-white border border-gray-600 rounded"
            placeholder="Rows"
          />
          <span className="text-sm">×</span>
          <input
            type="number"
            min="1"
            max="5"
            value={tableCols}
            onChange={(e) => setTableCols(Math.min(5, Math.max(1, parseInt(e.target.value) || 1)))}
            className="w-16 px-2 py-1 bg-black text-white border border-gray-600 rounded"
            placeholder="Cols"
          />
          <button onClick={insertTable} className="px-3 py-1 text-sm rounded-md">
            Insert
          </button>
          <button onClick={() => setShowTablePicker(false)} className="px-2 py-1 text-sm rounded-md">
            ✕
          </button>
        </div>
      )}
      */}

      {showSignature && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <h2 className="text-xl font-bold mb-4 text-black">E-Signature</h2>
            <canvas
              ref={signatureCanvasRef}
              width={500}
              height={200}
              className="border-2 border-gray-300 bg-white cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
            <div className="flex gap-3 mt-4">
              <button onClick={clearSignature} className="px-4 py-2 bg-gray-500 text-white rounded-md">
                Clear
              </button>
              <button onClick={saveSignature} className="px-4 py-2 bg-blue-600 text-white rounded-md">
                Done
              </button>
              <button
                onClick={() => {
                  setShowSignature(false);
                  clearSignature();
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div ref={editorRef} className="bg-white border rounded-lg shadow-sm min-h-[500px]" />
        </div>
      </div>
    </div>
  );
}