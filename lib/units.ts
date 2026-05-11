export type UnitSystem = "metric" | "imperial";

export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.2046 * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  return Math.round((lbs / 2.2046) * 10) / 10;
}

export function cmToFtIn(cm: number): string {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn % 12);
  return `${ft}'${inches}"`;
}

export function formatWeight(kg: number | null | undefined, system: UnitSystem): string {
  if (kg == null) return "?";
  if (system === "imperial") return `${kgToLbs(kg)}lbs`;
  return `${kg}kg`;
}

export function formatHeight(cm: number | null | undefined, system: UnitSystem): string {
  if (cm == null) return "?";
  if (system === "imperial") return cmToFtIn(cm);
  return `${cm}cm`;
}

export function weightLabel(system: UnitSystem): string {
  return system === "imperial" ? "lbs" : "kg";
}

export function weightInputToKg(value: string, system: UnitSystem): number | null {
  const n = parseFloat(value);
  if (isNaN(n)) return null;
  return system === "imperial" ? lbsToKg(n) : n;
}
