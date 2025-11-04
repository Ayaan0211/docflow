import FileCard from "./FileCard";
import NewFileCard from "./NewFileCard";

export default function Hero() {
  const files = [
    { title: "Doc1.txt", modified: "2025-10-30" },
    { title: "Doc2.txt", modified: "2025-10-31" },
    { title: "Doc3.txt", modified: "2025-11-01" },
    { title: "Doc4.txt", modified: "2025-11-02" },
    { title: "Doc1.txt", modified: "2025-10-30" },
    { title: "Doc2.txt", modified: "2025-10-31" },
    { title: "Doc3.txt", modified: "2025-11-01" },
    { title: "Doc4.txt", modified: "2025-11-02" }
  ];

  return (
    <div className="p-8">

      <div className="flex justify-center">
        <NewFileCard />
      </div>

      <h1 className="text-lg italic">Modify Existing Documents:</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 justify-items-center gap-4">
        {files.map((file, index) => (
          <FileCard key={index} title={file.title} modified={file.modified} />
        ))}
      </div>

    </div>
  );
}
