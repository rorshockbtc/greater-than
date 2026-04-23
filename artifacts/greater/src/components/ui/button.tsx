import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "accent"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
          {
            "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20": variant === "default",
            "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20": variant === "destructive",
            "border border-border bg-card hover:bg-accent hover:text-accent-foreground": variant === "outline",
            "bg-secondary text-secondary-foreground hover:bg-secondary/80": variant === "secondary",
            "hover:bg-accent/10 hover:text-accent": variant === "ghost",
            "text-primary underline-offset-4 hover:underline": variant === "link",
            "bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20": variant === "accent",
            "h-10 px-4 py-2": size === "default",
            "h-9 rounded-lg px-3": size === "sm",
            "h-11 rounded-2xl px-8": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

function buttonVariants({ variant, size }: { variant?: ButtonProps["variant"]; size?: ButtonProps["size"] } = {}) {
  return cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
    {
      "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20": variant === "default" || !variant,
      "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20": variant === "destructive",
      "border border-border bg-card hover:bg-accent hover:text-accent-foreground": variant === "outline",
      "bg-secondary text-secondary-foreground hover:bg-secondary/80": variant === "secondary",
      "hover:bg-accent/10 hover:text-accent": variant === "ghost",
      "text-primary underline-offset-4 hover:underline": variant === "link",
      "bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20": variant === "accent",
      "h-10 px-4 py-2": size === "default" || !size,
      "h-9 rounded-lg px-3": size === "sm",
      "h-11 rounded-2xl px-8": size === "lg",
      "h-10 w-10": size === "icon",
    }
  )
}

export { Button, buttonVariants }
