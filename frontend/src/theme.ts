export const theme = {
  colors: {
    bg: '#050202',
    surface: '#140a0a',
    surfaceAlt: '#1a0d0d',
    primary: '#FF3B00',
    primaryHover: '#FF5E00',
    secondary: '#E60000',
    gold: '#FFD700',
    neon: '#FF7300',
    textPrimary: '#FFFFFF',
    textSecondary: '#B3A3A3',
    textMuted: '#807070',
    border: 'rgba(255, 59, 0, 0.2)',
    borderActive: 'rgba(255, 59, 0, 0.55)',
    danger: '#FF3344',
    success: '#22C55E',
    overlay: 'rgba(0,0,0,0.65)',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 },
};

export const ATTRS = ['Atk', 'Def', 'Ag', 'Ck', 'Hp'] as const;
export type Attr = typeof ATTRS[number];
export const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
export type Rank = typeof RANKS[number];
export const RANK_ORDER: Record<Rank, number> = { E: 1, D: 2, C: 3, B: 4, A: 5, S: 6 };
export const VILLAGES = ['Yukigakure', 'Tsukigakure', 'Takigakure'] as const;
