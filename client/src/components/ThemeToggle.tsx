import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme, switchable } = useTheme();
  if (!switchable || !toggleTheme) return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={`w-8 h-8 rounded-full ${className}`}
      title={theme === "dark" ? "切換淺色模式" : "切換深色模式"}
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-amber-700" />
      )}
    </Button>
  );
}
