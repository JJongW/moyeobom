import type { Metadata } from "next";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "개인정보 안내" };

export default function Privacy() {
  const del = process.env.PILOT_DELETE_DATE;
  return (
    <article className="pt-5 space-y-4">
      <h1 className="text-[26px] font-extrabold">개인정보 안내</h1>
      <div className="card p-5 space-y-4 text-[15px] leading-relaxed">
        <section>
          <h2 className="font-bold mb-1">받는 정보</h2>
          <p>닉네임, 모집글 내용, 지원 메시지, 연락방 링크. 이름·이메일·전화번호는 받지 않아요. 비밀번호는 되돌릴 수 없는 형태(해시)로만 저장해요.</p>
        </section>
        <section>
          <h2 className="font-bold mb-1">자동으로 남는 정보</h2>
          <p>이 브라우저를 알아보기 위한 무작위 쿠키 1개, 도배를 막기 위한 접속 IP의 해시(원래 IP는 저장하지 않음), 서비스 개선을 위한 익명 이용 기록.</p>
        </section>
        <section>
          <h2 className="font-bold mb-1">누가 볼 수 있나요</h2>
          <p>모집글은 링크를 가진 누구나 볼 수 있어요. 지원 메시지는 방장만, 연락방 링크는 방장과 수락된 사람만 볼 수 있어요.</p>
        </section>
        <section>
          <h2 className="font-bold mb-1">언제 지우나요</h2>
          <p>{del ? `${formatDate(del)}에 모든 글과 지원을 지워요.` : "테스트가 끝나면 모든 글과 지원을 지워요."} 그 전이라도 방장은 자기 글을 지울 수 있고, 지원자는 지원을 취소할 수 있어요.</p>
        </section>
        <p className="text-text-3 text-[13px]">테스트용 서비스예요. 정식 운영 전에는 법률 검토를 거쳐 이 안내를 보완해야 해요.</p>
      </div>
    </article>
  );
}
