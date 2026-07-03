import { Info } from "lucide-react";
import { hintText, type UploadPreset } from "@/lib/uploadValidation";
import { cn } from "@/lib/utils";

interface Props {
  preset: UploadPreset;
  className?: string;
}

export default function UploadHint({ preset, className }: Props) {
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <Info className="h-3 w-3 shrink-0" />
      <span>{hintText(preset)}</span>
    </p>
  );
}
