'use client'

import { api } from '../api'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import './style/globals.css'

const files = [
  { title: 'Doc1.txt', modified: '2025-10-30' },
  { title: 'Doc2.txt', modified: '2025-10-31' },
  { title: 'Doc3.txt', modified: '2025-11-01' },
  { title: 'Doc4.txt', modified: '2025-11-02' },
  { title: 'Doc5.txt', modified: '2025-10-30' },
  { title: 'Doc6.txt', modified: '2025-10-31' },
  { title: 'Doc7.txt', modified: '2025-11-01' },
  { title: 'Doc8.txt', modified: '2025-11-02' },
]

export default function Home() {
  const router = useRouter()
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    async function loadSession() {
      try {
        const session = await api.auth.getSession()
        if (!session.isLoggedIn) {
          router.push('/login')
          return
        }
        setUsername(session.username)
      } catch {
        router.push('/login')
      }
    }
    loadSession()
  }, [router])

  const handleSignout = async () => {
    await api.auth.signout()
    router.push('/login')
  }

  return (
    <>
      <header className="grid grid-cols-3 items-center px-4 py-6 shadow-md sticky top-0">
        <div>Currently Signed in As: {username ?? '...'}</div>
        <h1 className="text-[var(--text)] text-center text-3xl font-bold underline italic">
          DocFlow
        </h1>
        <div className="text-right">
          <button className="px-4 py-3 text-white rounded-full" onClick={handleSignout}>
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

      <div className="p-8">
        <div className="flex justify-center">
          <div className="card w-100 h-50">
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

        <h1 className="text-lg italic mb-4">Modify Existing Documents:</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 justify-items-center gap-4">
          {files.map((file) => (
            <div key={file.title} className="card w-full max-w-100 h-50">
              <h2 className="text-lg font-semibold text-center pt-4 pb-2">
                {file.title}
              </h2>
              <p className="text-sm text-center opacity-70">
                Last modified: {file.modified}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
