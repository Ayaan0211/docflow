# DocFlow 

## Links

- Deployed URL: https://project-docflow.amazingcloud.space/

> Provide the link to your youtube video. Please make sure the link works. (REMOVE THIS AFTER)
- Video URL: 

## Project Description

> Docflow is a real-time collaborative document editor that works just like Google Docs, allowing multiple people to edit the same document at the same time. Users can use their google account to login. The editor includes all the essential formatting tools you'd expect - bold, italic, underline, headings, lists, tables, and even mathematical equations. You can insert images, add e-signatures with a drawing tool, and search through your documents to quickly find what you need. Usual shortcuts like ctrl+f to find, ctrl+z to undo and others work just like all google doc users are used to. Everything saves automatically as you type, and there's export options to download your work as a PDF or Word document. The version history feature lets you go back and see previous versions of your document, perfect for when you need to undo major changes or see what the document looked like last week. You can share documents with specific people and control whether they can edit or just view your work. The app works smoothly even when multiple people are typing at once so you'll never lose your work or have conflicts between edits. There are ready made templates for everyone to use or you can simply import PDFs. 

## Development

> Leaving deployment aside, explain how the app is built. Please describe the overall code design and be specific about the programming languages, framework, libraries and third-party api that you have used. (REMOVE THIS AFTER)
> 
> Docflow is built using fully JavaScript/TypeScript. The frontend is build with Next.js (React + TypeScript), and the backend is built with Node.js (Typescript), with using Postgres as our database.

> - **Frontend (Next.js + React + Typescript)**
>   - The app’s UI is built with **Next.js (App Router)** and **client-side React** components. We use hooks like `useState`, `useEffect`, `useRef`, and `useParams` for state, lifecycle, and routing.
>   - The editor runs entirely client-side because Quill, KaTeX, and WebRTC do not work in SSR environments.

> - **Rich Text Editor (Quill)**
>   - Quill is the core text editor, extended with modules for history, tables, formulas, cursors, and custom keyboard behavior.
>   - The toolbar includes formatting tools, tables, math, images, and custom editor controls.
>
>  - **Math & Formula Support (KaTeX)**
>    - Inline and block LaTeX equations are rendered using **KaTeX**.
>    - A math editor modal allows users to type LaTeX and insert formulas as Quill embeds.

> - **E-Signature**
>   - A canvas-based modal lets users draw signatures with mouse or touch, which are inserted as images into the editor.

> - **Search, Tables, and UX Tools**
>   - Client-side text search, match navigation, and highlighting use Quill text + formatting APIs.
>   - Tables support row/column actions, nested tables, and custom selection interactions.
>   - Keyboard shortcuts, fullscreen mode, print mode, and autosaving are implemented as UI helpers on top of the editor.
  
> - **Routing & UX Flow**  
>   - Home/dashboard and auth pages run entirely in the browser: session check → redirect, modals for create/upload/share, and client-side pagination.

> - **State & Components**  
>   - Local React state + refs for UI (modals, forms, file selection, templates, shared users, pagination, toasts/message box).  
>   - Presentational layout uses small, focused components and modal patterns (create doc, file upload, options, share).

> - **API client (client-side wrapper)**  
>   - Lightweight `apiFetch` wrapper around `fetch` (JSON handling, credentials).  
>   - Uses `FormData` for file uploads and `navigator.sendBeacon` for reliable unload signals where needed.

> - **Document UX features**  
>   - Templates system (pre-seeded Quill delta content), file-upload flow (PDF → editable doc), create/rename/delete/share flows, and visual doc cards with permissions UI.

> - **Auth & Social Login**  
>   - Email/password signup & signin forms with inline validation and UX toasts.  
>   - Google OAuth initiated via a client redirect to the provider.

> - **Beacons**
>   - One thing we realized is that when exiting the tab, closing the browser or going home while being in live editor is that it leaves the channel open in the backend (even if we close it on client side). Using a normal get request to the backend to close the connection in the backend did not suffice because the request always fails to send when essentially `unload` occurs. This leads to determinatal memory leaks and expensive memory usage in the backend having all these rooms and open data channels, as well as messing up any saves of the document from the live editing session. To counteract this, we had to use `beacons` to send a post request to the backend to leave the room/close the WebRTC data channel on the backend. `Beacons` were almost guarnteed to alwyas send even in the case of unloads.

> **On the backend, Docflow runs an node.js server using Express (using `router` to help modularize code).** 
> - **Database Connection**
>   - For all initializations, queries and CRUD logic we use `pg` as a gateway to our Postgres instance.
> - **Middleware**
>   - We use `validator` for sanitizing all data being sent in the request body.
> - **Authentication**
>   - For Local Auth we use `bcrypt` for handling salt + hash, and hash compare functions.
>   - For OAuth (Google) we use `Passport`.
> - **Document Uploads**
>   - For uploading files to be processed into editable documents we use `multer` to handle uploading and third-party API call to `openAI` to process (we found better success with `openAI` than OCR models). We also use libraries like `path` to help parse filenames and other information.
> - **Most HTTP Routes**
>   - Most HTTP routes consist a lot of atabase querying using `pg`. We also use `Delta` from `quill-delta` in conjunction with `isEqual` from `lodash.isequal` to help see notice differences between old versions of documents and new versions.
> - **PDF Export (PDFKit)**
>   - Creates a `PDFDocument` and streams it directly to the response.
>   - Converts Quill Delta text (`op.insert`) into PDF text blocks.
>   - Writes the title, then body content, and finalizes with `pdfDoc.end()`.
>
> - **DOCX Export (docx library)**
>   - Builds a DOCX file in memory using `Paragraph` + `TextRun`.
>   - Applies formatting (bold, italics, underline) from Delta attributes.
>   - Uses `Packer.toBuffer()` to generate the file and sends it as a download.
> - **WebRTC**
>   - For handling WebRTC data channel binding, SDP handling, and Ice servers we used `@koush/wrtc` (We had to use this, as many libraries didn't work with macOS, which two out of three memebers were working locally on).
>   - For handling random UUID we used `crypto`.
>   - For handling finding differences (if they exist) between different versions when saving we use `isEqual` from `lodash.isequal`.
>   - We use `Delta` from `quill-delta` extensively to make our own transformation logic using their `compose` and `transform` functions.
> - **OpenAI**
>   - We use `openAI` library alongside `fs` and `path` to send uploaded files to GPT LLM's to process PDF's to quill-delta operations.

> Postgres Database
> - **Tables**
>   - Docflow works off of four tables: `users`, `documents`, `shared_documents`, and `document_versions`. All of the tables were made with proper primary keys, foreign keys, constraints (delete constraints like `cascade` and attribute checks).
>   - Aside from the automatic indexes Postgres makes, Docflows includes four further indexes to further optimize database CRUD operations.

> Turn Servers
> - **Custom Turn Server**
>   - As our VM's backend is only reachable internally through docker containers and not exposed to the real world, we have to use custom turn servers to help connect the backend WebRTC instance to clients. In addition, in the case that clients are behind restrictive firewalls or NATs. We epxlicity made a docker container for our turn server (using `coturn/coturn` docker image) and expose a specific port. For stun servers we opted to use `Google's` free stun server.

## Deployment

> We deployed our application using a NGINX reverse proxy for our node.js backend and next.js frontend. The entire stack runs on isolated docker containers (with only the nginx and turn server containers exposed to the world, all other containers are blocked from outside connections and can only communicate internally). Also, we used LetsEncypt to obtain valid certificates for our website.
> We also integrated github actions in our repository to create a through CI/CD pipeline. It's integrated such that on every push to main it will tear down the the old docker containers, update the code, rebuild docker images, and redeploy the website. This made it so we never have to manually re-deploy anything, which can cause errors when done with multiple people working on the project. In addition, this mean that the website had minimal downtime because of the automatic deplyoment.


## Challenges

>What is the top 3 most challenging things that you have learned/developed for you app? Please restrict your answer to only three items. 

1. Getting the WebRTC to connect between clients and server. This was really hard as instead of using Y.js or websockets we opted to use WebRTC. In addition, insteaf of P2P, we opted to use Multipoint Control Unit (MCU). Learning about turn and ice servers to allow communication between data channels was hard (we also had to learn about concepts like SDP responses between channels), as well as having a WebRTC data connection in the backend as WebRTC's main focus isn't server-side usage. 
2. Getting the real-time syncs was a major challenging part of this project, aside from having the inital connections being handled correctly, correclty syncing deltas across all users took a lot of time. We had to implement our own transformation logic use quill's transform functions instead of using a library like shareDB to sync edits in real time (shareDB worked well with Y.js, so we could not use it), load logic (snapshots), leave logic, etc.
3. Creating a reliable versioning system required work on both ends of the stack. On the backend, we store fully serialized Quill Deltas for every saved version, compare versions using `lodash.isequal`, and maintain incremental version numbers while avoiding duplicate saves. On the frontend, we built UI flows for restoring versions, previewing snapshots, and replacing the editor state cleanly without breaking the live WebRTC session. Ensuring restored versions integrated safely with ongoing real-time edits was one of the hardest architectural problems in the project.

## Contributions

> Describe the contribution of each team member to the project. Please provide the full name of each team member (but no student number).

> - Milen Thomas
>   - All database, deployment, Github (Actions) logic.
>   - All backend code (HTTP routes, third-party API calls) except for export PDF http routes.
>   - WebRTC (frontend/backend; joining, leaving, real-time sync, snapshots) logic.

> - Amaan Batla
>   - Created login/signup page with the UI
>   - Worked with the text editor to add features from quill based on documentation like Katex, E-signature and etc

> - Ayaan Islam
>   - TODO 

## One more thing? 

> Any additional comment you want to share with the course staff
