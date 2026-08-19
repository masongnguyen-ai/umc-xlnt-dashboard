import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,filter,opacity,transform] duration-150 ease-out disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-border disabled:bg-surface2 disabled:text-dim disabled:opacity-100 disabled:saturate-50 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-accent-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:brightness-110",
        secondary: "border border-border-strong bg-transparent text-fg hover:bg-surface2",
        ghost: "text-muted hover:bg-surface2 hover:text-fg",
        outline: "border border-border bg-transparent text-fg hover:bg-surface2",
        destructive: "bg-bad text-fg hover:brightness-110",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 min-h-11 px-4",
        sm: "h-8 min-h-8 px-3 text-xs",
        lg: "h-11 min-h-11 px-5",
        icon: "size-11 min-h-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
