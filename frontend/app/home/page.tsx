"use client";

import { api, DocumentsResponse, DocumentSharesResponse } from "../api";
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
    } catch (error) {
      console.error("Error sharing document:", error);
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
          <span className="bg-gradient-to-r from-purple-600 to-blue-400 text-transparent bg-clip-text">
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
        <div className="flex justify-center">
          <div
            className="cursor-pointer border-2 border-white rounded-xl px-24 py-8 hover:border-blue-500 transition-all"
            onClick={() => setShowModal(true)}
          >
            <div className="p-4 rounded-full bg-blue-500 bg-opacity-10">
              <Image
                className="m-auto"
                src="/new.png"
                alt="Plus Icon"
                width={75}
                height={75}
              />
            </div>
            <h2 className="text-lg font-semibold text-center pt-4 pb-2">
              Create New
            </h2>
          </div>
        </div>

        {/* New document modal */}
        {showModal && (
          <div
            className="fixed inset-0 flex items-center justify-center bg-black-500 backdrop-blur-sm z-50 animate-fadeIn"
            onClick={() => setShowModal(false)}
          >
            <div
              className="modal-card w-96 animate-slideUp"
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
              <div className="flex justify-end">
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

        {/* Existing Documents Section */}
        <h1 className="text-2xl mb-4 ml-2">Your Documents:</h1>
        {documents.length === 0 ? (
          <div className="text-center py-16">
            <h3 className="text-2xl font-semibold mb-2">No documents yet</h3>
            <p className="text-lg opacity-70 mb-6">
              Create your first document to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 justify-items-center gap-4">
            {documents.map((doc) => (
              <div
                key={doc.document_id}
                className="card w-full max-w-100 h-50 relative cursor-pointer"
                onClick={() =>
                  router.push(`/editor/${doc.document_id.toString()}`)
                }
              >
                {/* Title */}
                <h2 className="text-lg font-semibold text-center pt-4 pb-2">
                  {doc.title}
                </h2>

                {/* Owner */}
                <p className="text-center mb-2">Owner: {doc.owner_name}</p>

                {/* Last Modified */}
                <p className="text-sm text-center opacity-70">
                  Last modified:{" "}
                  {new Date(doc.last_modified).toLocaleDateString()}
                </p>

                {/* Edit or View Only */}
                <div className="tooltip-container absolute bottom-0 left-0 -mb-12 -ml-4">
                  <Image
                    src={
                      doc.permission === "edit" || doc.permission === "owner"
                        ? "/editable.png"
                        : "/viewable.png"
                    }
                    alt="Permission Icon"
                    width={35}
                    height={35}
                  ></Image>
                  <span className="tooltip-text">
                    {doc.permission === "edit" || doc.permission === "owner"
                      ? "Can Edit"
                      : "View Only"}
                  </span>
                </div>

                {/* Delete */}
                {doc.permission === "owner" && (
                  <button
                    className="delete-button absolute p-8 top-2 right-2"
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
                )}

                {/* More Options */}
                {doc.permission === "owner" && (
                  <button
                    className="more-options-button absolute bottom-2 right-2"
                    onClick={async (e) => {
                      e.stopPropagation();
                      setSelectDocId(doc.document_id);
                      setRenameTitle(doc.title);
                      setShowOptionsModal(true);

                      //Fetch shared users
                      try {
                        const response = await api.documents.getAllSharedUsers(
                          doc.document_id
                        );
                        console.log(
                          "Shared users response:",
                          response.shared_users
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
                      width={30}
                      height={30}
                    />
                  </button>
                )}
              </div>
            ))}

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
                    <button onClick={handleRenameDocument}>Rename</button>
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
                    <button className="w-full" onClick={handleShareDocument}>
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
                                {user.permission}
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
      </div>
    </>
  );
}
