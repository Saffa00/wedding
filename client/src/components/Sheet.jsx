import { X } from "lucide-react";

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 };

// Bottom sheet on phones, centred panel on large screens
export default function Sheet({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/50 lg:items-center lg:justify-center" onClick={onClose}>
      <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}
           className="max-h-[92vh] overflow-y-auto rounded-t-3xl bg-[#FBF8F1] p-5 lg:w-full lg:max-w-md lg:rounded-3xl"
           style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl text-[#0B4D3A]" style={serif}>{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center"><X size={22} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
