// Username filter. Catches common slurs and crude words, including inside longer names.
const BLOCKED = [
  'fuck', 'shit', 'cunt', 'bitch', 'nigg', 'nigr', 'fagg', 'faggot', 'kike', 'spic', 'chink',
  'gook', 'retard', 'tranny', 'whore', 'slut', 'rape', 'rapist', 'nazi', 'hitler', 'penis',
  'vagina', 'dick', 'cock', 'pussy', 'porn', 'cum', 'jizz', 'anal', 'anus', 'tits', 'boob',
  'dyke', 'coon', 'wetback', 'beaner', 'kkk', 'admin', 'moderator', 'anagramparty', 'official',
];

export function usernameProblem(name: string): string | null {
  if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) {
    return 'Use 3 to 20 letters, numbers, or underscores.';
  }
  const flat = name.toLowerCase().replace(/_/g, '').replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't');
  if (BLOCKED.some((b) => flat.includes(b))) return 'That name is not allowed. Try another.';
  return null;
}
