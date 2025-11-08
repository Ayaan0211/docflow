"use client";

import { api, DocumentsResponse } from "../api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import "./style/globals.css";

export default function Home() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);

  //Create document modal states
  const [showModal, setShowModal] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [documents, setDocuments] = useState<DocumentsResponse["documents"]>(
    []
  );

  //Dropdown state
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  //Rename modal states
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [selectDocId, setSelectDocId] = useState<number | null>(null);

  //Share modal states
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState<"view" | "edit">("view");

  useEffect(() => {
    async function loadSession() {
      try {
        const session = await api.auth.getSession();
        if (!session.isLoggedIn) {
          router.push("/login");
          return;
        }
        setUsername(session.username);
      } catch {
        router.push("/login");
      }
    }
    loadSession();
  }, [router]);

  const handleSignout = async () => {
    await api.auth.signout();
    router.push("/login");
  };

  const fetchDocuments = async () => {
    try {
      const response = await api.documents.getAll();
      setDocuments(response.documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleCreateDocument = async () => {
    if (docTitle.trim() === "") return;

    try {
      const newDoc = await api.documents.create(docTitle, []);
      console.log("Document created:", newDoc);
      setShowModal(false);
      setDocTitle("");
      await fetchDocuments();
    } catch (error) {
      console.error("Error creating document:", error);
    }
    setShowModal(false);
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      await api.documents.delete(documentId);
      console.log("Document deleted:", documentId);
      await fetchDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  };

  const handleRenameDocument = async () => {
    if (renameTitle.trim() === "" || selectDocId === null) return;

    try {
      await api.documents.updateTitle(selectDocId, renameTitle);
      console.log("Document renamed:", selectDocId);
      setShowRenameModal(false);
      setRenameTitle("");
      setSelectDocId(null);
      await fetchDocuments();
    } catch (error) {
      console.error("Error renaming document:", error);
    }
  };

  const handleShareDocument = async () => {
    if (shareEmail.trim() === "" || selectDocId === null) return;

    try {
      await api.documents.share(selectDocId, shareEmail, sharePermission);
      console.log("Document shared:", selectDocId);
      setShowShareModal(false);
      setShareEmail("");
      setSharePermission("view");
      setSelectDocId(null);
      await fetchDocuments();
    } catch (error) {
      console.error("Error sharing document:", error);
    }
  }

  return (
    <>
      {/* Header */}
      <header className="grid grid-cols-3 items-center px-4 py-6 shadow-md sticky top-0">
        <div>Currently Signed in As: {username ?? "..."}</div>
        <h1 className="text-[var(--text)] text-center text-3xl font-bold underline italic">
          DocFlow
        </h1>
        <div className="text-right">
          <button
            className="px-4 py-3 text-white rounded-full"
            onClick={handleSignout}
          >
            Signout
            <Image
              className="inline-block ml-2"
              src="/logout.png"
              alt="Signout Icon"
              width={16}
              height={16}
            />
          </button>
        </div>
      </header>

      {/* Create new document */}
      <div className="p-8">
        <div className="flex justify-center">
          <div className="card w-100 h-50" onClick={() => setShowModal(true)}>
            <h2 className="text-lg font-semibold text-center pt-4 pb-2">
              Create New
            </h2>
            <Image
              className="m-auto"
              src="/create.png"
              alt="Plus Icon"
              width={75}
              height={75}
            />
          </div>
        </div>

        {/* New document modal */}
        {showModal && (
          <div
            className="fixed inset-0 flex items-center justify-center bg-black-500 backdrop-blur-sm z-50"
            onClick={() => setShowModal(false)}
          >
            <div
              className="modal-card p-6 rounded shadow-lg w-96"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">Create New Document</h2>
              <input
                type="text"
                placeholder="Document Title"
                className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
              />
              <div className="flex justify-end">
                <button className="mr-2" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button onClick={handleCreateDocument}>Create</button>
              </div>
            </div>
          </div>
        )}

        {/* Rename Document Modal */}
        {showRenameModal && (
          <div
            className="fixed inset-0 flex items-center justify-center bg-black-500 backdrop-blur-sm z-50"
            onClick={() => setShowRenameModal(false)}
          >
            <div
              className="modal-card p-6 rounded shadow-lg w-96"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">Rename Document</h2>
              <input
                type="text"
                placeholder="New Document Title"
                className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
              />
              <div className="flex justify-end">
                <button
                  className="mr-2"
                  onClick={() => setShowRenameModal(false)}
                >
                  Cancel
                </button>
                <button onClick={handleRenameDocument}>Rename</button>
              </div>
            </div>
          </div>
        )}

        {/* Share Document Modal */}
        {showShareModal && (
          <div
            className="fixed inset-0 flex items-center justify-center bg-black-500 backdrop-blur-sm z-50"
            onClick={() => setShowShareModal(false)}
          >
            <div
              className="modal-card p-6 rounded shadow-lg w-96"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">Share Document</h2>
              <input
                type="email"
                placeholder="Recipient's Email"
                className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
              />
              <select
                className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
                value={sharePermission}
                onChange={(e) =>
                  setSharePermission(
                    e.target.value as "view" | "edit"
                  )
                }
              >
                <option value="view">View Only</option>
                <option value="edit">Edit</option>
              </select>
              <div className="flex justify-end">
                <button
                  className="mr-2"
                  onClick={() => setShowShareModal(false)}
                >
                  Cancel
                </button>
                <button onClick={handleShareDocument}>Share</button>
              </div>
            </div>
          </div>
        )}

        {/* Existing Documents Section */}
        <h1 className="text-lg italic mb-4">Modify Existing Documents:</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 justify-items-center gap-4">
          {documents.map((doc) => (
            <div
              key={doc.document_id}
              className="card w-full max-w-100 h-50 relative cursor-pointer"
              onClick={() =>
                router.push(`/editor/${doc.document_id.toString()}`)
                // router.push(`/editorTemp/`)
              }
            >
              <h2 className="text-lg font-semibold text-center pt-4 pb-2">
                {doc.title}
              </h2>
              <p className="text-sm text-center opacity-70">
                Last modified:{" "}
                {new Date(doc.last_modified).toLocaleDateString()}
              </p>
              <button
                className="delete-button absolute top-2 right-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteDocument(doc.document_id.toString());
                }}
              >
                <Image
                  className="m-auto"
                  src="/x.png"
                  alt="Delete Icon"
                  width={25}
                  height={25}
                />
              </button>
              <button
                className="more-options-button absolute bottom-4 right-4"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDropdown(
                    openDropdown === doc.document_id ? null : doc.document_id
                  );
                }}
              >
                <Image
                  className="inline-block"
                  src="/three-dots.png"
                  alt="More Options Icon"
                  width={16}
                  height={16}
                />
              </button>

              {/* More options dropdown */}
              {openDropdown === doc.document_id && (
                <div className="absolute bottom-12 right-4 bg-black shadow-lg rounded p-4 z-20 w-48">
                  <button
                    className="w-full text-left px-2 py-2 hover:bg-gray-100 rounded mb-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectDocId(doc.document_id);
                      setShowRenameModal(true);
                      setOpenDropdown(null);
                    }}
                  >
                    Rename Document
                  </button>
                  <button
                    className="w-full text-left px-2 py-2 hover:bg-gray-100 rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectDocId(doc.document_id);
                      setShowShareModal(true);
                      setOpenDropdown(null);
                    }}
                  >
                    Share Document
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
