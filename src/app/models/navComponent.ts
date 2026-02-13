// Author: Dustin Etts
export type ObjectCategory = 'framework' | 'custom' | 'materials_science';

export class navComponent {
    title : string;
    path: string;
    component: string;
    crude?:{}
    componentModifiers?: object;
    authGroups?: string[];
    queryParams?: any;
    /** Whether this class's instances can be edited/created/deleted via the UI */
    isEditable?: boolean;
    /** The class name (for class-based nav items) */
    className?: string;
    /** Category of the object: framework (base/core), serverOnly (server-access), or custom (user-created) */
    objectCategory?: ObjectCategory;

    static classComponentTemplates = ["ClassMainPageComponent"]

    constructor(
        title: string,
        path: string,
        component: string,
        crude?:object,
        queryParams?: any,
        componentModifiers?:object,
        isEditable?: boolean,
        className?: string,
        objectCategory?: ObjectCategory
    )
    {
        this.component = component;
        this.title = title;
        this.path = path;
        if(crude == null)
        {
            this.crude = {};
        }
        else
        {
            this.crude = crude;
        }
        this.crude = crude;
        if(queryParams == null)
        {
            this.queryParams = [];
        }
        else
        {
            this.queryParams = queryParams;
        }
        this.componentModifiers = componentModifiers;
        this.isEditable = isEditable ?? true;  // Default to editable for backwards compat
        this.className = className;
        this.objectCategory = objectCategory ?? 'custom';  // Default to custom for backwards compat
    }
}