"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../api";
import "quill/dist/quill.snow.css";
import "./style/globals.css";

export default function Editor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);
  const params = useParams();
  const documentId = params.documentId as string;
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      editorRef.current &&
      !quillRef.current
    ) {
      import("quill").then((Quill) => {
        if (!quillRef.current && editorRef.current) {
          quillRef.current = new Quill.default(editorRef.current!, {
            theme: "snow",
            modules: {
              toolbar: [
                [{ header: [1, 2, false] }],
                ["bold", "italic", "underline"],
                ["image", "code-block"],
              ],
            },
          });
        }
        loadDocument();
      });
    }
    return () => {
      if (quillRef.current) {
        quillRef.current.disable();
        quillRef.current = null;
      }
    };
  }, []);

  const loadDocument = async () => {
    try {
      const response = await api.documents.getById(documentId);
      if (response.document.content && quillRef.current) {
        quillRef.current.setContents(response.document.content);
      }
    } catch (error) {
      console.error("Error loading document:", error);
    }
  };

  //Save document
  const saveDocument = async () => {
    setIsSaving(true);
    const content = quillRef.current.getContents();
    try {
        await api.documents.updateContent(documentId, content);
        setLastSaved(new Date());
        console.log("Saved");
    }
    catch (error) {
        console.log("Error Saving", error);
    }
    finally {
        setIsSaving(true);
    }
  }


  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white px4">
      <div ref={containerRef} className="w-full max-w-2xl border">
        {" "}
        <div ref={editorRef} className="border rounded-lg shadow-md" />{" "}

        {/* Save Button */}
        <button className="mt-4" onClick={saveDocument} disabled={isSaving}>
          Save
        </button>

        {/* Last Saved */}
        {lastSaved && (
            <p className="mt2 text-sm text-gray-500">
                Last Saved: {lastSaved.toLocaleTimeString()}
            </p>
        )}
      </div>
    </div>
  );
}
