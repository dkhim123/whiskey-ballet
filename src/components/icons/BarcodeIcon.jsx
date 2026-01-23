export default function BarcodeIcon({ className = "w-6 h-6" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 3h3v18H7V3zm4 0h2v18h-2V3zm4 0h2v18h-2V3zm4 0h3v18h-3V3zM3 3v18h2V3H3z"
      />
    </svg>
  )
}
