C09 Docs

Project Description:
	Our project is essentially a clone of Google Docs and its features. The web application will allow users to create, save, and delete text documents, alongside the ability to collaborate with other users in real-time. Each user can have multiple documents that can be shared with other registered users with links or permissions. The focus of this project is the build an application that implements real-time updates with data that persists for numerous users at once.
	
Key Features for Beta Version:
User Authentication
Local login alongside third-party login with Google
Document Storage and Retrieval
Save and fetch document content from the database specific to each user
Create, rename, and delete documents
Rich Text Editor
Have all basic text formatting (bold, underline, etc.)
Auto-save functionality?
Real-Time Collaboration
Ability to have multiple users editing the same files with real-time updates for all users editing
Deployment
Fully deploy on the team’s VM.

Additional Features for Final Version:
Document Sharing
Create shareable links to view and/or edit documents
Version Tracking
Be able to view and go back to previous versions of documents
Comments
Add comments/suggestions to documents
Clean UI/UX with external libraries

Tech Stack:
Frontend (SPA) - Next.js
Backend - Express.js
TextEditor - Quils.js
Real-Time Updates - Socket.io (JS library)
Database - PostgreSQL
Auth - NextAuth.js
Deployment - Docker + Nginx Reverse Proxy on VM


Top 5 Technical Challenges:
Real-Time Updates
Configuring websockets to handle multiple users editing the same document will be really difficult. We have to make sure each user writes are being recorded, processed, and displayed to every user on the document. We also have to make sure it doesn’t get overwritten by other user inputs.
Database Logic
We have to make sure that sharing permission persists in the database, allowing users who share their document with other users to actually access and/or work on said document. Also, it should be able to handle multiple documents for a user to keep in storage, and be able to work on multiple documents in different tabs without loss of data/features.
Version Tracking
We have to set up a measure as to what defines a version to showcase the version history of a document, being mindful of the fact that multiple people can edit the document. We have to store and be able to retrieve and display all the versions of a document reliably and efficiently.
Text Editor Features
We have to decide what and how many text editor features we implement into our application. We need to decide if it will be worth it to implement advanced features such as converting to different file types (ie, .pdf, .docx, .txt, etc.), formatting elements, font options (size, colour, styles), etc. 
Scalability 
As document size or active users increase, we need to make sure our application does not degrade performance-wise. This may require experimenting with options such as modifying database writes/pulls frequency, document rendering, etc.

Members:
Amaan Batla
Ayaan Islam
Milen Thomas 
