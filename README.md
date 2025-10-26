# C09 Docs

## Project Description

C09 Docs is a collaborative web application modeled after Google Docs. Users can create, save, rename, and delete text documents, and collaborate with other users in real time. Each user may own multiple documents, which can be shared with others via permission controls or shareable links. Our core goal is to implement persistent real-time updates and seamless collaboration for multiple concurrent users[web:1].

## Key Features (Beta Version)

- **User Authentication**  
  Support for local account login and third-party sign-in with Google[web:1].

- **Document Storage and Retrieval**  
  - Save and fetch documents from the user-specific database  
  - Create, rename, and delete documents

- **Rich Text Editor**  
  - Basic text formatting including bold, underline, etc.  
  - Consideration for auto-save functionality

- **Real-Time Collaboration**  
  - Multi-user editing with instant updates across all user sessions

- **Deployment**  
  - Full deployment on the team’s Virtual Machine (VM)

## Additional Features (Final Version)

- **Document Sharing**  
  - Generate links for view/edit access

- **Version Tracking**  
  - Browse and revert to previous document versions

- **Comments**  
  - Add comments and suggestions directly in docs

- **UI/UX Enhancements**  
  - Refined design with external libraries for a clean interface

## Tech Stack

| Layer       | Technology                                |
|-------------|-------------------------------------------|
| Frontend    | Next.js (Single Page Application)         |
| Backend     | Express.js                                |
| Text Editor | Quill.js                                  |
| Realtime    | Socket.io                                 |
| Database    | PostgreSQL                                |
| Auth        | NextAuth.js                               |
| Deployment  | Docker + Nginx (Reverse Proxy) on VM      |

## Top 5 Technical Challenges

1. **Real-Time Updates**  
   - Ensuring reliable, conflict-free realtime editing for multiple users  
   - Safeguarding against overwrites and latency issues[web:1]

2. **Database Logic**  
   - Maintaining secure document sharing permissions  
   - Supporting simultaneous multi-document work and persistence

3. **Version Tracking**  
   - Defining and capturing document versions with multi-user edits  
   - Efficient retrieval and display of version history

4. **Text Editor Features**  
   - Prioritizing and implementing essential editor functions  
   - Considering advanced options like export file types, font settings, etc.

5. **Scalability**  
   - Maintaining fast response and smooth user experience as documents/user count grows  
   - Experimenting with database frequency and document rendering optimizations

## Team Members

- Milen Thomas
- Amaan Batla
- Ayaan Islam

---

