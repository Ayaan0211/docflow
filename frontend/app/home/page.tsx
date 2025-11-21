"use client";

import { api, DocumentsResponse, DocumentSharesResponse } from "../api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import "./style/globals.css";
import { templates } from "../templates";

export default function Home() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);

  //Create document modal states
  const [showModal, setShowModal] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [documents, setDocuments] = useState<DocumentsResponse["documents"]>(
    []
  );

  //More options modal states
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  //Rename doc states
  const [renameTitle, setRenameTitle] = useState("");
  const [selectDocId, setSelectDocId] = useState<number | null>(null);

  //Share doc states
  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState<"view" | "edit">(
    "view"
  );

  //Doc permissions states
  const [sharedUsers, setSharedUsers] = useState<
    DocumentSharesResponse["shared_users"]
  >([]);

  //File upload states
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  //Template States
  const [selectedTemplate, setSelectedTemplate] = useState("blank");

  const templatesList = [
    { id: "blank", name: "Blank", image: "/blank-page.png" },
    { id: "resume", name: "Resume", image: "/resume.png" },
    { id: "letter", name: "Letter", image: "/cover-letter.png" },
    { id: "meetingNotes", name: "Meeting Notes", image: "/notes.png" },
    { id: "fileUpload", name: "File Upload", image: "/file-upload.png" },
  ];

  useEffect(() => {
    document.title = "Home - DocFlow";
  });

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

  const showMessage = (msg: string) => {
    const box = document.getElementById("message-box");
    if (!box) return;
    box.textContent = msg;
    box.classList.remove("visible");
    void box.offsetWidth;
    box.classList.add("visible");
    setTimeout(() => box.classList.remove("visible"), 3000);
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
    if (docTitle.trim() === "") {
      showMessage("Title cannot be empty!");
      return;
    }

    const ops =
      templates[selectedTemplate as keyof typeof templates]?.data?.ops || [];
    const data = { ops: ops };

    try {
      const newDoc = await api.documents.create(docTitle, data);
      console.log("Document created:", newDoc);
      setShowModal(false);
      setDocTitle("");
      await fetchDocuments();
    } catch (error) {
      console.error("Error creating document:", error);
    }
    setShowModal(false);
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      showMessage("Please select a file");
      return;
    }

    try {
      const response = await api.documents.upload(selectedFile);
      console.log("Document uploaded", response);
      setShowFileUpload(false);
      setSelectedFile(null);
      await fetchDocuments();
    } catch (error) {
      console.error("Error uploading document:", error);
    }
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
      setShareEmail("");
      setSharePermission("view");
      const response = await api.documents.getAllSharedUsers(selectDocId);
      setSharedUsers(response.shared_users);
      await fetchDocuments();
    } catch (error: any) {
      console.error("Error sharing document:", error);
      const errorMessage = error.message;
      if (errorMessage.includes("is not a valid user")) {
        showMessage("Error: User does not exist");
      } else {
        showMessage("Error: not a valid email address");
      }
    }
  };

  const handleUpdatePermission = async (
    userEmail: string,
    newPermission: "view" | "edit"
  ) => {
    try {
      await api.documents.share(selectDocId!, userEmail, newPermission);
      console.log("Updated permission for", userEmail);

      const response = await api.documents.getAllSharedUsers(selectDocId!);
      setSharedUsers(response.shared_users);
    } catch (error) {
      console.log("Error updating permission:", error);
    }
  };

  return (
    <>
      <div id="message-box">Message Placeholder</div>
      {/* Header */}
      <header className="grid grid-cols-3 items-center px-4 py-6 shadow-md sticky top-0">
        <div className="flex items-center gap-2 ml-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-ml font-bold">{username ?? "..."}</span>
        </div>

        <h1 className="text-center text-4xl font-bold">
          <span className="bg-gradient-to-r from-purple-600 to-blue-400 text-transparent bg-clip-text italic">
            DocFlow
          </span>
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

      {/* Hero */}
      <div className="typewriter text-center py-12">
        <h1 className="text-3xl">Welcome, {username} 👋</h1>
        <p className="text-lg opacity-75">
          Create, Modify, Manage your Documents
        </p>
      </div>

      {/* Create new document */}
      <div className="p-2">
        <div className="w-[85%] mx-auto mb-16">
          <h3 className="text-xl mt-8 mb-4">Create a new Document:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 justify-items-center">
            {templatesList.map((template) => {
              const isSelected = selectedTemplate === template.id;
              return (
                <div
                  key={template.id}
                  className={`create-new cursor-pointer border-2 rounded-xl px-8 py-6 hover:border-blue-500 transition-all w-full max-w-sm ${
                    isSelected ? "border-blue-500" : "border-gray-300"
                  }`}
                  onClick={() => {
                    if (template.id === "fileUpload") {
                      setShowFileUpload(true);
                    } else {
                      setSelectedTemplate(template.id);
                      setShowModal(true);
                    }
                  }}
                >
                  <div className="p-4 rounded-full bg-blue-500 mx-auto w-fit">
                    <Image
                      src={template.image}
                      alt={`${template.name} Preview`}
                      width={50}
                      height={50}
                      className="object-cover"
                    />
                  </div>
                  <p className="text-center font-medium">{template.name}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* New document modal */}
        {showModal && (
          <div
            className="fixed inset-0 flex items-center justify-center bg-black-500 backdrop-blur-sm z-50 animate-fadeIn"
            onClick={() => setShowModal(false)}
          >
            <div
              className="modal-card w-108 animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">Create New Document</h2>
              <input
                type="text"
                placeholder="Document Title"
                className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateDocument();
                }}
              />

              <div className="flex justify-end mt-4">
                <button className="mr-2" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button
                  className="border-2 border-white"
                  onClick={handleCreateDocument}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* File Upload Modal */}
        {showFileUpload && (
          <div
            className="fixed inset-0 flex items-center justify-center bg-black-500 backdrop-blur-sm z-50 animate-fadeIn"
            onClick={() => setShowFileUpload(false)}
          >
            <div
              className="modal-card w-108 animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">Upload File</h2>
              <input
                type="file"
                accept=".pdf, .docx, .doc, .txt"
                className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file)
                  }
                }}
              />

              {selectedFile && (
                <p>Selected: {selectedFile.name}</p>
              )}

              <div className="flex justify-end mt-4">
                <button className="mr-2" onClick={() => {
                  setShowFileUpload(false);
                  setSelectedFile(null);
                  }}>
                  Cancel
                </button>
                <button
                  className="border-2 border-white"
                  onClick={handleFileUpload}
                  disabled={!selectedFile}
                >
                  Upload
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Existing Documents Section */}
        <div className="w-[85%] mx-auto">
          <h3 className="text-xl font-semibold mt-8 mb-4">
            Modify an existing Document:
          </h3>
          {documents.length === 0 ? (
            <div className="text-center py-16">
              <h3 className="text-2xl font-semibold mb-2">No documents yet</h3>
              <p className="text-lg opacity-70 mb-6">
                Create your first document to get started
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 justify-items-center">
              {documents.map((doc) => (
                <div
                  key={doc.document_id}
                  className="doc-card p-6 border rounded-md border-white hover:border-blue-500 relative cursor-pointer w-full max-w-sm"
                  onClick={() =>
                    router.push(`/editor/${doc.document_id.toString()}`)
                  }
                >
                  {/* Doc Info */}
                  <div className="flex items-center gap-4 mb-4 max-w-[75%]">
                    <div className="w-12 h-12 rounded-md flex items-center justify-center bg-gradient-to-r from-purple-600 to-blue-400">
                      {doc.title.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <h2
                        className="text-lg font-semibold text-left truncate"
                        title={doc.title}
                      >
                        {doc.title}
                      </h2>
                      <p className="text-sm opacity-70 text-left truncate">
                        Owner: {doc.owner_name}
                        {doc.owner_name === username ? " (You)" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Last Modified */}
                  <p className="text-sm text-center opacity-70 text-left mb-4">
                    Modified: {new Date(doc.last_modified).toDateString()}
                  </p>

                  {/* Permissions Icon */}
                  <div className="tooltip-container absolute bottom-0 left-0 -mb-6 -ml-4">
                    <Image
                      src={
                        doc.permission === "edit" || doc.permission === "owner"
                          ? "/editable.png"
                          : "/viewable.png"
                      }
                      alt="Permission Icon"
                      width={35}
                      height={35}
                      className="brightness-0 invert opacity-90"
                    ></Image>
                    <span className="tooltip-text">
                      {doc.permission === "edit" || doc.permission === "owner"
                        ? "Can Edit"
                        : "View Only"}
                    </span>
                  </div>

                  {/* Permissions Buttons */}
                  {doc.permission === "owner" && (
                    <div className="absolute top-2 right-2 flex gap-2">
                      <button
                        className="more-options-button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          setSelectDocId(doc.document_id);
                          setRenameTitle(doc.title);
                          setShowOptionsModal(true);

                          //Fetch shared users
                          try {
                            const response =
                              await api.documents.getAllSharedUsers(
                                doc.document_id
                              );
                            setSharedUsers(response.shared_users);
                          } catch (error) {
                            console.log("Error fetching users", error);
                            setSharedUsers([]);
                          }
                        }}
                      >
                        <Image
                          className="inline-block"
                          src="/setting.png"
                          alt="More Options Icon"
                          width={25}
                          height={20}
                        />
                      </button>

                      <button
                        className="delete-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDocument(doc.document_id.toString());
                        }}
                      >
                        <Image
                          className="m-auto"
                          src="/x.png"
                          alt="Delete Icon"
                          width={20}
                          height={20}
                        />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Options Modal */}
              {showOptionsModal && selectDocId !== null && (
                <div
                  className="fixed inset-0 flex items-center justify-center bg-black-500 backdrop-blur-sm z-50 animate-fadeIn"
                  onClick={() => setShowOptionsModal(false)}
                >
                  <div
                    className="modal-card p-6 rounded shadow-lg w-96 animate-slideUp"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Rename Section */}
                    <h2 className="text-xl font-bold mb-4">Rename Doc</h2>
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
                        onClick={() => {
                          setShowOptionsModal(false);
                          setSelectDocId(null);
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRenameDocument}
                        className="border-2 border-white"
                      >
                        Rename
                      </button>
                    </div>

                    <hr className="my-4 border-gray-300" />

                    {/* Share Section */}
                    <div className="mb-6">
                      <h3 className="text-xl font-bold mb-4">Share Document</h3>
                      <input
                        type="email"
                        placeholder="Recipient's Email"
                        className="w-full border border-gray-300 rounded px-3 py-2 mb-2"
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                      />
                      <select
                        className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
                        value={sharePermission}
                        onChange={(e) =>
                          setSharePermission(e.target.value as "view" | "edit")
                        }
                      >
                        <option value="view">View Only</option>
                        <option value="edit">Edit</option>
                      </select>
                      <button
                        className="w-full border-2 border-white"
                        onClick={handleShareDocument}
                      >
                        Share
                      </button>
                    </div>

                    <hr className="my-4 border-gray-300" />

                    {/* Shared Users Section */}
                    <div className="mb-4">
                      <h2 className="text-xl font-bold mb-4">Shared With:</h2>

                      {/* Shared Users List */}
                      <div>
                        {sharedUsers.length === 0 ? (
                          <p>This document has not been shared yet</p>
                        ) : (
                          sharedUsers.map((user) => (
                            <div
                              key={user.email}
                              className="flex items-center justify-between p-3 "
                            >
                              <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="font-small text-gray-500">
                                  {user.permission === "view"
                                    ? "Viewer"
                                    : "Editor"}
                                </p>
                              </div>

                              {/* Modify permissions */}
                              <div className="flex items-center gap-2">
                                <select
                                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                                  value={user.permission}
                                  onChange={(e) => {
                                    handleUpdatePermission(
                                      user.email,
                                      e.target.value as "view" | "edit"
                                    );
                                  }}
                                >
                                  <option value="view">View</option>
                                  <option value="edit">Edit</option>
                                </select>

                                {/* Delete Shared User */}
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();

                                    try {
                                      await api.documents.removeSharedUser(
                                        selectDocId,
                                        user.email
                                      );

                                      const response =
                                        await api.documents.getAllSharedUsers(
                                          selectDocId
                                        );
                                      setSharedUsers(response.shared_users);
                                    } catch (error) {
                                      console.log("Error removing user", error);
                                    }
                                  }}
                                >
                                  <Image
                                    src="/x.png"
                                    alt="Remove"
                                    width={16}
                                    height={16}
                                  />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Close Button */}
                      <div>
                        <button
                          className="mt-4"
                          onClick={() => {
                            setShowOptionsModal(false);
                            setSelectDocId(null);
                            setShareEmail("");
                            setSharePermission("view");
                          }}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <div />
        </div>
      </div>
    </>
  );
}
