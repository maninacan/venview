interface Props {
  context: 'report' | 'finalize' | 'history' | 'pdf' | 'multiday' | string;
  onClose: () => void;
}

const CONTEXTS: Record<string, { icon: string; text: string }> = {
  report: { icon: 'fa-solid fa-chart-bar', text: 'Post-Event Reports are a Pro feature.' },
  finalize: { icon: 'fa-solid fa-circle-check', text: 'Starter includes 1 finalized event. Upgrade to track more.' },
  history: { icon: 'fa-solid fa-clipboard-list', text: 'Viewing finalized event history requires Pro.' },
  pdf: { icon: 'fa-solid fa-file-pdf', text: 'PDF export is a Pro feature.' },
  multiday: { icon: 'fa-solid fa-calendar-days', text: 'Starter supports up to 2-day events. Upgrade to Pro for longer festivals.' },
};

export function UpgradeModal({ context, onClose }: Props) {
  const ctx = CONTEXTS[context] ?? { icon: 'fa-solid fa-lock', text: context };

  const featureCheck = 'w-[19px] h-[19px] rounded-full flex items-center justify-center text-[0.7rem] font-bold flex-shrink-0 mt-0.5';

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-[20px] w-full max-w-[480px] overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#0B2A4A] to-[#0A3A67] text-white px-8 py-[26px] text-center">
          <button
            className="absolute top-3.5 right-3.5 bg-transparent border-0 text-[1.1rem] cursor-pointer text-[rgba(255,255,255,0.7)] px-2 py-1 rounded hover:bg-[rgba(255,255,255,0.1)]"
            onClick={onClose}
          ><i className="fa-solid fa-xmark" /></button>
          <div className="inline-block bg-[#FFD84D] text-[#0B2A4A] text-[0.76rem] font-bold px-[11px] py-[3px] rounded-full"><i className="fa-solid fa-bolt" /> Venview Pro</div>
          <h2 className="text-white mt-2 mb-1 text-[1.35rem]">Unlock the complete picture.</h2>
          <p className="text-[rgba(255,255,255,0.78)] text-[0.86rem] m-0">See every event's true profit, track trends over time, and make smarter decisions — faster.</p>
        </div>

        {/* Trigger reason */}
        <div className="flex items-center gap-2 bg-[#fffbeb] border-t border-b border-[#fde68a] px-5 py-2.5 text-[0.84rem] text-[#92400e]">
          <i className={ctx.icon} />
          <span>{ctx.text}</span>
        </div>

        {/* Body */}
        <div className="px-[26px] py-[18px]">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.06em] text-[#64748b] mb-2.5">Everything in Pro</p>
          <ul className="list-none p-0 m-0 mb-3.5 flex flex-col gap-[9px]">
            <li className="flex gap-[11px] items-start">
              <span className={`${featureCheck} bg-[#dbeafe] text-[#1d4ed8]`}>✓</span>
              <div className="text-[0.86rem]"><strong className="block font-semibold mb-[1px]">Post-Event Reports</strong><span className="text-[#64748b] text-[0.82rem]">Full profit &amp; loss breakdown, shareable and printable</span></div>
            </li>
            <li className="flex gap-[11px] items-start">
              <span className={`${featureCheck} bg-[#dcfce7] text-[#166534]`}>✓</span>
              <div className="text-[0.86rem]"><strong className="block font-semibold mb-[1px]">Unlimited finalized events</strong><span className="text-[#64748b] text-[0.82rem]">Track every market, festival, and pop-up you run</span></div>
            </li>
            <li className="flex gap-[11px] items-start">
              <span className={`${featureCheck} bg-[#fce7f3] text-[#9d174d]`}>✓</span>
              <div className="text-[0.86rem]"><strong className="block font-semibold mb-[1px]">PDF export</strong><span className="text-[#64748b] text-[0.82rem]">Download branded reports for your records or accountant</span></div>
            </li>
            <li className="flex gap-[11px] items-start">
              <span className={`${featureCheck} bg-[#ede9fe] text-[#6d28d9]`}>✓</span>
              <div className="text-[0.86rem]"><strong className="block font-semibold mb-[1px]">Full event history</strong><span className="text-[#64748b] text-[0.82rem]">Compare events over time to find your most profitable markets</span></div>
            </li>
            <li className="flex gap-[11px] items-start">
              <span className={`${featureCheck} bg-[#f0fdf4] text-[#15803d]`}>✓</span>
              <div className="text-[0.86rem]"><strong className="block font-semibold mb-[1px]">Square POS sync</strong><span className="text-[#64748b] text-[0.82rem]">Pull real sales data — fees, refunds, and discounts included</span></div>
            </li>
            <li className="flex gap-[11px] items-start">
              <span className={`${featureCheck} bg-[#fff7ed] text-[#c2410c]`}>✓</span>
              <div className="text-[0.86rem]"><strong className="block font-semibold mb-[1px]">Custom form templates</strong><span className="text-[#64748b] text-[0.82rem]">Design event forms that match exactly how you work</span></div>
            </li>
          </ul>
          <div className="flex items-center gap-2 bg-[#f8fafc] rounded-lg px-3 py-[9px] text-[0.8rem] text-[#64748b]">
            <i className="fa-solid fa-clipboard-list" />
            <span>You're on <strong>Venview Starter</strong> — includes 1 finalized event and basic profit summary.</span>
          </div>
        </div>

        <div className="border-t border-[#dde3f0]" />
        <div className="px-[26px] py-[18px] text-center">
          <button
            className="block w-full py-3 rounded-[10px] text-[0.93rem] font-bold cursor-pointer border-0 font-[inherit] bg-[#0B2A4A] text-white mb-2 hover:bg-[#0A3A67]"
            style={{ transition: 'background 0.15s' }}
            onClick={onClose}
          >
            <i className="fa-solid fa-bolt" /> Upgrade to Pro
          </button>
          <p className="text-[0.76rem] text-[#64748b] mt-[5px] mb-3.5">Contact us to upgrade &nbsp;·&nbsp; No spreadsheets, no guesswork</p>
          <button
            className="block w-full py-3 rounded-[10px] text-[0.83rem] font-medium cursor-pointer border-0 font-[inherit] bg-transparent text-[#64748b]"
            onClick={onClose}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
