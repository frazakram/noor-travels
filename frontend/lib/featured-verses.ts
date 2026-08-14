/**
 * Curated pool for "Ayah of the Day" — verse_keys that are already vetted as meaningful,
 * complete thoughts (they're the citation set backend/app/services/query_expansion.py's
 * THEMATIC_CLUSTERS uses to answer real questions about patience, mercy, gratitude, etc.).
 * Picking from this pool instead of uniformly across all 6,236 ayahs avoids landing on
 * narrative fragments or mid-clause legal verses that read as confusing out of context.
 */
export const FEATURED_VERSE_KEYS: string[] = [
  "112:1", "113:1", "114:1",
  "12:100", "12:101", "12:111", "12:6", "12:83",
  "13:28", "16:12", "17:1", "17:111", "17:23", "17:35",
  "18:31", "20:114", "20:14", "22:27", "23:115", "25:48", "25:74",
  "26:80", "26:83", "28:24", "29:45",
  "2:110", "2:153", "2:155", "2:156", "2:164", "2:168", "2:173", "2:180",
  "2:183", "2:185", "2:187", "2:190", "2:196", "2:201", "2:216", "2:219",
  "2:238", "2:255", "2:256", "2:267", "2:275", "2:276", "2:278", "2:279",
  "2:286", "2:30", "2:43", "2:97",
  "30:21", "30:22", "30:48", "31:14", "33:35", "37:102", "39:53",
  "3:13", "3:130", "3:133", "3:157", "3:169", "3:185", "3:190", "3:195",
  "3:200", "3:3", "3:8", "3:97",
  "41:44", "41:53", "49:10",
  "4:11", "4:12", "4:161", "4:176", "4:36", "4:43", "4:74",
  "51:56", "55:9", "57:7",
  "5:3", "5:46", "5:6", "5:68", "5:90",
  "60:8", "67:1",
  "6:145", "6:154", "7:31",
  "83:1", "94:5",
  "9:119", "9:60", "9:72",
];
