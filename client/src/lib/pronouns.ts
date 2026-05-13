export type PronounKey = "he" | "she" | "they";

export type Pronouns = {
  subject: string;      // he / she / they
  object: string;       // him / her / them
  possAdj: string;      // his / her / their
  possNoun: string;     // his / hers / theirs
  reflexive: string;    // himself / herself / themselves
  singular: boolean;    // for verb agreement: "turns" vs "turn"
};

const PRONOUN_SETS: Record<PronounKey, Pronouns> = {
  he: {
    subject: "he", object: "him", possAdj: "his", possNoun: "his",
    reflexive: "himself", singular: true,
  },
  she: {
    subject: "she", object: "her", possAdj: "her", possNoun: "hers",
    reflexive: "herself", singular: true,
  },
  they: {
    subject: "they", object: "them", possAdj: "their", possNoun: "theirs",
    reflexive: "themselves", singular: false,
  },
};

export function getPronouns(pronoun: string | null | undefined): Pronouns {
  return PRONOUN_SETS[(pronoun as PronounKey) ?? ""] ?? PRONOUN_SETS.they;
}

export const PRONOUN_OPTIONS: { value: PronounKey; label: string; example: string }[] = [
  { value: "she", label: "She / Her", example: "She'll thank you someday." },
  { value: "he", label: "He / Him", example: "He'll thank you someday." },
  { value: "they", label: "They / Them", example: "They'll thank you someday." },
];
