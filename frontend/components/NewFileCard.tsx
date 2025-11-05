import Image from "next/image";

export default function NewFileCard() {
  return (
    <div className="border bg-[var(--card)] p-4 m-2 rounded-xl shadow-lg hover:bg-[#2563EB] w-100 h-50 flex flex-col">
      <h2 className="text-lg font-semibol text-gray-500 text-center pt-4 pb-2">
        Create New
      </h2>
      <Image
        className="m-auto" src="/create.png" alt="Plus Icon" width={75} height={75}
      />
    </div>
  );
}
