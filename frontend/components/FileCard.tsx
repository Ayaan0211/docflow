export default function FileCard({ title = "", modified = "" }) {
  return (
    <div className="border border-white bg-[var(--card)] p-4 m-2 rounded-xl shadow-lg hover:bg-[#1a1d21] w-full max-w-100 h-50 flex flex-col">
      <h2 className="text-lg font-semibold text-center pt-4 pb-2">{title}</h2>
      <p className="text-sm text-gray-500 text-center">Last modified: {modified}</p>
    </div>
  );
}
