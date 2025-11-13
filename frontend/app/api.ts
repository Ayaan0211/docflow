// api.ts

// small helper for fetch calls
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(endpoint, {
    credentials: process.env.NODE_ENV === "development" ? `include` : 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!res.ok) throw new Error(await res.text() || `Request failed: ${res.status}`);
  return res.json();
}

export interface User {
  username: string;
  email: string;
}

export interface Session {
  isLoggedIn: boolean;
  username: string | null;
}

export interface Document {
  document_id: number;
  owner_id: number;
  title: string;
  content: any;
  last_modified: string;
  created_at: string;
}

export interface DocumentsResponse {
  hasPrev: boolean;
  hasNext: boolean;
  documents: Array<{
    document_id: number;
    owner_id: number;
    title: string;
    last_modified: string;
    owner_name: string;
    permission: string;
  }>;
}

export interface DocumentSharesResponse {
  shared_users: Array<{
    name: string,
    permission: string,
    email: string,
  }>;
  hasPrev: boolean;
  hasNext: boolean;
  document_id: number;
}

export interface Version {
  version_id: number;
  edited_by: number;
  content: any;
  created_at: string;
}

export interface VersionsResponse {
  hasPrev: boolean;
  hasNext: boolean;
  documentId: string;
  versions: Version[];
}

export const auth = {
  signup: (username: string, email: string, password: string) =>
    apiFetch<User>('/api/signup/', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    }),

  signin: (email: string, password: string) =>
    apiFetch<User>('/api/signin/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  signout: async () => {
    await fetch('/api/signout/', { credentials: process.env.NODE_ENV === "development" ? `include` : 'same-origin' });
  },

  getSession: () => apiFetch<Session>('/api/session/'),

  initiateGoogleAuth: () => {
    window.location.href = '/api/oauth2/google/';
  },
};

export const documents = {
  create: (title: string, content: any) =>
    apiFetch<{ document: Document }>('/api/user/documents/', {
      method: 'POST',
      body: JSON.stringify({ title, content }),
    }),

  getAll: (page = 1, maxDocuments = 10) =>
    apiFetch<DocumentsResponse>(`/api/user/documents/?page=${page}&maxDocuments=${maxDocuments}`),

  getById: (documentId: string | number) =>
    apiFetch<{ document: Document, canEdit: boolean }>(`/api/documents/${documentId}/`),

  updateContent: (documentId: string | number, content: any) =>
    apiFetch<{ document: Document }>(`/api/documents/${documentId}/data/content/`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),

  updateTitle: (documentId: string | number, title: string) =>
    apiFetch<{ new_title: string }>(`/api/documents/${documentId}/data/title/`, {
      method: 'PATCH',
      body: JSON.stringify({title}),
    }),

  delete: (documentId: string | number) =>
    apiFetch<{ document: { title: string } }>(`/api/documents/${documentId}/`, {
      method: 'DELETE',
    }),

  share: (documentId: string | number, email: string, permission: 'view' | 'edit') =>
    apiFetch(`/api/user/documents/${documentId}/`, {
      method: 'POST',
      body: JSON.stringify({ email, permission }),
    }),

  removeSharedUser: (documentId: string | number, email: string) =>
    apiFetch<{ removedEmail: string }>(`/api/documents/${documentId}/users/`, {
      method: 'DELETE',
      body: JSON.stringify({ email }),
    }),

  getAllSharedUsers: (documentId: string | number, page = 1, maxSharedUsers = 10) =>
    apiFetch<DocumentSharesResponse>(`/api/documents/${documentId}/shared/?page=${page}&maxSharedUsers=${maxSharedUsers}`),
};

export const versions = {
  getAll: (documentId: string | number, page = 1, maxVersions = 10) =>
    apiFetch<VersionsResponse>(
      `/api/documents/${documentId}/versions/?page=${page}&maxVersions=${maxVersions}`
    ),

  getById: (documentId: string | number, versionId: string | number) =>
    apiFetch(`/api/documents/${documentId}/versions/${versionId}`),

  restore: (documentId: string | number, versionId: string | number) =>
    apiFetch<{ document: Document }>(`/api/documents/${documentId}/versions/${versionId}`, {
      method: 'POST',
    }),
};

export const rtc = {
  join: (documentId: string | number) =>
    apiFetch<RTCSessionDescriptionInit & { peerId: string }>(`/api/documents/${documentId}/data/join/`),

  answer: (documentId: string | number, answer: RTCSessionDescriptionInit) =>
    apiFetch<{ ok: boolean }>(`/api/documents/${documentId}/data/answer/`, {
      method: 'POST',
      body: JSON.stringify(answer),
    }),
};

export const api = { auth, documents, versions, rtc };
