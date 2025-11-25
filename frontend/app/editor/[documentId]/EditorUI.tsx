import React from "react";
import Image from "next/image";

interface EditorUIProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  editorRef: React.RefObject<HTMLDivElement | null>;
  signatureCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  isFullscreen: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  showExportMenu: boolean;
  title: string;
  isEditingTitle: boolean;
  showSearch: boolean;
  searchTerm: string;
  searchMatches: any[];
  currentMatchIndex: number;
  showTablePicker: boolean;
  tableRows: number;
  tableCols: number;
  showSignature: boolean;
  showMathEditor: boolean;
  mathLatex: string;
  isDrawing: boolean;
  setTitle: (title: string) => void;
  setIsEditingTitle: (editing: boolean) => void;
  setShowSearch: (show: boolean) => void;
  setSearchTerm: (term: string) => void;
  setShowExportMenu: (show: boolean) => void;
  setShowTablePicker: (show: boolean) => void;
  setTableRows: (rows: number) => void;
  setTableCols: (cols: number) => void;
  setShowSignature: (show: boolean) => void;
  setShowMathEditor: (show: boolean) => void;
  setMathLatex: (latex: string) => void;
  handleBackToDashboard: () => void;
  saveDocument: () => void;
  handleExportPDF: () => void;
  handleExportDOCX: () => void;
  handlePrint: () => void;
  handleTitleSave: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  toggleFullscreen: () => void;
  handleSearch: () => void;
  prevMatch: () => void;
  nextMatch: () => void;
  insertTable: () => void;
  insertMath: () => void;
  startDrawing: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  draw: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  stopDrawing: () => void;
  clearSignature: () => void;
  saveSignature: () => void;

  versionsList: any[];
  selectedVersion: any | null;
  showVersions: boolean;
  setShowVersions: (show: boolean) => void;
  loadVersionContent: (versionId: string | number) => void;
  restoreVersion: (versionId: string | number) => void;
  previewEditorRef: React.RefObject<HTMLDivElement | null>;
  setSelectedVersion: (version: any | null) => void;
}

export default function EditorUI({
  containerRef,
  editorRef,
  signatureCanvasRef,
  isFullscreen,
  isSaving,
  lastSaved,
  showExportMenu,
  title,
  isEditingTitle,
  showSearch,
  searchTerm,
  searchMatches,
  currentMatchIndex,
  showTablePicker,
  tableRows,
  tableCols,
  showSignature,
  showMathEditor,
  mathLatex,
  isDrawing,
  setTitle,
  setIsEditingTitle,
  setShowSearch,
  setSearchTerm,
  setShowExportMenu,
  setShowTablePicker,
  setTableRows,
  setTableCols,
  setShowSignature,
  setShowMathEditor,
  setMathLatex,
  handleBackToDashboard,
  saveDocument,
  handleExportPDF,
  handleExportDOCX,
  handlePrint,
  handleTitleSave,
  handleUndo,
  handleRedo,
  toggleFullscreen,
  handleSearch,
  prevMatch,
  nextMatch,
  insertTable,
  insertMath,
  startDrawing,
  draw,
  stopDrawing,
  clearSignature,
  saveSignature,

  // Versions props
  versionsList,
  selectedVersion,
  setSelectedVersion,
  showVersions,
  setShowVersions,
  loadVersionContent,
  restoreVersion,
  previewEditorRef,
}: EditorUIProps) {
  return (
    <div
      ref={containerRef}
      className={`flex flex-col ${
        isFullscreen ? "h-screen" : "min-h-screen"
      } bg-gray-50`}
    >
      {/* Header */}
      <div className="bg-gray-900 text-white flex items-center justify-between px-6 py-4 shadow-lg">
        <div className="flex items-center gap-2">
          <button
            onClick={handleBackToDashboard}
            className="px-4 py-2 text-sm font-medium bg-gray-800 hover:bg-gray-700 rounded-md transition"
          >
            ← Back
          </button>
          <button
            className="px-4 py-2 text-sm font-medium bg-gray-800 hover:bg-gray-700 rounded-md disabled:opacity-50 transition"
            onClick={saveDocument}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "💾 Save"}
          </button>

          {/* Export Dropdown */}
          <div className="relative export-dropdown">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="px-4 py-2 text-sm font-medium bg-gray-800 hover:bg-gray-700 rounded-md transition"
              title="Export document"
            >
              📥 Export
            </button>
            {showExportMenu && (
              <div className="absolute left-0 mt-2 w-44 bg-white text-gray-900 border border-gray-300 rounded-md shadow-lg z-50">
                <button
                  onClick={handleExportPDF}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                >
                  📄 Export as PDF
                </button>
                <button
                  onClick={handleExportDOCX}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                >
                  📝 Export as DOCX
                </button>
                <button
                  onClick={handlePrint}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                >
                  🖨️ Print
                </button>
              </div>
            )}
          </div>

          {lastSaved && (
            <p className="text-sm text-gray-300">
              Saved at {lastSaved.toLocaleTimeString()}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isEditingTitle ? (
            <>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="px-3 py-1 text-lg font-semibold bg-gray-800 text-white border border-gray-600 rounded"
                autoFocus
              />
              <button
                onClick={handleTitleSave}
                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded transition"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditingTitle(false)}
                className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold">{title}</h1>
              <button
                onClick={() => setIsEditingTitle(true)}
                className="px-2 py-1 text-xs hover:bg-gray-800 rounded transition"
              >
                ✏️
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            className="px-3 py-2 text-sm font-medium bg-gray-800 hover:bg-gray-700 rounded-md transition"
            title="Undo (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            onClick={handleRedo}
            className="px-3 py-2 text-sm font-medium bg-gray-800 hover:bg-gray-700 rounded-md transition"
            title="Redo (Ctrl+Y)"
          >
            ↷
          </button>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="px-3 py-2 text-sm font-medium bg-gray-800 hover:bg-gray-700 rounded-md transition"
            title="Find (Ctrl+F)"
          >
            🔍
          </button>
          <button
            onClick={toggleFullscreen}
            className="px-3 py-2 text-sm font-medium bg-gray-800 hover:bg-gray-700 rounded-md transition"
          >
            {isFullscreen ? "⊗" : "⛶"}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="bg-gray-900 text-white flex items-center gap-3 px-6 py-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search..."
            className="px-3 py-1 bg-gray-800 text-white border border-gray-600 rounded"
            autoFocus
          />
          <button
            onClick={handleSearch}
            className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded-md"
          >
            Search
          </button>
          <button
            onClick={prevMatch}
            className="px-2 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded-md"
          >
            ↑
          </button>
          <button
            onClick={nextMatch}
            className="px-2 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded-md"
          >
            ↓
          </button>
          <span className="text-sm text-gray-300">
            {searchMatches.length > 0
              ? `${currentMatchIndex + 1} of ${searchMatches.length}`
              : "No matches"}
          </span>
          <button
            onClick={() => {
              setShowSearch(false);
            }}
            className="px-2 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded-md"
          >
            ✕
          </button>
        </div>
      )}

      {/* Table Picker */}
      {showTablePicker && (
        <div className="bg-gray-900 text-white flex items-center gap-3 px-6 py-3">
          <span className="text-sm">Table Size:</span>
          <input
            type="number"
            min="1"
            max="5"
            value={tableRows}
            onChange={(e) =>
              setTableRows(
                Math.min(5, Math.max(1, parseInt(e.target.value) || 1))
              )
            }
            className="w-16 px-2 py-1 bg-gray-800 text-white border border-gray-600 rounded"
            placeholder="Rows"
          />
          <span className="text-sm">×</span>
          <input
            type="number"
            min="1"
            max="5"
            value={tableCols}
            onChange={(e) =>
              setTableCols(
                Math.min(5, Math.max(1, parseInt(e.target.value) || 1))
              )
            }
            className="w-16 px-2 py-1 bg-gray-800 text-white border border-gray-600 rounded"
            placeholder="Cols"
          />
          <button
            onClick={insertTable}
            className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded-md"
          >
            Insert
          </button>
          <button
            onClick={() => setShowTablePicker(false)}
            className="px-2 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded-md"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-1">
        {/* Version Side Bar */}
        <div className="w-56 p-4">
          <button
            className="w-full flex items-center gap-4 my-4 !bg-gray-500"
            onClick={() => setShowVersions(!showVersions)}
          >
            {" "}
            <Image
              src={showVersions ? "/to-down.png" : "/to-right.png"}
              alt={showVersions ? "arrow-down" : "arrow-right"}
              width={25}
              height={25}
              className=""
            />
            <span>Versions</span>
          </button>

          {showVersions && (
            <div className="overflow-y-auto h-full">
              {versionsList.length === 0 ? (
                <p>No Version to Display</p>
              ) : (
                <div className="space-y-2">
                  {versionsList.map((version, index) => (
                    <div
                      key={version.version_id}
                      onClick={() => loadVersionContent(version.version_id)}
                      className={`rounded-lg p-3 cursor-pointer border-1 ${
                        selectedVersion?.document?.version_id ===
                        version.version_id
                          ? "bg-blue-100 border-blue-500 border-2"
                          : "bg-gray-100 border-gray-500"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-black">
                          Version {version.version_number}
                        </span>
                        {index === 0 && (
                          <span className="text-sm p-1 bg-green-500 text-white rounded-lg">
                            Latest
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-700 my-1">
                        {new Date(version.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {selectedVersion && (
                <div className="mt-4 pt-4 border-t border-gray-300">
                  <button
                    className="w-full mb-2 !bg-green-600"
                    onClick={() =>
                      restoreVersion(selectedVersion.document?.version_id)
                    }
                  >
                    Restore Version
                  </button>
                  <button
                    className="w-full !bg-gray-300"
                    onClick={() => setSelectedVersion(null)}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Math Editor Modal */}
        {showMathEditor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full">
              <h2 className="text-xl font-bold mb-4 text-black">
                Math Editor (LaTeX)
              </h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter LaTeX formula:
                </label>
                <textarea
                  value={mathLatex}
                  onChange={(e) => setMathLatex(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-black font-mono"
                  rows={4}
                  placeholder="e.g., x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}"
                />
              </div>
              <div className="mb-4 p-4 bg-gray-50 rounded border border-gray-200 min-h-[80px] flex items-center justify-center">
                <div>
                  <p className="text-sm text-gray-600 mb-2 text-center">
                    Preview:
                  </p>
                  <div
                    className="text-center text-black text-lg"
                    id="math-preview-container"
                  >
                    {mathLatex ? (
                      <span
                        ref={(el) => {
                          if (el && (window as any).katex) {
                            try {
                              (window as any).katex.render(mathLatex, el, {
                                throwOnError: false,
                                displayMode: true,
                              });
                            } catch (e) {
                              el.textContent = "Invalid LaTeX syntax";
                            }
                          }
                        }}
                      ></span>
                    ) : (
                      <span className="text-gray-400 italic text-sm">
                        Enter a formula to see preview
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mb-4 p-3 bg-blue-50 rounded">
                <p className="text-xs text-gray-700 mb-1 font-semibold">
                  Common LaTeX Examples:
                </p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>
                    • Fraction:{" "}
                    <code className="bg-white px-1">
                      \frac{"{numerator}"}
                      {"{denominator}"}
                    </code>
                  </li>
                  <li>
                    • Square root:{" "}
                    <code className="bg-white px-1">\sqrt{"{x}"}</code>
                  </li>
                  <li>
                    • Superscript:{" "}
                    <code className="bg-white px-1">x^{"{2}"}</code>
                  </li>
                  <li>
                    • Subscript:{" "}
                    <code className="bg-white px-1">x_{"{1}"}</code>
                  </li>
                  <li>
                    • Sum:{" "}
                    <code className="bg-white px-1">
                      \sum_{"{i=1}"}^{"{n}"}
                    </code>
                  </li>
                  <li>
                    • Integral:{" "}
                    <code className="bg-white px-1">
                      \int_{"{a}"}^{"{b}"}
                    </code>
                  </li>
                </ul>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={insertMath}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  disabled={!mathLatex.trim()}
                >
                  Insert
                </button>
                <button
                  onClick={() => {
                    setShowMathEditor(false);
                    setMathLatex("");
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Signature Modal */}
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
                <button
                  onClick={clearSignature}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md"
                >
                  Clear
                </button>
                <button
                  onClick={saveSignature}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md"
                >
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
        {/* Editor Content Area */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            {/* Main Editor */}
            <div
              ref={editorRef}
              className="bg-white border rounded-lg shadow-sm min-h-[500px]"
            />
            {/* Version Editor */}
            {selectedVersion && (
              <div className="mt-6 p-4 border-2 border-blue-500 rounded-lg bg-blue-100">
                <h3 className="font-bold text-black mb-4">
                  Previewing Version {selectedVersion.document?.version_number}
                </h3>
                <div ref={previewEditorRef} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Styles */}
      <style jsx global>{`
        body {
          background-color: #f3f4f6 !important;
        }

        .ql-container {
          background-color: white !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 0.5rem !important;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1) !important;
        }

        .ql-toolbar {
          background-color: white !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 0.5rem 0.5rem 0 0 !important;
          border-bottom: none !important;
        }

        .ql-editor {
          min-height: 500px;
          font-size: 14px;
          background-color: white !important;
          padding: 2rem !important;
        }

        .ql-toolbar button {
          width: 28px !important;
          height: 28px !important;
          padding: 3px !important;
        }

        .ql-editor table {
          border-collapse: collapse;
          width: 100%;
          margin: 10px 0;
        }

        .ql-editor td,
        .ql-editor th {
          border: 1px solid #ddd;
          padding: 8px;
          min-width: 50px;
        }

        .table-context-menu {
          position: absolute;
          background: white;
          border: 1px solid #ccc;
          border-radius: 4px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
          padding: 4px 0;
          z-index: 1000;
        }

        .table-context-menu button {
          display: block;
          width: 100%;
          padding: 8px 16px;
          text-align: left;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
        }

        .table-context-menu button:hover {
          background: #f0f0f0;
        }

        /* Formula rendering */
        .ql-formula {
          cursor: pointer;
        }

        @media print {
          .ql-toolbar {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
