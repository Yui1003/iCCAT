import { Star } from "lucide-react";
import { useState } from "react";

interface StarRatingProps {
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function StarRating({ value, onChange, disabled = false }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const displayValue = hoverValue !== null ? hoverValue : value;

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onChange(star)}
          onMouseEnter={() => !disabled && setHoverValue(star)}
          onMouseLeave={() => setHoverValue(null)}
          className="transition-transform active:scale-95 disabled:cursor-not-allowed"
          data-testid={`star-${star}`}
        >
          <Star
            className={`w-8 h-8 transition-colors ${
              displayValue !== null && star <= displayValue
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}
