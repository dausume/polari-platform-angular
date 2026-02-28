export interface DisplaySummary {
    id: string;
    name: string;
    description: string;
    source_class: string;
    linkedSolutions?: string[];
    isPage?: boolean;
    pageRoute?: string;
}
