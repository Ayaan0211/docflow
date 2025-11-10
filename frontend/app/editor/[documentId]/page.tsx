"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { api, rtc } from "../../api";
import "quill/dist/quill.snow.css";
import "./style/globals.css";
import { DocRTC } from "./rtcClient";
import Delta from 'quill-delta';

export default function Editor() {
  const rtcRef = useRef<DocRTC | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);
  const params = useParams();
  const documentId = params.documentId as string;
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const canEditRef = useRef<boolean>(false);

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
          quillRef.current.disable();
        }
        let applyingRemote = false;
        let pending = new Delta();
        let snapshotApplied = false;
        let queuedDeltas: any[] = [];


        function isEmpty(d: Delta) { return !d || !d.ops || d.ops.length === 0; }

        function handleRemoteDelta(deltaObj: any) {
          if (!snapshotApplied) {
            queuedDeltas.push(deltaObj);
            return;
          }
          if (!quillRef.current) return;
          const remote = new Delta(deltaObj)
          // trasform remote
          const transformedRemote = isEmpty(pending) ? remote : remote.transform(pending, true);
          applyingRemote = true;
          quillRef.current.updateContents(transformedRemote, "api");
          applyingRemote = false;
          pending = isEmpty(pending) ? pending : pending.transform(transformedRemote, false);
        }

        // establish rtc connection
        if (!rtcRef.current) {
          rtcRef.current = new DocRTC(Number(documentId), (payload: any) => {
            // Only apply incoming changes when not already in a local edit (with batch updates to make it smoother)
            if (!quillRef.current) return;
            if (payload && payload.snapshot) {
              snapshotApplied = true
              applyingRemote = true;
              quillRef.current.setContents(payload.snapshot, "api");
              applyingRemote = false;
              pending = new Delta();
              if (canEditRef.current) quillRef.current.enable();
              for (const d of queuedDeltas) handleRemoteDelta(d);
              queuedDeltas = [];
              return;
            }
            handleRemoteDelta(payload);
          });
          rtcRef.current.connect();
          // only load from api if RTC snapshot hasn't arrived after 2 seconds
          setTimeout(() => {
            if (quillRef.current && quillRef.current.getLength() <= 1) {
              loadDocument();
            }
          }, 2000);
        }
        // listen for local deltas and send them to server
        quillRef.current.on(
          "text-change",
          (delta: any, oldDelta: any, source: string) => {
            if (!snapshotApplied) return;
            if (source === "user" && !applyingRemote) {
              const d = new Delta(delta);
              pending = pending.compose(d);
              rtcRef.current?.sendDelta(d);
            }
          }
        );
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
      // disable editor if only view perms
      if (!response.canEdit && quillRef.current) {
        document.querySelector(".ql-toolbar")?.remove();
      }
      quillRef.current.disable();
      canEditRef.current = response.canEdit;
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
