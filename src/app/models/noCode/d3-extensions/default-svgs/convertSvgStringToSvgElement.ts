export const convertSvgStringToSvgElement = (svgName: string, svgString: string): { [key: string]: SVGElement } => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const svgElement = doc.documentElement;
    // Ensure it's an actual SVG element before returning
    if (svgElement instanceof SVGSVGElement) {
        return { [svgName]: svgElement };
    } else {
        throw new Error(`Invalid SVG string for ${svgName}`);
    }
};