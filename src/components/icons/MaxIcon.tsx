import { cn } from "@/lib/utils";

interface MaxIconProps {
  className?: string;
}

export function MaxIcon({ className }: MaxIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("h-5 w-5", className)}
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8L14.4 12l2.24 3.2c.2.28.04.68-.28.68h-1.72c-.16 0-.32-.08-.4-.2L12 12.8l-2.24 2.88c-.08.12-.24.2-.4.2H7.64c-.32 0-.48-.4-.28-.68L9.6 12 7.36 8.8c-.2-.28-.04-.68.28-.68h1.72c.16 0 .32.08.4.2L12 11.2l2.24-2.88c.08-.12.24-.2.4-.2h1.72c.32 0 .48.4.28.68z" />
    </svg>
  );
}
