import * as React from "react";
import { cn } from "../../lib/utils";

const Button = React.forwardRef(
  ({ className, variant = "default", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 px-4 py-2";

    const variants = {
      default: "bg-black text-white hover:bg-gray-800",
      outline: "border border-gray-300 bg-white text-black hover:bg-gray-50",
      secondary: "bg-gray-100 text-black hover:bg-gray-200",
      destructive: "bg-red-600 text-white hover:bg-red-700",
      ghost: "hover:bg-gray-100 text-black",
    };

    return (
      <button
        className={cn(baseStyles, variants[variant], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
