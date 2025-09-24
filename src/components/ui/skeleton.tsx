import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-800/60", className)}
      {...props}
    />
  );
}
