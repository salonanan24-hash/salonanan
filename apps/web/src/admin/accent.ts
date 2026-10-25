export const adminAccents = [
  { id: 'burgundy', hex: '#a34b63' },
  { id: 'sea', hex: '#3b7fc4' },
  { id: 'ink', hex: '#4a4a50' },
  { id: 'purple', hex: '#7d62a8' },
  { id: 'copper', hex: '#c4844e' },
  { id: 'forest', hex: '#3d8f6a' },
] as const;

export type AccentId = (typeof adminAccents)[number]['id'];

export function resolveAccent(id: string | undefined) {
  return adminAccents.find((item) => item.id === id) ?? adminAccents[0];
}
