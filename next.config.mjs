/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // thezonebio.com/agora 경로에서 서빙된다 (thezonebio.com이 이 앱으로 rewrite 프록시).
  // 에셋/라우트가 전부 /agora 아래로 정렬되어야 프록시 :path* 규칙에 걸린다.
  basePath: "/agora",
  // 로컬에서 dev 서버를 여러 개 띄울 때 .next 충돌을 피하기 위한 선택적 오버라이드 (Vercel엔 영향 없음).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
