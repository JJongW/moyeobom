import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card p-8 mt-6 text-center">
      <p className="text-[18px] font-bold">찾을 수 없는 페이지예요</p>
      <p className="mt-1 text-text-2">삭제됐거나 주소가 잘못됐어요.</p>
      <Link href="/" className="btn btn-primary mt-5">보드로 가기</Link>
    </div>
  );
}
