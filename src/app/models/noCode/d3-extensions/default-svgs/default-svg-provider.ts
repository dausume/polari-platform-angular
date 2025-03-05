import inputIcon from "./input-icon";
import outputIcon from "./output-icon";
import { convertSvgStringToSvgElement } from "./convertSvgStringToSvgElement";

const defaultIcons = {
    'inputIcon': inputIcon,
    'outputIcon': outputIcon
};

export const getDefaultSvgs = (): { [key: string]: SVGElement } => {
    const svgElementsMap: { [key: string]: SVGElement } = {};

    Object.entries(defaultIcons).forEach(([name, svgString]) => {
        Object.assign(svgElementsMap, convertSvgStringToSvgElement(name, svgString));
    });

    return svgElementsMap;
};