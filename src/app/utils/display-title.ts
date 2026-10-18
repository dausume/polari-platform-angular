// Author: Dustin Etts
// display-title.ts — the readable title of a page header. A display's internal name is a slug ("pin-view",
// "register-profile"); the header shows the display's own `title` when it carries one, else the name humanized
// (hyphens / underscores -> spaces, first letter capitalised: "pin-view" -> "Pin view"). A name that already reads
// as prose (it has a space or a capital letter) is left exactly as written.

export function humanizeName(name: string): string {
    const raw = (name || '').trim();
    if (!raw || /[\sA-Z]/.test(raw)) { return raw; }
    const spaced = raw.replace(/[-_]+/g, ' ').trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function displayHeaderTitle(d: { name?: string; title?: string } | null | undefined): string {
    if (!d) { return ''; }
    return (d.title && d.title.trim()) || humanizeName(d.name || '');
}
