"use client";

export default function VideoBackground() {
  return (
    <>
      <video
        className="video-bg"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260315_073750_51473149-4350-4920-ae24-c8214286f323.mp4"
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="fixed inset-0 z-[1] bg-black/40" />
    </>
  );
}
