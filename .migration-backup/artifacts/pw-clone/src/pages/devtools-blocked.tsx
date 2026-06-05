interface DevToolsBlockedProps {
  strikes: number;
  onDismiss: () => void;
}

export default function DevToolsBlocked({ strikes, onDismiss }: DevToolsBlockedProps) {
  const isRepeat = strikes > 1;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center text-center px-6 select-none">
      {isRepeat ? (
        <>
          <div className="text-[120px] leading-none mb-6" role="img" aria-label="middle finger">
            🖕
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Really?</h1>
          <p className="text-zinc-400 text-lg max-w-md">
            You already know what's here. Close devtools and go study.
          </p>
        </>
      ) : (
        <>
          <div className="text-[100px] leading-none mb-6" role="img" aria-label="stop">
            🚫
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Dev Tools Detected</h1>
          <p className="text-zinc-400 text-lg max-w-md mb-6">
            This app is protected. If you're curious how it's built, just reach out.
          </p>
          <a
            href="https://t.me/nohara_hiroshi"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#229ED9] hover:bg-[#1a8fc4] text-white font-semibold px-6 py-3 rounded-xl transition-colors mb-4"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.667l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.978.892z"/>
            </svg>
            DM me on Telegram — @nohara_hiroshi
          </a>
        </>
      )}

      <button
        onClick={onDismiss}
        className="mt-6 text-zinc-600 hover:text-zinc-400 text-sm transition-colors"
      >
        Close devtools to continue →
      </button>
    </div>
  );
}
