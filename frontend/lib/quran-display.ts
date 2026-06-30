export function cleanQuranText(text?: string | null): string {
  return (text ?? "")
    .replace(/\s+[-–—]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function displaySurahName(number: number, name: string): string {
  if (number === 10 && name.toLowerCase() === "jonas") return "Jonah";
  return name;
}
