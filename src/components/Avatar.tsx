type Props = {
  initials: string;
  tone: number;
  size?: "small" | "medium";
};

export function Avatar({ initials, tone, size = "small" }: Props) {
  return (
    <span className="avatar" data-tone={tone} data-size={size} aria-hidden>
      {initials}
    </span>
  );
}
