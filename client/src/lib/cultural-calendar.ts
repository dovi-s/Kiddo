export type CulturalTradition =
  | "jewish"
  | "christian"
  | "muslim"
  | "hindu"
  | "hispanic_latin"
  | "asian"
  | "african_american";

export type CulturalBackground = {
  traditions: CulturalTradition[];
};

export const TRADITION_LABELS: Record<CulturalTradition, string> = {
  jewish: "Jewish",
  christian: "Christian",
  muslim: "Muslim",
  hindu: "Hindu",
  hispanic_latin: "Hispanic / Latin",
  asian: "Asian",
  african_american: "African American",
};

export const TRADITION_ICONS: Record<CulturalTradition, string> = {
  jewish: "✡️",
  christian: "✝️",
  muslim: "☪️",
  hindu: "🪔",
  hispanic_latin: "🌺",
  asian: "🏮",
  african_american: "🕯️",
};

type SuggestedEvent = {
  key: string;
  emoji: string;
  name: string;
  sub: string;
  countdown: string;
  prefill: Record<string, string | undefined>;
};

// Approximate Lunar New Year dates (first new moon after Jan 20)
const LUNAR_NEW_YEAR: Record<number, [number, number]> = {
  2025: [1, 29],
  2026: [2, 17],
  2027: [2, 6],
  2028: [1, 26],
  2029: [2, 13],
  2030: [2, 3],
};

// Approximate Diwali dates (October/November)
const DIWALI: Record<number, [number, number]> = {
  2025: [10, 20],
  2026: [11, 8],
  2027: [10, 29],
  2028: [10, 17],
  2029: [11, 5],
  2030: [10, 26],
};

// Approximate Hanukkah start (December)
const HANUKKAH_START: Record<number, [number, number]> = {
  2025: [12, 14],
  2026: [12, 4],
  2027: [12, 24],
  2028: [12, 12],
  2029: [12, 1],
  2030: [12, 20],
};

// Approximate Eid al-Fitr
const EID_AL_FITR: Record<number, [number, number]> = {
  2025: [3, 30],
  2026: [3, 20],
  2027: [3, 9],
  2028: [2, 26],
  2029: [2, 14],
  2030: [2, 4],
};

function daysUntil(date: Date, nowMs: number): number {
  return Math.ceil((date.getTime() - nowMs) / 86400000);
}

function countdownLabel(days: number): string {
  if (days <= 0) return "This season";
  if (days <= 60) return `${days}d away`;
  if (days <= 365) return `${Math.round(days / 30)}mo away`;
  return `${Math.ceil(days / 365)}yr away`;
}

// Returns the nearest upcoming date from a year→[month,day] map
function nearestUpcoming(
  monthDaysByYear: Record<number, [number, number]>,
  nowMs: number,
): Date | null {
  const yr = new Date(nowMs).getFullYear();
  for (const y of [yr, yr + 1, yr + 2]) {
    const md = monthDaysByYear[y];
    if (!md) continue;
    const d = new Date(y, md[0] - 1, md[1]);
    if (d.getTime() > nowMs) return d;
  }
  return null;
}

// Returns the next upcoming Dec 26 (Kwanzaa) on or after now
function nextKwanzaa(nowMs: number): Date {
  const yr = new Date(nowMs).getFullYear();
  const thisYear = new Date(yr, 11, 26);
  return thisYear.getTime() > nowMs ? thisYear : new Date(yr + 1, 11, 26);
}

// Returns the next upcoming Jan 6 (Three Kings Day) on or after now
function nextThreeKingsDay(nowMs: number): Date {
  const yr = new Date(nowMs).getFullYear();
  const thisYear = new Date(yr, 0, 6);
  return thisYear.getTime() > nowMs ? thisYear : new Date(yr + 1, 0, 6);
}

export function getCulturalSuggestions(opts: {
  traditions: CulturalTradition[];
  childFirstName: string;
  childBirthdate: Date | null;
  childAgeNow: number | null;
  activeEventNames: string[];
  nowMs: number;
}): SuggestedEvent[] {
  const { traditions, childFirstName, childBirthdate, childAgeNow, activeEventNames, nowMs } = opts;
  const name = childFirstName || "your child";
  const suggestions: SuggestedEvent[] = [];
  const activeNamesLower = activeEventNames.map(n => n.toLowerCase());
  const hasActive = (kw: string) => activeNamesLower.some(n => n.includes(kw));

  if (traditions.includes("jewish")) {
    // Bar/Bat Mitzvah at age 13 (suggest from age 10-14)
    if (childAgeNow !== null && childAgeNow >= 10 && childAgeNow <= 14 && !hasActive("mitzvah")) {
      const approxYear = childBirthdate ? childBirthdate.getFullYear() + 13 : new Date(nowMs).getFullYear() + 1;
      const yearsUntil = approxYear - new Date(nowMs).getFullYear();
      suggestions.push({
        key: "sug-mitzvah",
        emoji: "✡️",
        name: `${name}'s Bar/Bat Mitzvah`,
        sub: `Approx ${approxYear}`,
        countdown: yearsUntil <= 0 ? "This year" : `${yearsUntil} yr${yearsUntil !== 1 ? "s" : ""} away`,
        prefill: {
          name: `${name}'s Bar/Bat Mitzvah`,
          eventType: "graduation",
          eventDate: `${approxYear}-09-01`,
          goalAmount: "1800",
          eventCategory: "gifting_occasion",
        },
      });
    }

    // Hanukkah - always show next upcoming date
    if (!hasActive("hanukkah")) {
      const hanDate = nearestUpcoming(HANUKKAH_START, nowMs);
      if (hanDate) {
        suggestions.push({
          key: "sug-hanukkah",
          emoji: "🕎",
          name: `${name}'s Hanukkah`,
          sub: hanDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          countdown: countdownLabel(daysUntil(hanDate, nowMs)),
          prefill: {
            name: `${name}'s Hanukkah`,
            eventType: "holiday",
            eventDate: hanDate.toISOString().slice(0, 10),
            eventCategory: "gifting_occasion",
          },
        });
      }
    }
  }

  if (traditions.includes("christian")) {
    // First Communion at age 8 (suggest from age 5-9)
    if (childAgeNow !== null && childAgeNow >= 5 && childAgeNow <= 9 && !hasActive("communion")) {
      const approxYear = childBirthdate ? childBirthdate.getFullYear() + 8 : new Date(nowMs).getFullYear() + 2;
      const yearsUntil = approxYear - new Date(nowMs).getFullYear();
      suggestions.push({
        key: "sug-communion",
        emoji: "🕊️",
        name: `${name}'s First Communion`,
        sub: `Approx ${approxYear}`,
        countdown: yearsUntil <= 0 ? "This year" : `${yearsUntil} yr${yearsUntil !== 1 ? "s" : ""} away`,
        prefill: {
          name: `${name}'s First Communion`,
          eventType: "graduation",
          eventDate: `${approxYear}-05-01`,
          goalAmount: "500",
          eventCategory: "gifting_occasion",
        },
      });
    }

    // Confirmation at age 15 (suggest from age 11-17)
    if (childAgeNow !== null && childAgeNow >= 11 && childAgeNow <= 17 && !hasActive("confirmation")) {
      const approxYear = childBirthdate ? childBirthdate.getFullYear() + 15 : new Date(nowMs).getFullYear() + 2;
      const yearsUntil = approxYear - new Date(nowMs).getFullYear();
      suggestions.push({
        key: "sug-confirmation",
        emoji: "✝️",
        name: `${name}'s Confirmation`,
        sub: `Approx ${approxYear}`,
        countdown: yearsUntil <= 0 ? "This year" : `${yearsUntil} yr${yearsUntil !== 1 ? "s" : ""} away`,
        prefill: {
          name: `${name}'s Confirmation`,
          eventType: "graduation",
          eventDate: `${approxYear}-05-01`,
          goalAmount: "500",
          eventCategory: "gifting_occasion",
        },
      });
    }
  }

  if (traditions.includes("muslim")) {
    // Eid al-Fitr - always show next upcoming
    if (!hasActive("eid")) {
      const eidDate = nearestUpcoming(EID_AL_FITR, nowMs);
      if (eidDate) {
        suggestions.push({
          key: "sug-eid",
          emoji: "☪️",
          name: `${name}'s Eid`,
          sub: eidDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          countdown: countdownLabel(daysUntil(eidDate, nowMs)),
          prefill: {
            name: `${name}'s Eid`,
            eventType: "holiday",
            eventDate: eidDate.toISOString().slice(0, 10),
            eventCategory: "gifting_occasion",
          },
        });
      }
    }
  }

  if (traditions.includes("hindu")) {
    // Diwali - always show next upcoming
    if (!hasActive("diwali")) {
      const diwaliDate = nearestUpcoming(DIWALI, nowMs);
      if (diwaliDate) {
        suggestions.push({
          key: "sug-diwali",
          emoji: "🪔",
          name: `${name}'s Diwali`,
          sub: diwaliDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          countdown: countdownLabel(daysUntil(diwaliDate, nowMs)),
          prefill: {
            name: `${name}'s Diwali`,
            eventType: "holiday",
            eventDate: diwaliDate.toISOString().slice(0, 10),
            eventCategory: "gifting_occasion",
          },
        });
      }
    }
  }

  if (traditions.includes("hispanic_latin")) {
    // Quinceañera at age 15 (suggest from age 12-16)
    if (childAgeNow !== null && childAgeNow >= 12 && childAgeNow <= 16 && !hasActive("quinceañera") && !hasActive("quinceanera")) {
      const approxYear = childBirthdate ? childBirthdate.getFullYear() + 15 : new Date(nowMs).getFullYear() + 2;
      const yearsUntil = approxYear - new Date(nowMs).getFullYear();
      suggestions.push({
        key: "sug-quince",
        emoji: "🌺",
        name: `${name}'s Quinceañera`,
        sub: `Approx ${approxYear}`,
        countdown: yearsUntil <= 0 ? "This year" : `${yearsUntil} yr${yearsUntil !== 1 ? "s" : ""} away`,
        prefill: {
          name: `${name}'s Quinceañera`,
          eventType: "graduation",
          eventDate: `${approxYear}-06-01`,
          goalAmount: "2000",
          eventCategory: "gifting_occasion",
        },
      });
    }

    // Three Kings Day - always show next upcoming Jan 6
    if (!hasActive("three kings") && !hasActive("reyes")) {
      const tkDate = nextThreeKingsDay(nowMs);
      suggestions.push({
        key: "sug-three-kings",
        emoji: "👑",
        name: `${name}'s Three Kings Day`,
        sub: tkDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        countdown: countdownLabel(daysUntil(tkDate, nowMs)),
        prefill: {
          name: `${name}'s Three Kings Day`,
          eventType: "holiday",
          eventDate: tkDate.toISOString().slice(0, 10),
          eventCategory: "gifting_occasion",
        },
      });
    }
  }

  if (traditions.includes("asian")) {
    // Lunar New Year - always show next upcoming
    if (!hasActive("lunar") && !hasActive("new year")) {
      const lnyDate = nearestUpcoming(LUNAR_NEW_YEAR, nowMs);
      if (lnyDate) {
        suggestions.push({
          key: "sug-lny",
          emoji: "🏮",
          name: `${name}'s Lunar New Year`,
          sub: lnyDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          countdown: countdownLabel(daysUntil(lnyDate, nowMs)),
          prefill: {
            name: `${name}'s Lunar New Year`,
            eventType: "holiday",
            eventDate: lnyDate.toISOString().slice(0, 10),
            eventCategory: "gifting_occasion",
          },
        });
      }
    }
  }

  if (traditions.includes("african_american")) {
    // Kwanzaa - always show next upcoming Dec 26
    if (!hasActive("kwanzaa")) {
      const kwDate = nextKwanzaa(nowMs);
      suggestions.push({
        key: "sug-kwanzaa",
        emoji: "🕯️",
        name: `${name}'s Kwanzaa`,
        sub: kwDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        countdown: countdownLabel(daysUntil(kwDate, nowMs)),
        prefill: {
          name: `${name}'s Kwanzaa`,
          eventType: "holiday",
          eventDate: kwDate.toISOString().slice(0, 10),
          eventCategory: "gifting_occasion",
        },
      });
    }
  }

  return suggestions;
}
