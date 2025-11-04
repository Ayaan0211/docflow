import Image from "next/image";

export default function Header() {
  return (
    <header className="bg-[var(--card)] text-[var(--text)] grid grid-cols-3 items-center px-4 py-6 shadow-md sticky top-0">
      <div>Currently Signed in As: Test User</div>
      <h1 className="text-[var(--text)] text-center text-3xl font-bold underline italic">DocFlow</h1>
      <div className="text-right">
        <button className="bg-[var(--accent)] hover:bg-blue-600 px-4 py-3 text-white rounded-full">
          Signout
          <Image
            className="inline-block ml-2" src="/logout.png" alt="Signout Icon" width={16} height={16}
          />
        </button>
      </div>
    </header>
  );
}
