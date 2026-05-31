// Tiny class-name joiner so components don't pull in a dependency for this.
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
