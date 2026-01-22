import { CompressionStrategy } from "./compressionStrategy";

export class CompressionFilter {
    filterChain: any;
    compressionStrategy: CompressionStrategy;
    constants: any;
    timeStepVariableName: string;
    compressedTimeVariableName: string;
    aggregatedValueVariableName: string;

    constructor(filterChain: any, compressionStrategy: any, constants: any, timeStepVariableName: string, compressedTimeVariableName: string, aggregatedValueVariableName: string) {
        this.filterChain = filterChain;
        this.compressionStrategy = compressionStrategy;
        this.constants = constants;
        this.timeStepVariableName = timeStepVariableName;
        this.compressedTimeVariableName = compressedTimeVariableName;
        this.aggregatedValueVariableName = aggregatedValueVariableName;
    }
}