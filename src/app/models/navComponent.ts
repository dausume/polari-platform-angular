export class navComponent {
    title : string;
    path: string;
    component: string;
    authGroups?: string[];
    queryParams?: any;

    static componentTemplates = ["ClassMainPageComponent", "ClassTableComponent"]

    constructor(title: string, path: string, component: string, queryParams?: any, authGroups?: string[])
    {
        this.component = component;
        this.title = title;
        this.path = path;
        if(queryParams == null)
        {
            this.queryParams = [];
        }
        else
        {
            this.queryParams = queryParams;
        }
        if(queryParams == null)
        {
            this.authGroups = [];
        }
        else
        {
            this.authGroups = authGroups;
        }
    }
}