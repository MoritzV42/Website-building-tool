export function buildStableSelector(node: Element): string {
  if (node.id) {
    return `#${node.id}`;
  }

  const segments: string[] = [];
  let element: Element | null = node;
  let depth = 0;

  while (element && depth < 5) {
    const tag = element.tagName.toLowerCase();
    let segment = tag;

    if (element.classList.length > 0) {
      const classes = Array.from(element.classList)
        .filter((cls) => !cls.startsWith("_"))
        .slice(0, 2)
        .join(".");
      if (classes) {
        segment += `.${classes.replace(/\s+/g, ".")}`;
      }
    }

    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((sibling) => sibling.tagName === element?.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(element) + 1;
        segment += `:nth-of-type(${index})`;
      }
    }

    segments.unshift(segment);
    element = element.parentElement;
    depth += 1;
  }

  return segments.join(" > ");
}
