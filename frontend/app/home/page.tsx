// import Header from "../../components/Header";
// import Hero from "../../components/Hero";
import Image from "next/image";
import "./style/globals.css";

const files = [
  { title: "Doc1.txt", modified: "2025-10-30" },
  { title: "Doc2.txt", modified: "2025-10-31" },
  { title: "Doc3.txt", modified: "2025-11-01" },
  { title: "Doc4.txt", modified: "2025-11-02" },
  { title: "Doc5.txt", modified: "2025-10-30" },
  { title: "Doc6.txt", modified: "2025-10-31" },
  { title: "Doc7.txt", modified: "2025-11-01" },
  { title: "Doc8.txt", modified: "2025-11-02" },
];

export default function Home() {
  return (
    <>
      <header className="bg-[var(--card)] text-[var(--text)] grid grid-cols-3 items-center px-4 py-6 shadow-md sticky top-0">
        <div>Currently Signed in As: Test User</div>
        <h1 className="text-[var(--text)] text-center text-3xl font-bold underline italic">
          DocFlow
        </h1>
        <div className="text-right">
          <button className="bg-[var(--accent)] hover:bg-blue-600 px-4 py-3 text-white rounded-full">
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
          <div className="border bg-[var(--card)] p-4 m-2 rounded-xl shadow-lg hover:bg-[#2563EB] w-100 h-50 flex flex-col">
            <h2 className="text-lg font-semibol text-gray-500 text-center pt-4 pb-2">
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

        <h1 className="text-lg italic">Modify Existing Documents:</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 justify-items-center gap-4">
          {files.map((file) => (
            <div
              key={file.title}
              className="border border-white bg-[var(--card)] p-4 m-2 rounded-xl shadow-lg hover:bg-[#1a1d21] w-full max-w-100 h-50 flex flex-col"
            >
              <h2 className="text-lg font-semibold text-center pt-4 pb-2">
                {file.title}
              </h2>
              <p className="text-sm text-gray-500 text-center">
                Last modified: {file.modified}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
