const tones = {
  neutral: "bg-[#0B4D3A]/10 text-[#0B4D3A]",
  good: "bg-[#0B4D3A] text-[#FBF8F1]",
  warn: "bg-[#FFF4D6] text-[#6B4E00]",
  bad: "bg-[#FBEAEA] text-[#8A1F1F]",
};

export default function Chip({ children, tone = "neutral" }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
