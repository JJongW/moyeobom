export default function Loading() {
  return (
    <div className="pt-6 space-y-3" aria-busy="true" aria-label="불러오는 중">
      <div className="skeleton h-8 w-2/3" />
      <div className="skeleton h-5 w-1/2" />
      {[0, 1, 2].map((i) => <div key={i} className="skeleton h-40 w-full !rounded-[20px]" />)}
    </div>
  );
}
