import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  contentClassName?: string;
};

export function Card({
  className,
  title,
  subtitle,
  footer,
  contentClassName,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-800/60 bg-slate-900/80 p-4 shadow-sm",
        className,
      )}
      {...props}
    >
      {(title || subtitle) && (
        <div className="flex flex-col gap-1 pb-3">
          {title && (
            <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          )}
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      )}
      <div className={cn("text-sm text-slate-200", contentClassName)}>
        {children}
      </div>
      {footer && <div className="pt-3 text-xs text-slate-400">{footer}</div>}
    </div>
  );
}
