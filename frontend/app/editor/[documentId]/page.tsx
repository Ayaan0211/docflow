"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
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

        // establish rtc connection
        if (!rtcRef.current) {
          rtcRef.current = new DocRTC(Number(documentId), (delta: any) => {
            quillRef.current?.updateContents(delta);
          });
          rtcRef.current.connect();
        }
        // listen for local deltas and send them to server
        quillRef.current.on("text-change", (delta: any, oldDelta: any, source: string) => {
          if (source === "user") rtcRef.current?.sendDelta(delta);
        });
      });
    }
    return () => {
      if (quillRef.current) {
        quillRef.current.disable();
        quillRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleUnload = () => rtcRef.current?.leave();
    window.addEventListener(`beforeunload`, handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      rtcRef.current?.leave();
    };
  }, []);

  const loadDocument = async () => {
    try {
      const response = await api.documents.getById(documentId);
      if (response.document.content && quillRef.current) {
        quillRef.current.setContents(response.document.content);
      }
      // disable editor if only view perms
      if (!response.canEdit && quillRef.current) {
        quillRef.current.disable();
        document.querySelector(".ql-toolbar")?.remove();
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
        setIsSaving(false);
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
