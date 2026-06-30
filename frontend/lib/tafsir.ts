export type TafsirSource = "ibn_kathir_en" | "maududi_ur";
export type TafsirPref = "en" | "ur" | "both";

export function sourcesForPref(pref: TafsirPref): TafsirSource[] {
  if (pref === "en") return ["ibn_kathir_en"];
  if (pref === "ur") return ["maududi_ur"];
  return ["ibn_kathir_en", "maududi_ur"];
}

export function speechLangForSource(source: TafsirSource): "en" | "ur" {
  return source === "maududi_ur" ? "ur" : "en";
}
