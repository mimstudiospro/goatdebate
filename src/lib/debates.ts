export interface Contender {
  id: string;
  debate_id: string;
  name: string;
  tagline: string;
  sort_order: number;
}

export interface Debate {
  id: string;
  slug: string;
  title: string;
  sport: string;
  contenders: Contender[];
}

/**
 * The 9 launch debates. Taglines use only established public facts.
 * This mirrors supabase/schema.sql exactly (same slugs, titles, sports,
 * names and taglines) so the app can render before the database is
 * connected — voting is disabled until then.
 */
export const SEED_DEBATES: Debate[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "messi-vs-ronaldo",
    title: "Messi vs Ronaldo",
    sport: "Football",
    contenders: [
      {
        id: "11111111-1111-4111-8111-111111111112",
        debate_id: "11111111-1111-4111-8111-111111111111",
        name: "Lionel Messi",
        tagline: "8× Ballon d'Or",
        sort_order: 1,
      },
      {
        id: "11111111-1111-4111-8111-111111111113",
        debate_id: "11111111-1111-4111-8111-111111111111",
        name: "Cristiano Ronaldo",
        tagline: "5× Ballon d'Or",
        sort_order: 2,
      },
    ],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "jordan-vs-lebron",
    title: "Jordan vs LeBron",
    sport: "Basketball",
    contenders: [
      {
        id: "22222222-2222-4222-8222-222222222223",
        debate_id: "22222222-2222-4222-8222-222222222222",
        name: "Michael Jordan",
        tagline: "6× NBA champion",
        sort_order: 1,
      },
      {
        id: "22222222-2222-4222-8222-222222222224",
        debate_id: "22222222-2222-4222-8222-222222222222",
        name: "LeBron James",
        tagline: "NBA all-time scoring leader",
        sort_order: 2,
      },
    ],
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    slug: "brady-vs-montana",
    title: "Brady vs Montana",
    sport: "American Football",
    contenders: [
      {
        id: "33333333-3333-4333-8333-333333333335",
        debate_id: "33333333-3333-4333-8333-333333333333",
        name: "Tom Brady",
        tagline: "7× Super Bowl champion",
        sort_order: 1,
      },
      {
        id: "33333333-3333-4333-8333-333333333336",
        debate_id: "33333333-3333-4333-8333-333333333333",
        name: "Joe Montana",
        tagline: "4× Super Bowl champion",
        sort_order: 2,
      },
    ],
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    slug: "ali-vs-tyson",
    title: "Ali vs Tyson",
    sport: "Boxing",
    contenders: [
      {
        id: "44444444-4444-4444-8444-444444444445",
        debate_id: "44444444-4444-4444-8444-444444444444",
        name: "Muhammad Ali",
        tagline: "3× heavyweight champion",
        sort_order: 1,
      },
      {
        id: "44444444-4444-4444-8444-444444444446",
        debate_id: "44444444-4444-4444-8444-444444444444",
        name: "Mike Tyson",
        tagline: "Youngest heavyweight champion",
        sort_order: 2,
      },
    ],
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    slug: "federer-vs-nadal",
    title: "Federer vs Nadal",
    sport: "Tennis",
    contenders: [
      {
        id: "55555555-5555-4555-8555-555555555557",
        debate_id: "55555555-5555-4555-8555-555555555555",
        name: "Roger Federer",
        tagline: "20 Grand Slams",
        sort_order: 1,
      },
      {
        id: "55555555-5555-4555-8555-555555555558",
        debate_id: "55555555-5555-4555-8555-555555555555",
        name: "Rafael Nadal",
        tagline: "22 Grand Slams",
        sort_order: 2,
      },
    ],
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    slug: "serena-vs-graf",
    title: "Serena Williams vs Steffi Graf",
    sport: "Women's Tennis",
    contenders: [
      {
        id: "66666666-6666-4666-8666-666666666667",
        debate_id: "66666666-6666-4666-8666-666666666666",
        name: "Serena Williams",
        tagline: "23 Grand Slams",
        sort_order: 1,
      },
      {
        id: "66666666-6666-4666-8666-666666666668",
        debate_id: "66666666-6666-4666-8666-666666666666",
        name: "Steffi Graf",
        tagline: "22 Grand Slams",
        sort_order: 2,
      },
    ],
  },
  {
    id: "77777777-7777-4777-8777-777777777777",
    slug: "hamilton-vs-schumacher",
    title: "Hamilton vs Schumacher",
    sport: "Formula 1",
    contenders: [
      {
        id: "77777777-7777-4777-8777-777777777778",
        debate_id: "77777777-7777-4777-8777-777777777777",
        name: "Lewis Hamilton",
        tagline: "7× world champion",
        sort_order: 1,
      },
      {
        id: "77777777-7777-4777-8777-777777777779",
        debate_id: "77777777-7777-4777-8777-777777777777",
        name: "Michael Schumacher",
        tagline: "7× world champion",
        sort_order: 2,
      },
    ],
  },
  {
    id: "88888888-8888-4888-8888-888888888888",
    slug: "woods-vs-nicklaus",
    title: "Woods vs Nicklaus",
    sport: "Golf",
    contenders: [
      {
        id: "88888888-8888-4888-8888-888888888889",
        debate_id: "88888888-8888-4888-8888-888888888888",
        name: "Tiger Woods",
        tagline: "15 majors",
        sort_order: 1,
      },
      {
        id: "88888888-8888-4888-8888-88888888888a",
        debate_id: "88888888-8888-4888-8888-888888888888",
        name: "Jack Nicklaus",
        tagline: "18 majors",
        sort_order: 2,
      },
    ],
  },
  {
    id: "99999999-9999-4999-8999-999999999999",
    slug: "pele-vs-maradona",
    title: "Pelé vs Maradona",
    sport: "Football",
    contenders: [
      {
        id: "99999999-9999-4999-8999-99999999999a",
        debate_id: "99999999-9999-4999-8999-999999999999",
        name: "Pelé",
        tagline: "3× World Cup winner",
        sort_order: 1,
      },
      {
        id: "99999999-9999-4999-8999-99999999999b",
        debate_id: "99999999-9999-4999-8999-999999999999",
        name: "Diego Maradona",
        tagline: "1986 World Cup winner",
        sort_order: 2,
      },
    ],
  },
];

/** Initials for the typographic contender cards (no athlete photos in v1). */
export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function debateBySlug(slug: string): Debate | undefined {
  return SEED_DEBATES.find((d) => d.slug === slug);
}
